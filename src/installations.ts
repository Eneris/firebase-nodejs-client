import fetchWithRetry from './utils/fetch'
import FirebaseApp, { Logger, StorageInterface, assertRequiredProperties } from './app'
import { toBase64 } from './utils/base64'

const AUTH_VERSION = 'FIS_v2'
const CLIENT_VERSION  = '0.6.6'
const SDK_VERSION = `w:${CLIENT_VERSION}`
const VALID_FID_PATTERN = /^[cdef][\w-]{21}$/
const INVALID_FID = ''

// Firebase heartbeat limits and payload version come from the app heartbeat service.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
const BUILD_TARGET = 'cjs'
const MAX_HEADER_BYTES = 1024
const MAX_NUM_STORED_HEARTBEATS = 30
const HEARTBEAT_VERSION = 2

// Firebase builds the platform logger string dynamically from registerVersion() entries.
// This local constant is a Node/CommonJS approximation, not a verbatim upstream literal.
// Sources:
// https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/registerCoreComponents.ts
// https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/platformLoggerService.ts
const HEARTBEAT_AGENT = [
    `fire-core/${CLIENT_VERSION}`,
    `fire-core-${BUILD_TARGET}/${CLIENT_VERSION}`,
    'fire-js/',
    `fire-installations/${SDK_VERSION.slice(2)}`,
    `fire-installations-${BUILD_TARGET}/${SDK_VERSION.slice(2)}`,
].join(' ')

export interface AuthToken {
    readonly token: string
    readonly creationTime: number
    readonly expiresIn: number
}

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

// Mirrors Firebase's persisted heartbeat cache shape, but stored through this library's
// storage abstraction instead of IndexedDB.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/types.ts
interface HeartbeatCacheEntry {
    lastSentHeartbeatDate?: string
    heartbeats: SingleDateHeartbeat[]
}

export interface InstallationStorageInterface {
    installation: InstallationEntry
    heartbeat: HeartbeatCacheEntry
}

export interface WebInstallationsOptions {
    h?: unknown
}

// Mirrors the high-level HeartbeatServiceImpl flow, but uses app.storage instead of
// HeartbeatStorageImpl/IndexedDB.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
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
    // cache back to 30 entries by evicting the earliest date.
    // Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
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
    // payload, stores lastSentHeartbeatDate, and keeps overflow entries queued.
    // Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
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

export default class WebInstallations {
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

    static convertExpire(value: string) {
        return Number(value.replace('s', '000'))
    }

    static isInstallationExpired(installation: InstallationEntry) {
        return installation.expiresAt <= Date.now()
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
    // token generation requests, but not on delete.
    // Sources:
    // https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/functions/create-installation-request.ts
    // https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/functions/generate-auth-token-request.ts
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

    async #create(): Promise<InstallationEntry> {
        if (this.#storage.get('installation')) {
            throw new Error('Installation already exists')
        }

        const response = await fetchWithRetry(this.#baseURL, {
            method: 'POST',
            headers: { ...this.#defaultHeaders, ...this.getHeaders({ heartbeat: true }) },
            body: JSON.stringify({
                fid: this.generateFid(),
                authVersion: AUTH_VERSION,
                appId: this.#app.credentials.appId,
                sdkVersion: SDK_VERSION,
            }),
        })

        const data = await response.json()

        const newInstallation: InstallationEntry = {
            fid: data.fid,
            refreshToken: data.refreshToken,
            authToken: data.authToken.token,
            expiresAt: Date.now() + WebInstallations.convertExpire(data.authToken.expiresIn),
        }

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
            throw new Error(`Installation refresh failed with status ${response.status} '${response.statusText}'`)
        }

        const newToken = await response.json()

        const newInstallation: InstallationEntry = {
            ...installation,
            authToken: newToken.token,
            expiresAt: Date.now() + WebInstallations.convertExpire(newToken.expiresIn),
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
            throw new Error(`Installation deletion failed with status ${response.status} '${response.statusText}'`)
        }
    }

    /**
     * Methods
     */

    async getInstallation(): Promise<InstallationEntry> {
        this.#heartbeat.trigger()

        let installation: InstallationEntry = this.#storage.get('installation')

        // Does not exist
        if (!installation) {
            installation = await this.#create()
        }

        // Expired
        if (WebInstallations.isInstallationExpired(installation)) {
            installation = await this.refresh(installation.fid)
        }

        return installation
    }

    async deleteInstalation(): Promise<void> {
        this.#heartbeat.trigger()

        const installation: InstallationEntry = this.#storage.get('installation')

        if (installation) {
            return this.delete(installation.fid)
        }
    }
}

// Firebase uses a YYYY-MM-DD UTC key for heartbeat deduplication.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
function getUTCDateString(): string {
    return new Date().toISOString().substring(0, 10)
}

// Groups single-date heartbeat entries by agent until the encoded header would exceed the
// upstream 1024-byte cap, leaving the rest queued for a later request.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
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
// and base64url-encoding it.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
function countBytes(heartbeatsCache: HeartbeatsByUserAgent[]): number {
    return toBase64(Buffer.from(JSON.stringify({
        version: HEARTBEAT_VERSION,
        heartbeats: heartbeatsCache,
    }))).length
}

// Upstream evicts the earliest stored heartbeat when the cache grows past 30 entries.
// Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts
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
