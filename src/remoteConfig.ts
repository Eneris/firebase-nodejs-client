import { EventEmitter } from 'eventemitter3'
import fetchWithRetry from './utils/fetch'
import { emitSafely } from './utils/emit'
import { raceAbort } from './utils/abort'
import { HttpRequestError, isTransientError } from './utils/errors'
import Value from './utils/value'
import FirebaseApp, { StorageInterface, assertRequiredProperties } from './app'
import type Installations from './installations'

const SDK_VERSION = 'w:0.3.11'
const DEFAULT_FETCH_TIMEOUT_MILLIS = 60 * 1000 // One minute
const DEFAULT_CACHE_MAX_AGE_MILLIS = 12 * 60 * 60 * 1000 // Twelve hours.
// First delay of the background retry after a failed scheduled fetch; doubles per failure, up
// to cacheMaxAge. Library-own policy: firebase-js-sdk has no background fetch loop to mirror.
const BACKGROUND_RETRY_BASE_MILLIS = 60 * 1000 // One minute.

export interface RemoteConfigOptions<T> {
    fetchTimeout?: number
    cacheMaxAge?: number
    languageCode?: string
    defaultConfig?: T
}

export interface FetchResult<T> {
    status?: number
    etag: string
    config: T
}

interface RemoteConfigEvents {
    fetch: () => void
    activate: () => void
}

export interface RemoteConfigStore<T> {
    lastFetchTimestamp: number,
    etag: string
    config: T
}

export default class RemoteConfig<T = Record<string, string>> extends EventEmitter<RemoteConfigEvents> {
    readonly #app: FirebaseApp
    readonly #installations: Installations
    readonly #options: RemoteConfigOptions<T>
    readonly #storage: StorageInterface<RemoteConfigStore<T>>
    readonly #baseURL: string
    #refreshTimer: NodeJS.Timeout | null = null
    #semaphoreFetch: Promise<void> | null = null
    #fetchAbortController: AbortController | null = null
    #backgroundRetryTimer: NodeJS.Timeout | null = null
    #backgroundRetryCount = 0
    #destroyed = false

    constructor(app: FirebaseApp, options: RemoteConfigOptions<T> = {}) {
        super()

        assertRequiredProperties(app, [
            'credentials.apiKey',
            'credentials.appId',
            'credentials.projectId',
            'logger.error',
            'logger.warn',
            'storage.get',
            'storage.set',
        ])

        this.#options = {
            ...options,
            languageCode: options.languageCode || 'en-GB',
            fetchTimeout: options.fetchTimeout ?? DEFAULT_FETCH_TIMEOUT_MILLIS,
            cacheMaxAge: options.cacheMaxAge ?? DEFAULT_CACHE_MAX_AGE_MILLIS,
            defaultConfig: options.defaultConfig || {} as T,
        }

        this.#app = app
        this.#installations = this.#app.installations
        this.#baseURL = `https://firebaseremoteconfig.googleapis.com/v1/projects/${this.#app.credentials.projectId}/namespaces/firebase`

        this.#storage = {
            get: (key) => this.#app.storage.get(`remote_config.${key}`),
            set: (key, value) => this.#app.storage.set(`remote_config.${key}`, value),
        } as StorageInterface<RemoteConfigStore<T>>

        this.#backgroundFetch()

        if (this.#options.cacheMaxAge) {
            this.#refreshTimer = setInterval(() => this.#backgroundFetch(), this.#options.cacheMaxAge + 1000)
        }
    }

    destroy() {
        this.#destroyed = true
        this.#fetchAbortController?.abort()
        this.#fetchAbortController = null

        if (this.#refreshTimer !== null) {
            clearInterval(this.#refreshTimer)
        }
        this.#refreshTimer = null
        this.#clearBackgroundRetry()
    }

    // The fetches this class starts on its own: at construction and every cacheMaxAge. A failed
    // one is retried on a doubling delay, so a fetch that failed (offline start, a timed out
    // installation request) is not left until the next interval, hours later. A fetch the
    // caller started is the caller's to retry.
    #backgroundFetch(): void {
        this.#clearBackgroundRetry()
        void this.fetchAndActivate().catch((error) => this.#handleBackgroundError(error))
    }

    #clearBackgroundRetry(): void {
        if (this.#backgroundRetryTimer !== null) {
            clearTimeout(this.#backgroundRetryTimer)
        }
        this.#backgroundRetryTimer = null
    }

    #handleBackgroundError(error: unknown): void {
        if (this.#destroyed) {
            return
        }

        if (isTransientError(error)) {
            this.#app.logger.warn('RemoteConfig background fetch failed, retrying later', error)
        } else {
            this.#app.logger.error(error as Error)
        }

        const maxDelay = this.#options.cacheMaxAge || DEFAULT_CACHE_MAX_AGE_MILLIS
        const delay = Math.min(BACKGROUND_RETRY_BASE_MILLIS * 2 ** this.#backgroundRetryCount, maxDelay)

        // Two background fetches that joined the same failed request both land here: keep one
        // retry.
        this.#clearBackgroundRetry()
        this.#backgroundRetryCount++
        this.#backgroundRetryTimer = setTimeout(() => this.#backgroundFetch(), delay)
    }

    set defaultConfig(defaultConfig: RemoteConfigOptions<T>['defaultConfig']) {
        this.#options.defaultConfig = defaultConfig
    }

    get defaultConfig() {
        return this.#options.defaultConfig
    }

    get isCacheValid() {
        const cacheAge = Date.now() - (this.#storage.get('lastFetchTimestamp') || 0)

        return this.#storage.get('config') && cacheAge < this.#options.cacheMaxAge!
    }

    private get activeConfig() {
        return this.#storage.get('config')
    }

    getValue<K extends keyof T>(key: K): Value {
        const config = this.activeConfig

        // Has remote version
        if (config && config[key] !== undefined) {
            return new Value('remote', config[key] as string)
        }

        const defaultConfig = this.defaultConfig

        // Has default version
        if (defaultConfig && defaultConfig[key] !== undefined) {
            // Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/remote-config/src/api.ts
            // upstream `getValue` wraps a non-string default in `String(...)` before handing it
            // to `Value`, so a boolean/number default behaves like any other Value.
            // An object/array default is JSON-encoded instead, because `String(...)` would
            // turn it into "[object Object]" or "1,2" and `asJSON()` could not recover it.
            const raw = defaultConfig[key]
            const value = typeof raw === 'string' ? raw : raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
            return new Value('default', value)
        }
        
        // Not found, return static
        return new Value('static')
    }

    getAll(): Record<string, Value> {
        const config = {
            ...(this.activeConfig || {}),
            ...(this.defaultConfig || {}),
        }

        return Object.keys(config).reduce((result, key) => {
            result[key] = this.getValue(key as keyof T)

            return result
        }, {} as Record<string, Value>)
    }

    getAllConverted(): T {
        const config = this.getAll()

        Object.keys(config).forEach((key) => {
            config[key] = config[key].asConverted()
        })

        return config as T
    }

    async fetchAndActivate(ignoreCache = false): Promise<void> {
        if (this.#destroyed) {
            throw new Error('RemoteConfig has been destroyed')
        }

        if (!ignoreCache && this.isCacheValid) {
            emitSafely(this, this.#app.logger, 'fetch')
            return
        }

        if (this.#semaphoreFetch) {
            return this.#semaphoreFetch;
        }

        this.#semaphoreFetch = this.#fetchAndActivate()

        try {
            await this.#semaphoreFetch
            // Any successful fetch makes a pending background retry pointless.
            this.#backgroundRetryCount = 0
            this.#clearBackgroundRetry()
        } finally {
            this.#semaphoreFetch = null
            this.#fetchAbortController = null
        }
    }

    async #fetchAndActivate(): Promise<void> {
        const etag = this.#storage.get('etag')

        // Built before the installation wait, so fetchTimeout and destroy() bound the whole
        // call, not just the Remote Config request. The installation request itself is shared
        // with other callers and is left running.
        this.#fetchAbortController = new AbortController()
        const signals = [this.#fetchAbortController.signal]

        if (this.#options.fetchTimeout) {
            signals.push(AbortSignal.timeout(this.#options.fetchTimeout))
        }

        const signal = AbortSignal.any(signals)
        const installation = await raceAbort(this.#installations.getInstallation(), signal)

        const url = new URL(`${this.#baseURL}/:fetch`)
        url.searchParams.append('key', this.#app.credentials.apiKey)

        const response = await fetchWithRetry(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
                'Accept-Encoding': 'gzip',
                'If-None-Match': etag || '*',
            },
            body: JSON.stringify({
                sdk_version: SDK_VERSION,
                app_instance_id: installation.fid,
                app_instance_id_token: installation.authToken,
                app_id: this.#app.credentials.appId,
                language_code: this.#options.languageCode,
            }),
            signal,
        })

        let status = response.status
        let data: any

        if (status !== 304) {
            try {
                data = await response.json()
            } catch (error) {
                // Source: https://github.com/firebase/firebase-js-sdk/blob/main/packages/remote-config/src/client/rest_client.ts
                // upstream throws ErrorCode.FETCH_PARSE on an unparseable body instead of
                // continuing with `config = undefined`, which would wipe the active config.
                throw new Error(`Failed to parse RemoteConfig response: FETCH_PARSE (${(error as Error)?.message})`, { cause: error })
            }
        }

        const responseEtag = response.headers.get('etag') ?? undefined

        let config = data?.entries

        if (data?.state) {
            switch (data?.state) {
                case 'UPDATE':
                    status = 200
                    break
                case 'INSTANCE_STATE_UNSPECIFIED':
                    status = 500
                    break
                case 'NO_CHANGE':
                    status = 304
                    break
                case 'NO_TEMPLATE':
                case 'EMPTY_CONFIG':
                    config = {}
                    break
                default:
                    this.#app.logger.warn('Unknown remoteConfig data state:', data?.state)
            }
        }

        emitSafely(this, this.#app.logger, 'fetch')

        switch(status) {
            case 200:
                this.#storage.set('config', config)
                this.#storage.set('etag', responseEtag ?? '')
                this.#storage.set('lastFetchTimestamp', Date.now())
                // Last, once everything the fetch stores is in place: a listener that throws
                // is logged and cannot fail the fetch or skip a write.
                emitSafely(this, this.#app.logger, 'activate')
                break
            case 304:
                this.#storage.set('lastFetchTimestamp', Date.now())
                break
            default:
                // Typed so a 429/5xx counts as transient (utils/errors.ts isTransientError).
                throw new HttpRequestError(status, response.statusText, `Failed to fetch RemoteConfig status: ${status}`)

        }
    }
}
