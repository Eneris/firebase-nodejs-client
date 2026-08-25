import { EventEmitter } from 'eventemitter3'
import fetchWithRetry from './utils/fetch'
import Value from './utils/value'
import FirebaseApp, { StorageInterface, assertRequiredProperties } from './app'
import type Installations from './installations'

const SDK_VERSION = 'w:0.3.11'
const DEFAULT_FETCH_TIMEOUT_MILLIS = 60 * 1000 // One minute
const DEFAULT_CACHE_MAX_AGE_MILLIS = 12 * 60 * 60 * 1000 // Twelve hours.

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
    #destroyed = false

    constructor(app: FirebaseApp, options: RemoteConfigOptions<T> = {}) {
        super()

        assertRequiredProperties(app, [
            'credentials.apiKey',
            'credentials.appId',
            'credentials.projectId',
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

        void this.fetchAndActivate().catch((error) => this.#handleBackgroundError(error))

        if (this.#options.cacheMaxAge) {
            this.#refreshTimer = setInterval(() => {
                void this.fetchAndActivate().catch((error) => this.#handleBackgroundError(error))
            }, this.#options.cacheMaxAge + 1000)
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
    }

    #handleBackgroundError(error: unknown): void {
        if (!this.#destroyed) {
            this.#app.logger.error(error as Error)
        }
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
            return new Value('default', defaultConfig[key] as string)
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
            this.emit('fetch')
            return
        }

        if (this.#semaphoreFetch) {
            return this.#semaphoreFetch;
        }

        this.#semaphoreFetch = this.#fetchAndActivate()

        try {
            await this.#semaphoreFetch
        } finally {
            this.#semaphoreFetch = null
            this.#fetchAbortController = null
        }
    }

    async #fetchAndActivate(): Promise<void> {
        const etag = this.#storage.get('etag')

        const installation = await this.#installations.getInstallation()

        const url = new URL(`${this.#baseURL}/:fetch`)
        url.searchParams.append('key', this.#app.credentials.apiKey)

        this.#fetchAbortController = new AbortController()
        const signals = [this.#fetchAbortController.signal]

        if (this.#options.fetchTimeout) {
            signals.push(AbortSignal.timeout(this.#options.fetchTimeout))
        }

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
            signal: AbortSignal.any(signals),
        })

        let status = response.status
        let data: any

        if (status !== 304) {
            try {
                data = await response.json()
            } catch {
                data = undefined
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

        this.emit('fetch')

        switch(status) {
            case 200:
                this.#storage.set('config', config)
                this.#storage.set('etag', responseEtag ?? '')
                this.emit('activate')
            // eslint-disable-line-rule: no-fallthrough
            case 304:
                this.#storage.set('lastFetchTimestamp', Date.now())
                break
            default:
                throw new Error(`Failed to fetch RemoteConfig status: ${status}`)

        }
    }
}
