import fetchWithRetry from './utils/fetch'
import FirebaseApp, { StorageInterface, assertRequiredProperties } from './app'
import { toBase64 } from './utils/base64'

const AUTH_VERSION = 'FIS_v2'
const CLIENT_VERSION  = '0.6.6'
const SDK_VERSION = `w:${CLIENT_VERSION}`
const VALID_FID_PATTERN = /^[cdef][\w-]{21}$/
const INVALID_FID = ''

// Refresh policy constants; see AGENTS.md "Firebase Installations failure policy" for the
// full rationale behind each one.
const INSTALLATION_REFRESH_MARGIN = 60 * 60 * 1000 // in ms
const INSTALLATION_MIN_USABLE_MS = 60 * 1000 // in ms
const INSTALLATION_REFRESH_COOLDOWN_MS = 60 * 1000 // in ms
const MAX_INSTALLATION_LIFETIME = 7 * 24 * 60 * 60 * 1000 // in ms

// Firebase heartbeat limits and payload version; mirrors firebase-js-sdk, see AGENTS.md
// "Vendor parity" table.
const BUILD_TARGET = 'cjs'
const MAX_HEADER_BYTES = 1024
const MAX_NUM_STORED_HEARTBEATS = 30
const HEARTBEAT_VERSION = 2

// Node/CommonJS approximation of Firebase's dynamically-built platform logger string, not a
// verbatim upstream literal; see AGENTS.md "Vendor parity" table.
const HEARTBEAT_AGENT = [
    `fire-core/${CLIENT_VERSION}`,
    `fire-core-${BUILD_TARGET}/${CLIENT_VERSION}`,
    'fire-js/',
    `fire-installations/${SDK_VERSION.slice(2)}`,
    `fire-installations-${BUILD_TARGET}/${SDK_VERSION.slice(2)}`,
].join(' ')

export interface InstallationEntry {
    readonly fid: string
    readonly refreshToken: string
    readonly authToken: string
    readonly expiresAt: number
}

interface SingleDateHeartbeat {
    agent: string
    date: string
}

interface HeartbeatsByUserAgent {
    agent: string
    dates: string[]
}

// Mirrors Firebase's persisted heartbeat cache shape; see AGENTS.md "Vendor parity" table.
interface HeartbeatCacheEntry {
    lastSentHeartbeatDate?: string
    heartbeats: SingleDateHeartbeat[]
}

export interface InstallationStorageInterface {
    // Cleared when the installation is deleted, so reads can come back empty.
    installation?: InstallationEntry
    heartbeat: HeartbeatCacheEntry
}

// Mirrors the high-level HeartbeatServiceImpl flow; see AGENTS.md "Vendor parity" table.
class HeartbeatManager {
    readonly #app: FirebaseApp
    readonly #storage: StorageInterface<InstallationStorageInterface>

    constructor(app: FirebaseApp) {
        this.#app = app
        this.#storage = {
            get: (key) => app.storage.get(`installations.${key}`),
            set: (key, value) => app.storage.set(`installations.${key}`, value),
        }
    }

    // Upstream triggerHeartbeat() stores at most one heartbeat per UTC day and trims the
    // cache back to 30 entries by evicting the earliest date; see AGENTS.md "Vendor parity".
    trigger(): void {
        try {
            const heartbeatsCache = this.readHeartbeatsCache()
            const date = getUTCDateString()

            if (
                heartbeatsCache.lastSentHeartbeatDate === date
                || heartbeatsCache.heartbeats.some((heartbeat) => heartbeat.date === date)
            ) {
                return
            }

            heartbeatsCache.heartbeats.push({
                agent: HEARTBEAT_AGENT,
                date,
            })

            if (heartbeatsCache.heartbeats.length > MAX_NUM_STORED_HEARTBEATS) {
                const earliestHeartbeatIdx = getEarliestHeartbeatIdx(heartbeatsCache.heartbeats)
                heartbeatsCache.heartbeats.splice(earliestHeartbeatIdx, 1)
            }

            this.#storage.set('heartbeat', heartbeatsCache)
        } catch (error) {
            this.#app.logger.warn(error)
        }
    }

    // Upstream getHeartbeatsHeader() groups heartbeats by agent, base64url-encodes the
    // payload, stores lastSentHeartbeatDate, and keeps overflow entries queued; see AGENTS.md
    // "Vendor parity".
    getHeader(): string | undefined {
        try {
            const heartbeatsCache = this.readHeartbeatsCache()

            if (heartbeatsCache.heartbeats.length === 0) {
                return undefined
            }

            const { heartbeatsToSend, unsentEntries } = extractHeartbeatsForHeader(heartbeatsCache.heartbeats)
            const headerString = toBase64(Buffer.from(JSON.stringify({
                version: HEARTBEAT_VERSION,
                heartbeats: heartbeatsToSend,
            })))

            heartbeatsCache.lastSentHeartbeatDate = getUTCDateString()
            heartbeatsCache.heartbeats = unsentEntries
            this.#storage.set('heartbeat', heartbeatsCache)

            return headerString
        } catch (error) {
            this.#app.logger.warn(error)
            return undefined
        }
    }

    private readHeartbeatsCache(): HeartbeatCacheEntry {
        const heartbeatsCache = this.#storage.get('heartbeat')

        if (!heartbeatsCache || !Array.isArray(heartbeatsCache.heartbeats)) {
            return { heartbeats: [] }
        }

        return {
            lastSentHeartbeatDate: typeof heartbeatsCache.lastSentHeartbeatDate === 'string'
                ? heartbeatsCache.lastSentHeartbeatDate
                : undefined,
            heartbeats: heartbeatsCache.heartbeats.filter((heartbeat): heartbeat is SingleDateHeartbeat => {
                return typeof heartbeat?.agent === 'string' && typeof heartbeat?.date === 'string'
            }),
        }
    }
}

// Carries a machine-readable status so callers can tell an authoritative FIS rejection apart
// from a transient one; see AGENTS.md "Firebase Installations failure policy".
export class InstallationsRequestError extends Error {
    readonly status: number

    constructor(context: string, response: Response) {
        super(`${context} failed with status ${response.status} '${response.statusText}'`)
        this.name = 'InstallationsRequestError'
        this.status = response.status
    }
}

// 401/404 is the only authoritative "installation is gone" signal; everything else is
// treated as transient. See AGENTS.md "Firebase Installations failure policy".
function isInstallationInvalid(error: unknown): boolean {
    return error instanceof InstallationsRequestError && (error.status === 401 || error.status === 404)
}

export default class WebInstallations {
    static readonly #pendingInstallations = new WeakMap<FirebaseApp, Promise<InstallationEntry>>()
    // Per app, in memory only: the timestamp until which failed refreshes are not retried.
    static readonly #refreshCooldowns = new WeakMap<FirebaseApp, number>()

    readonly #app: FirebaseApp
    readonly #baseURL: string
    readonly #defaultHeaders: Record<string, string>
    readonly #storage: StorageInterface<InstallationStorageInterface>
    readonly #heartbeat: HeartbeatManager

    constructor(app: FirebaseApp) {
        assertRequiredProperties(app, [
            'credentials.apiKey',
            'credentials.appId',
            'credentials.projectId',
            'crypto.getRandomValues',
            'logger.debug',
            'logger.warn',
            'logger.error',
            'storage.get',
            'storage.set',
        ])

        this.#app = app
        this.#baseURL = `https://firebaseinstallations.googleapis.com/v1/projects/${this.#app.credentials.projectId}/installations`
        this.#defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept-Charset': 'application/json',
            'x-goog-api-key': this.#app.credentials.apiKey,
        }

        this.#storage = {
            get: (key) => this.#app.storage.get(`installations.${key}`),
            set: (key, value) => this.#app.storage.set(`installations.${key}`, value),
        }

        this.#heartbeat = new HeartbeatManager(this.#app)
    }

    // FIS sends expiresIn as a duration string, '604800s'. Returns NaN for anything this
    // cannot parse; callers reject such a response instead of storing it.
    static convertExpire(value: string) {
        return Number.parseInt(value, 10) * 1000
    }

    static isInstallationExpired(installation: InstallationEntry, margin = INSTALLATION_REFRESH_MARGIN) {
        if (!Number.isFinite(installation?.expiresAt)) {
            return true
        }

        // Backwards-clock guard: an entry can't legitimately outlive a fresh token by this
        // much. See AGENTS.md "Firebase Installations failure policy".
        if (installation.expiresAt - Date.now() > MAX_INSTALLATION_LIFETIME + INSTALLATION_REFRESH_MARGIN) {
            return true
        }

        return installation.expiresAt - margin <= Date.now()
    }

    private generateFid(): string {
        try {
            // A valid FID has exactly 22 base64 characters, which is 132 bits, or 16.5
            // bytes. our implementation generates a 17 byte array instead.
            const fidByteArray = new Uint8Array(17)
            this.#app.crypto.getRandomValues(fidByteArray)
    
            // Replace the first 4 random bits with the constant FID header of 0b0111.
            fidByteArray[0] = 0b01110000 + (fidByteArray[0] % 0b00010000)

            const b64 = Buffer.from(fidByteArray).toString('base64')
            const b64String = b64.replace(/\+/g, '-').replace(/\//g, '_')

            // Remove the 23rd character that was added because of the extra 4 bits at the
            // end of our 17 byte array, and the '=' padding.
            const fid = b64String.substring(0, 22)

            return VALID_FID_PATTERN.test(fid) ? fid : INVALID_FID
        } catch(err) {
            this.#app.logger.error(err as Error)
            // FID generation errored
            return INVALID_FID
        }
    }

    /**
     * API
     */

    // Firebase Installations attaches x-firebase-client on installation creation and auth
    // token generation requests, but not on delete; see AGENTS.md "Vendor parity" table.
    private getHeaders(options: { auth?: InstallationEntry, heartbeat?: boolean }): Record<string, string> {
        const headers: Record<string, string> = {}

        if (options.auth) {
            headers.Authorization = `${AUTH_VERSION} ${options.auth.refreshToken}`
        }

        if (options.heartbeat) {
            const heartbeatsHeader = this.#heartbeat.getHeader()

            if (heartbeatsHeader) {
                headers['x-firebase-client'] = heartbeatsHeader
            }
        }

        return headers
    }

    // Requests a replacement installation without reading or writing storage, so a failed
    // request can never lose credentials that still work.
    async #requestNewInstallation(): Promise<InstallationEntry> {
        // An empty fid asks FIS to allocate one, so the response is the only source for it
        // in that case. Firebase keeps the requested fid when the response omits it; see
        // AGENTS.md "Vendor parity" table.
        const requestedFid = this.generateFid()

        const response = await fetchWithRetry(this.#baseURL, {
            method: 'POST',
            headers: { ...this.#defaultHeaders, ...this.getHeaders({ heartbeat: true }) },
            body: JSON.stringify({
                fid: requestedFid,
                authVersion: AUTH_VERSION,
                appId: this.#app.credentials.appId,
                sdkVersion: SDK_VERSION,
            }),
        })

        if (!response.ok) {
            throw new InstallationsRequestError('Installation creation', response)
        }

        const data = await response.json()
        const authToken = parseAuthTokenResponse(data?.authToken, 'Installation creation')

        // A missing fid or refreshToken only surfaces days later, as a refresh that can
        // never succeed, so reject the response now instead of storing it.
        const newInstallation: InstallationEntry = {
            fid: assertNonEmptyString(data?.fid || requestedFid, 'fid', 'Installation creation'),
            refreshToken: assertNonEmptyString(data?.refreshToken, 'refreshToken', 'Installation creation'),
            authToken: authToken.token,
            expiresAt: authToken.expiresAt,
        }

        return newInstallation
    }

    async #create({ replace = false }: { replace?: boolean } = {}): Promise<InstallationEntry> {
        if (!replace && this.#storage.get('installation')) {
            throw new Error('Installation already exists')
        }

        const newInstallation = await this.#requestNewInstallation()

        this.#storage.set('installation', newInstallation)

        return newInstallation
    }

    private async refresh(fid: string): Promise<InstallationEntry> {
        const installation = this.#storage.get('installation')

        if (!installation) {
            throw new Error(`Installation with fid '${fid}' not found`)
        }

        const response = await fetchWithRetry(`${this.#baseURL}/${installation.fid}/authTokens:generate`, {
            method: 'POST',
            headers: { ...this.#defaultHeaders, ...this.getHeaders({ auth: installation, heartbeat: true }) },
            body: JSON.stringify({
                installation: {
                    sdkVersion: SDK_VERSION,
                    appId: this.#app.credentials.appId,
                },
            }),
        })

        if (!response.ok) {
            this.#app.logger.debug(response)
            throw new InstallationsRequestError('Installation refresh', response)
        }

        const newToken = parseAuthTokenResponse(await response.json(), 'Installation refresh')

        const newInstallation: InstallationEntry = {
            ...installation,
            authToken: newToken.token,
            expiresAt: newToken.expiresAt,
        }

        this.#storage.set('installation', newInstallation)

        return newInstallation
    }

    private async delete(fid: string): Promise<void> {
        const installation = this.#storage.get('installation')

        if (!installation) {
            throw new Error(`Installation with fid '${fid}' not found`)
        }

        const response = await fetchWithRetry(`${this.#baseURL}/${installation.fid}`, {
            method: 'DELETE',
            headers: { ...this.#defaultHeaders, ...this.getHeaders({ auth: installation }) },
        })

        if (!response.ok) {
            this.#app.logger.debug(response)
            throw new InstallationsRequestError('Installation deletion', response)
        }

        // FIS does not know this installation anymore, so keeping the entry would hand out a
        // dead auth token until it expires.
        this.#storage.set('installation', undefined)
    }

    /**
     * Methods
     */

    // Reads the stored fid without contacting FIS. Undefined when nothing is stored.
    get storedFid(): string | undefined {
        return this.#storage.get('installation')?.fid
    }

    async getInstallation(): Promise<InstallationEntry> {
        this.#heartbeat.trigger()

        const pendingInstallation = WebInstallations.#pendingInstallations.get(this.#app)

        if (pendingInstallation) {
            return pendingInstallation
        }

        const installationPromise = this.#getInstallation()
        WebInstallations.#pendingInstallations.set(this.#app, installationPromise)

        try {
            return await installationPromise
        } finally {
            if (WebInstallations.#pendingInstallations.get(this.#app) === installationPromise) {
                WebInstallations.#pendingInstallations.delete(this.#app)
            }
        }
    }

    async #getInstallation(): Promise<InstallationEntry> {
        const installation = this.#storage.get('installation')

        // Does not exist. A fresh installation always carries a fresh auth token, so there
        // is nothing to refresh afterwards.
        if (!installation) {
            return this.#create()
        }

        // Not expired
        if (!WebInstallations.isInstallationExpired(installation)) {
            return installation
        }

        if (this.#isRefreshOnCooldown() && this.#isUsableNow(installation)) {
            return installation
        }

        try {
            return await this.refresh(installation.fid)
        } catch (error) {
            if (isInstallationInvalid(error)) {
                // Request the replacement first and overwrite storage only on success, so a
                // failed creation cannot lose credentials that still work.
                this.#app.logger.warn('FIS rejected the stored installation, creating a new one', error)
                return this.#create({ replace: true })
            }

            this.#startRefreshCooldown()

            // Transient/unknown failure: serve the stored token while it is genuinely still
            // usable. See AGENTS.md "Firebase Installations failure policy".
            if (this.#isUsableNow(installation)) {
                this.#app.logger.warn('FIS refresh failed, using the stored auth token until it expires', error)
                return installation
            }

            throw error
        }
    }

    #isUsableNow(installation: InstallationEntry): boolean {
        return !WebInstallations.isInstallationExpired(installation, INSTALLATION_MIN_USABLE_MS)
    }

    #isRefreshOnCooldown(): boolean {
        const cooldownUntil = WebInstallations.#refreshCooldowns.get(this.#app)

        return cooldownUntil !== undefined && cooldownUntil > Date.now()
    }

    #startRefreshCooldown(): void {
        WebInstallations.#refreshCooldowns.set(this.#app, Date.now() + INSTALLATION_REFRESH_COOLDOWN_MS)
    }

    async deleteInstallation(): Promise<void> {
        this.#heartbeat.trigger()

        const installation = this.#storage.get('installation')

        if (installation) {
            return this.delete(installation.fid)
        }
    }

    /** @deprecated Use deleteInstallation instead. */
    async deleteInstalation(): Promise<void> {
        return this.deleteInstallation()
    }
}

function assertNonEmptyString(value: unknown, field: string, context: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${context} returned no usable ${field}`)
    }

    return value
}

interface AuthTokenResponse {
    token?: string
    expiresIn?: string
}

// FIS can answer with a body that has no token, or an expiry this cannot parse. Reject it
// here instead of storing it: an undefined token would overwrite a merely expired one, and
// a NaN expiry would make isInstallationExpired() report the entry as valid forever.
function parseAuthTokenResponse(authToken: AuthTokenResponse | undefined, context: string): { token: string, expiresAt: number } {
    const token = authToken?.token
    const expiresIn = WebInstallations.convertExpire(authToken?.expiresIn as string)

    if (typeof token !== 'string' || token.length === 0 || !Number.isFinite(expiresIn) || expiresIn <= 0) {
        throw new Error(`${context} returned an unusable auth token (token ${token ? 'present' : 'missing'}, expiresIn ${authToken?.expiresIn})`)
    }

    return { token, expiresAt: Date.now() + expiresIn }
}

// Firebase uses a YYYY-MM-DD UTC key for heartbeat deduplication; see AGENTS.md "Vendor
// parity" table.
function getUTCDateString(): string {
    return new Date().toISOString().substring(0, 10)
}

// Groups single-date heartbeat entries by agent until the encoded header would exceed the
// upstream 1024-byte cap, leaving the rest queued for a later request; see AGENTS.md "Vendor
// parity" table.
function extractHeartbeatsForHeader(
    heartbeatsCache: SingleDateHeartbeat[],
    maxSize = MAX_HEADER_BYTES,
): { heartbeatsToSend: HeartbeatsByUserAgent[], unsentEntries: SingleDateHeartbeat[] } {
    const heartbeatsToSend: HeartbeatsByUserAgent[] = []
    let unsentEntries = heartbeatsCache.slice()

    for (const singleDateHeartbeat of heartbeatsCache) {
        const heartbeatEntry = heartbeatsToSend.find((heartbeat) => heartbeat.agent === singleDateHeartbeat.agent)

        if (!heartbeatEntry) {
            heartbeatsToSend.push({
                agent: singleDateHeartbeat.agent,
                dates: [singleDateHeartbeat.date],
            })

            if (countBytes(heartbeatsToSend) > maxSize) {
                heartbeatsToSend.pop()
                break
            }
        } else {
            heartbeatEntry.dates.push(singleDateHeartbeat.date)

            if (countBytes(heartbeatsToSend) > maxSize) {
                heartbeatEntry.dates.pop()
                break
            }
        }

        unsentEntries = unsentEntries.slice(1)
    }

    return {
        heartbeatsToSend,
        unsentEntries,
    }
}

// Upstream measures the encoded heartbeat header size after wrapping { version, heartbeats }
// and base64url-encoding it; see AGENTS.md "Vendor parity" table.
function countBytes(heartbeatsCache: HeartbeatsByUserAgent[]): number {
    return toBase64(Buffer.from(JSON.stringify({
        version: HEARTBEAT_VERSION,
        heartbeats: heartbeatsCache,
    }))).length
}

// Upstream evicts the earliest stored heartbeat when the cache grows past 30 entries; see
// AGENTS.md "Vendor parity" table.
function getEarliestHeartbeatIdx(heartbeats: SingleDateHeartbeat[]): number {
    if (heartbeats.length === 0) {
        return -1
    }

    let earliestHeartbeatIdx = 0
    let earliestHeartbeatDate = heartbeats[0].date

    for (let i = 1; i < heartbeats.length; i++) {
        if (heartbeats[i].date < earliestHeartbeatDate) {
            earliestHeartbeatDate = heartbeats[i].date
            earliestHeartbeatIdx = i
        }
    }

    return earliestHeartbeatIdx
}
