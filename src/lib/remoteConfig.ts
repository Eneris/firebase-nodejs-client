import { EventEmitter } from 'eventemitter3'
import fetchWithRetry from '../utils/fetch'
import Value from '../utils/value'
import Installations from './installations'
import FirebaseApp, { StorageInterface } from './app'

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
    private readonly app: FirebaseApp
    private readonly installations: Installations
    private readonly options: RemoteConfigOptions<T>
    private readonly storage: StorageInterface<RemoteConfigStore<T>>
    private readonly baseURL: string
    private refreshTimer: NodeJS.Timeout
    private semaphoreFetch: Promise<void>

    constructor(app: FirebaseApp, options: RemoteConfigOptions<T> = {}) {
        super()

        if (!app?.credentials?.appId) throw new TypeError(`Invalid app parameter`)

        this.options = {
            ...options,
            languageCode: options.languageCode || 'en-GB',
            fetchTimeout: options.fetchTimeout ?? DEFAULT_FETCH_TIMEOUT_MILLIS,
            cacheMaxAge: options.cacheMaxAge ?? DEFAULT_CACHE_MAX_AGE_MILLIS,
            defaultConfig: options.defaultConfig || {} as T,
        }

        this.app = app
        this.installations = new Installations(this.app)
        this.baseURL = `https://firebaseremoteconfig.googleapis.com/v1/projects/${this.app.credentials.projectId}/namespaces/firebase`

        const storagePrefix = `remoteConfig.${this.app.credentials.appId}.`

        this.storage = {
            get: (key) => this.app.storage.get(storagePrefix + key),
            set: (key, value) => this.app.storage.set(storagePrefix + key, value),
        } as StorageInterface<RemoteConfigStore<T>>

        this.fetchAndActivate()

        if (this.options.cacheMaxAge) {
            this.refreshTimer = setInterval(this.fetchAndActivate.bind(this), this.options.cacheMaxAge + 1000)
        }
    }

    destroy() {
        clearInterval(this.refreshTimer)
        this.refreshTimer = null
    }

    set defaultConfig(defaultConfig: RemoteConfigOptions<T>['defaultConfig']) {
        this.options.defaultConfig = defaultConfig
    }

    get defaultConfig() {
        return this.options.defaultConfig
    }

    get isCacheValid() {
        const cacheAge = Date.now() - (this.storage.get('lastFetchTimestamp') || 0)

        return this.storage.get('config') && cacheAge < this.options.cacheMaxAge
    }

    private get activeConfig() {
        return this.storage.get('config')
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
        }, {})
    }

    getAllConverted(): T {
        const config = this.getAll()

        Object.keys(config).forEach((key) => {
            config[key] = config[key].asConverted()
        })

        return config as T
    }

    async fetchAndActivate(ignoreCache = false): Promise<void> {
        const etag = this.storage.get('etag')

        if (!ignoreCache && this.isCacheValid) {
            this.emit('fetch')
            return Promise.resolve()
        }

        if (this.semaphoreFetch) {
            return this.semaphoreFetch;
        }

        let resolveSemaphore = null
        this.semaphoreFetch = new Promise((res) => { resolveSemaphore = res })

        const installation = await this.installations.getInstallation()

        const url = new URL(`${this.baseURL}/:fetch`)
        url.searchParams.append('key', this.app.credentials.apiKey)

        let response: globalThis.Response
        let status: number
        let data: any
        let responseHeaders: Record<string, string>

        try {
            response = await fetchWithRetry(url.toString(), {
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
                    app_instance_id_token: installation.authToken.token,
                    app_id: this.app.credentials.appId,
                    language_code: this.options.languageCode,
                }),
            })

            status = response.status
            responseHeaders = {}
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value
            })
            data = await response.json()
        } catch (err: any) {
            status = err.response?.status || 500
            data = err.response?.data
            responseHeaders = err.response?.headers || {}
        }

        const responseEtag = responseHeaders.etag || undefined

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
                    this.app.logger.warn('Unknown remoteConfig data state:', data?.state)
            }
        }

        this.emit('fetch')

        switch(status) {
            case 200:
                this.storage.set('config', config)
                this.storage.set('etag', responseEtag)
                this.emit('activate')
            // eslint-disable-line-rule: no-fallthrough
            case 304:
                this.storage.set('lastFetchTimestamp', Date.now())
                break
            default:
                throw new Error(`Failed to fetch RemoteConfig status: ${status}`)

        }

        this.semaphoreFetch = null

        resolveSemaphore?.()
    }
}
