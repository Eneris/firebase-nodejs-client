import fetchWithRetry from './utils/fetch'
import Installations from './installations'
import FirebaseApp, { StorageInterface, assertRequiredProperties } from './app'

/**
 * Same endpoint gtag.js uses in the browser — no api_secret required.
 * Params are URL-encoded query parameters (v=2, tid=, cid=, en=, ep.*, epn.*, …).
 */
const GTAG_COLLECT_ENDPOINT = 'https://www.google-analytics.com/g/collect'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// Matches the User-Agent sent by Chrome on macOS — required for GA4 to accept hits from this endpoint.
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ─── Public types (mirrors the web SDK) ──────────────────────────────────────

/**
 * Initialization options for {@link initializeAnalytics}.
 * @public
 */
export interface AnalyticsOptions {
    app: FirebaseApp
    installations?: Installations
    /**
     * When `true`, the `_dbg=1` parameter is appended to every hit, making
     * events visible in the GA4 DebugView — identical to gtag's debug mode.
     */
    debug?: boolean
}

/**
 * Standard GA4 event parameters.
 * Mirrors `EventParams` from the web SDK.
 * @public
 */
export interface EventParams {
    [key: string]: any
}

/**
 * Custom params attached to every event.
 * Mirrors `CustomParams` from the web SDK.
 * @public
 */
export interface CustomParams {
    [key: string]: unknown
}

// ─── Internal ─────────────────────────────────────────────────────────────────

interface AnalyticsStorageSchema {
    clientId: string
    sessionId: string
    sessionCount: number
    lastEventTime: number
}

// ─── Client class ────────────────────────────────────────────────────────────

/**
 * @public
 * @example
 * const analytics = new AnalyticsClient(app)
 *
 * analytics.setDefaultEventParameters({ app_version: '1.0.0' })
 * analytics.setUserId('user-123')
 * await analytics.logEvent('page_view', { page_title: 'Home' })
 * const clientId = await analytics.getGoogleAnalyticsClientId()
 */
export default class AnalyticsClient {
    readonly #app: FirebaseApp
    readonly #debug: boolean
    readonly #installations: Installations
    readonly #storage: StorageInterface<AnalyticsStorageSchema>

    /** Merged into every event hit — see {@link setDefaultEventParameters}. */
    defaultEventParams: CustomParams = {}
    /** Included as `uid` in every event hit — see {@link setUserId}. */
    userId: string | null = null
    /** Included as `up.*`/`upn.*` in every event hit — see {@link setUserProperties}. */
    userProperties: CustomParams = {}
    /** Per-session hit counter (`_s`), mirrors browser behaviour. */
    private hitCount = 0

    constructor(options: AnalyticsOptions) {
        assertRequiredProperties(options.app, [
            'credentials.appId',
            'credentials.authDomain',
            'credentials.measurementId',
            'logger.debug',
            'logger.warn',
            'storage.get',
            'storage.set',
        ])
        const installations = options.installations ?? options.app.installations
        assertRequiredProperties(installations, ['getInstallation'], 'options.installations')

        this.#app = options.app
        this.#debug = options.debug ?? false
        this.#installations = installations

        this.#storage = {
            get: (key) => this.#app.storage.get(`analytics.${key}`),
            set: (key, value) => this.#app.storage.set(`analytics.${key}`, value),
        }
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    private nextHitCount(): number {
        return ++this.hitCount
    }

    /**
     * Builds the query-param payload that gtag.js sends to `g/collect`.
     *
     * String values  → `ep.<key>=<value>`
     * Numeric values → `epn.<key>=<value>`
     * User props (str)  → `up.<key>=<value>`
     * User props (num)  → `upn.<key>=<value>`
     */
    private getOrCreateSession(): { sessionId: string, sessionCount: number } {
        let sessionId = this.#storage.get('sessionId')
        let sessionCount = this.#storage.get('sessionCount') ?? 0
        const now = Date.now()
        const lastEventTime = this.#storage.get('lastEventTime') ?? 0

        if (!sessionId || now - lastEventTime >= SESSION_TIMEOUT_MS) {
            sessionId = String(Math.floor(Date.now() / 1000))
            sessionCount = sessionCount + 1
            this.#storage.set('sessionId', sessionId)
            this.#storage.set('sessionCount', sessionCount)
        }

        this.#storage.set('lastEventTime', now)

        return { sessionId, sessionCount }
    }

    private buildParams(
        clientId: string,
        fid: string,
        eventName: string,
        eventParams: CustomParams,
    ): URLSearchParams {
        const p = new URLSearchParams()
        const { sessionId, sessionCount } = this.getOrCreateSession()

        // ── Base params (identical to what gtag.js sends) ──
        p.set('v', '2')
        p.set('tid', this.#app.credentials.measurementId)
        p.set('cid', clientId)
        p.set('_fid', fid)
        // Random page-load hash — gtag generates this once per page load
        p.set('_p', String(Math.floor(Math.random() * 2147483647)))
        p.set('_s', String(this.nextHitCount()))

        // ── Session params — required for DebugView ──
        p.set('sid', sessionId)
        p.set('sct', String(sessionCount))
        p.set('seg', '1')

        // ── Document context — GA4 uses this for property/stream matching ──
        p.set('dl', `https://${this.#app.credentials.authDomain}/`)
        p.set('dr', '')

        if (this.userId) p.set('uid', this.userId)
        if (this.#debug)  p.set('_dbg', '1')

        // ── Event ──
        p.set('en', eventName)

        // ── Event parameters ──
        const merged: CustomParams = { ...this.defaultEventParams, ...eventParams }
        for (const [key, value] of Object.entries(merged)) {
            if (value === null || value === undefined) continue
            if (typeof value === 'number') {
                p.set(`epn.${key}`, String(value))
            } else {
                p.set(`ep.${key}`, String(value))
            }
        }

        // ── User properties ──
        for (const [key, value] of Object.entries(this.userProperties)) {
            if (value === null || value === undefined) continue
            if (typeof value === 'number') {
                p.set(`upn.${key}`, String(value))
            } else {
                p.set(`up.${key}`, String(value))
            }
        }

        return p
    }

    private async collect(eventName: string, eventParams: CustomParams = {}): Promise<void> {
        const clientId = await this.getGoogleAnalyticsClientId()
        const fid = clientId

        const params = this.buildParams(clientId, fid, eventName, eventParams)
        const url = `${GTAG_COLLECT_ENDPOINT}?${params.toString()}`

        if (this.#debug) {
            this.#app.logger.debug(`Analytics: → POST ${GTAG_COLLECT_ENDPOINT}`)
            this.#app.logger.debug('Analytics: payload', Object.fromEntries(params))
        }

        // GA4 filters the g/collect endpoint by User-Agent and Origin — spoof a real browser.
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'User-Agent': BROWSER_USER_AGENT,
                'Origin': `https://${this.#app.credentials.authDomain}`,
                'Referer': `https://${this.#app.credentials.authDomain}/`,
                'Content-Type': 'text/plain;charset=UTF-8',
            },
        })

        if (this.#debug) {
            const body = await response.text()
            this.#app.logger.debug(`Analytics: ← HTTP ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`)
        }

        if (!response.ok) {
            this.#app.logger.warn(`Analytics: collect request failed with HTTP ${response.status}`)
        }
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Sends a Google Analytics event via the same `g/collect` endpoint as gtag.js,
     * with browser-spoofed headers so GA4 does not filter the hit as bot traffic.
     *
     * @param eventName   - GA4 event name.
     * @param eventParams - Optional event parameters.
     * @example
     * await analytics.logEvent('page_view', { page_title: 'Home' })
     * await analytics.logEvent('purchase', { transaction_id: 'T123', value: 9.99, currency: 'USD' })
     */
    async logEvent(eventName: string, eventParams?: EventParams): Promise<void> {
        await this.collect(eventName, eventParams)
    }

    /**
     * Stores the user ID so it is sent with every subsequent event. Pass `null` to clear.
     */
    setUserId(id: string | null): void {
        this.userId = id
    }

    /**
     * Stores user properties so they are sent with every subsequent event.
     */
    setUserProperties(properties: CustomParams): void {
        this.userProperties = { ...properties }
    }

    async getGoogleAnalyticsClientId(): Promise<string> {
        const stored = this.#storage.get('clientId')
        if (stored) return stored

        let clientId: string
        try {
            const installation = await this.#installations.getInstallation()
            clientId = installation.fid
        } catch {
            this.#app.logger.warn('Analytics: could not retrieve FID, generating fallback client ID')
            clientId = `${Date.now()}.${Math.random().toString(36).slice(2)}`
        }

        this.#storage.set('clientId', clientId)
        return clientId
    }

    /**
     * Merges `customParams` into every subsequent event. Pass `{}` to clear.
     */
    setDefaultEventParameters(customParams: CustomParams): void {
        this.defaultEventParams = { ...customParams }
    }
}
