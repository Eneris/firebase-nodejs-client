import FirebaseApp from './app'
import FCM, { type FcmData as CurrentFcmData, type Keys, type SubscriptionOptions } from './lib/fcm'
import GCM, { type GcmData } from './lib/gcm'
import PushReceiverRaw from './pushReceiver'
import { escape as toBase64Url } from './utils/base64'

import type { FirebaseAppConfig, FirebaseCredentials, Logger, StorageInterface } from './app'
import type { InstallationEntry } from './installations'
import type { DisposeFunction, FirebaseConfig, PersistentId } from './lib/types'

const DEFAULT_BUNDLE_ID = 'receiver.push.com'
const DEFAULT_CHROME_ID = 'org.chromium.linux'
const DEFAULT_CHROME_VERSION = '94.0.4606.51'
const DEFAULT_TIME_ZONE = 'Europe/Prague'
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_VAPID_KEY = 'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4'
const FCM_API = 'https://fcm.googleapis.com/'

export type { GcmData, Keys }

export interface InstallationData {
    token: string
    createdAt: number
    expiresIn: number
    refreshToken: string
    fid: string
}

export interface FcmData {
    token: string
    installation: InstallationData
}

interface CredentialsConfig {
    bundleId: string
    projectId: string
    vapidKey: string
}

export interface Credentials {
    gcm: GcmData
    fcm: FcmData
    keys: Keys
    config: CredentialsConfig
}

export interface EventChangeCredentials {
    oldCredentials?: Credentials
    newCredentials: Credentials
}

export interface ClientConfig {
    credentials?: Credentials | null
    persistentIds?: PersistentId[]
    bundleId?: string
    chromeId?: string
    chromePlatform?: number
    chromeChannel?: number
    chromeVersion?: string
    timeZone?: string
    debug?: boolean
    vapidKey?: string
    heartbeatIntervalMs?: number
    maxRetryAttempts?: number
    firebase: FirebaseConfig
}

export type NormalizedClientConfig = ClientConfig & {
    persistentIds: PersistentId[]
    bundleId: string
    chromeId: string
    chromeVersion: string
    timeZone: string
    vapidKey: string
    heartbeatIntervalMs: number
}

interface DebugState {
    enabled: boolean
}

interface CredentialsChangeEmitter {
    on: (eventName: 'ON_CREDENTIALS_CHANGE', listener: (data: EventChangeCredentials) => void) => unknown
    off: (eventName: 'ON_CREDENTIALS_CHANGE', listener: (data: EventChangeCredentials) => void) => unknown
    emit: (eventName: 'ON_CREDENTIALS_CHANGE', data: EventChangeCredentials) => unknown
}

function clone<T>(value: T): T {
    return value == null ? value : JSON.parse(JSON.stringify(value)) as T
}

function normalizeBase64(value: string): string {
    const normalizedValue = String(value).replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (normalizedValue.length % 4)) % 4)

    return normalizedValue + padding
}

function normalizeKeys(keys: Keys): Keys {
    return {
        privateKey: normalizeBase64(keys.privateKey),
        publicKey: normalizeBase64(keys.publicKey),
        authSecret: normalizeBase64(keys.authSecret),
    }
}

function getEffectiveVapidKey(config: NormalizedClientConfig): string {
    return config.vapidKey || DEFAULT_VAPID_KEY
}

function getCredentialsConfig(config: NormalizedClientConfig): CredentialsConfig {
    return {
        bundleId: config.bundleId,
        projectId: config.firebase.projectId,
        vapidKey: config.vapidKey,
    }
}

function checkCredentialsConfig(config: NormalizedClientConfig, credentials?: Credentials | null): credentials is Credentials {
    if (!credentials) return false
    if (!credentials.fcm || !credentials.gcm || !credentials.keys) return false
    if (!credentials.fcm.installation) return false
    if (!credentials.config) return false

    return JSON.stringify(credentials.config) === JSON.stringify(getCredentialsConfig(config))
}

function createSubscriptionOptions(config: NormalizedClientConfig, gcm: GcmData, keys: Keys): SubscriptionOptions {
    return {
        auth: toBase64Url(keys.authSecret),
        endpoint: `${FCM_API}fcm/send/${gcm.token}`,
        p256dh: toBase64Url(keys.publicKey),
        vapidKey: getEffectiveVapidKey(config),
    }
}

function createFirebaseCredentials(firebase: FirebaseConfig): FirebaseCredentials {
    return {
        apiKey: firebase.apiKey,
        authDomain: firebase.authDomain ?? '',
        databaseURL: firebase.databaseURL ?? '',
        projectId: firebase.projectId,
        storageBucket: firebase.storageBucket ?? '',
        messagingSenderId: firebase.messagingSenderId,
        appId: firebase.appId,
        measurementId: firebase.measurementId ?? '',
    }
}

function createFirebaseConfig(config: NormalizedClientConfig): Required<FirebaseAppConfig> {
    return {
        bundleId: config.bundleId,
        chromeId: config.chromeId,
        chromePlatform: config.chromePlatform,
        chromeChannel: config.chromeChannel,
        chromeVersion: config.chromeVersion,
        timeZone: config.timeZone,
        vapidKey: getEffectiveVapidKey(config),
    } as Required<FirebaseAppConfig>
}

function createLogger(debugState: DebugState): Logger {
    return {
        log: (...args: any[]) => console.log(...args),
        debug: (...args: any[]) => {
            if (debugState.enabled) {
                console.log(...args)
            }
        },
        warn: (...args: any[]) => console.warn(...args),
        error: ((...args: any[]) => console.error(...args)) as Logger['error'],
    }
}

function normalizeConfig(config: ClientConfig): NormalizedClientConfig {
    if (!config?.firebase) {
        throw new TypeError('Invalid config parameter: missing firebase')
    }

    config.bundleId ??= DEFAULT_BUNDLE_ID
    config.chromeId ??= DEFAULT_CHROME_ID
    config.chromeVersion ??= DEFAULT_CHROME_VERSION
    config.timeZone ??= DEFAULT_TIME_ZONE
    config.vapidKey ??= ''
    config.heartbeatIntervalMs ??= DEFAULT_HEARTBEAT_INTERVAL_MS

    if (!Array.isArray(config.persistentIds)) {
        config.persistentIds = []
    }

    return config as NormalizedClientConfig
}

function legacyInstallationToCurrent(installation: InstallationData): InstallationEntry {
    return {
        fid: installation.fid,
        refreshToken: installation.refreshToken,
        authToken: installation.token,
        expiresAt: installation.createdAt + installation.expiresIn,
    }
}

function currentInstallationToLegacy(installation: InstallationEntry): InstallationData {
    const now = Date.now()

    return {
        token: installation.authToken,
        createdAt: now,
        expiresIn: Math.max(0, installation.expiresAt - now),
        refreshToken: installation.refreshToken,
        fid: installation.fid,
    }
}

function legacyFcmToCurrent(config: NormalizedClientConfig, fcm: FcmData, gcm: GcmData, keys: Keys): CurrentFcmData {
    const normalizedKeys = normalizeKeys(keys)
    const subscriptionOptions = createSubscriptionOptions(config, gcm, normalizedKeys)
    const web: CurrentFcmData['registration']['web'] = {
        auth: subscriptionOptions.auth,
        endpoint: subscriptionOptions.endpoint,
        p256dh: subscriptionOptions.p256dh,
    }

    if (subscriptionOptions.vapidKey !== DEFAULT_VAPID_KEY) {
        web.applicationPubKey = subscriptionOptions.vapidKey
    }

    return {
        registration: {
            name: '',
            token: fcm.token,
            web,
        },
        keys: normalizedKeys,
        createTime: fcm.installation.createdAt,
        subscriptionOptions,
    }
}

function currentFcmToLegacy(fcm: CurrentFcmData, installation: InstallationEntry | InstallationData): FcmData {
    return {
        token: fcm.registration.token,
        installation: 'authToken' in installation ? currentInstallationToLegacy(installation) : installation,
    }
}

class LegacyStorageAdapter implements StorageInterface<Record<string, any>> {
    readonly #config: NormalizedClientConfig
    readonly #appId: string
    readonly #memory = new Map<string, any>()
    #pendingGcm?: GcmData
    #pendingInstallation?: InstallationEntry
    #onCredentialsChanged?: (event: EventChangeCredentials) => void

    constructor(config: NormalizedClientConfig) {
        this.#config = config
        this.#appId = config.firebase.appId
    }

    set onCredentialsChanged(listener: ((event: EventChangeCredentials) => void) | undefined) {
        this.#onCredentialsChanged = listener
    }

    get<K extends string>(key: K): any {
        const storageKey = this.#stripAppIdPrefix(key)

        switch (storageKey) {
            case 'push_receiver.last_persistent_ids':
                return this.#config.persistentIds
            case 'gcm.registration':
                return this.#config.credentials?.gcm ?? this.#pendingGcm
            case 'fcm.registration':
                return this.#getCurrentFcmRegistration()
            case 'installations.installation':
                return this.#getCurrentInstallation()
            default:
                return this.#memory.get(storageKey)
        }
    }

    set<K extends string>(key: K, value: any): void {
        const storageKey = this.#stripAppIdPrefix(key)

        switch (storageKey) {
            case 'push_receiver.last_persistent_ids':
                this.#config.persistentIds = Array.isArray(value) ? value : []
                break
            case 'gcm.registration':
                this.#setGcmRegistration(value as GcmData)
                break
            case 'fcm.registration':
                this.#setFcmRegistration(value as CurrentFcmData)
                break
            case 'installations.installation':
                this.#setInstallation(value as InstallationEntry)
                break
            default:
                this.#memory.set(storageKey, value)
                break
        }
    }

    #stripAppIdPrefix(key: string): string {
        const prefix = `${this.#appId}.`

        return key.startsWith(prefix) ? key.slice(prefix.length) : key
    }

    #getCurrentInstallation(): InstallationEntry | undefined {
        if (this.#config.credentials?.fcm?.installation) {
            return legacyInstallationToCurrent(this.#config.credentials.fcm.installation)
        }

        return this.#pendingInstallation
    }

    #getCurrentFcmRegistration(): CurrentFcmData | undefined {
        const credentials = this.#config.credentials

        if (!credentials?.fcm || !credentials.gcm || !credentials.keys) {
            return undefined
        }

        return legacyFcmToCurrent(this.#config, credentials.fcm, credentials.gcm, credentials.keys)
    }

    #setGcmRegistration(gcm: GcmData): void {
        this.#pendingGcm = gcm

        if (this.#config.credentials?.fcm && this.#config.credentials.keys) {
            this.#setCredentials({
                ...this.#config.credentials,
                gcm,
                config: getCredentialsConfig(this.#config),
            })
        }
    }

    #setInstallation(installation: InstallationEntry): void {
        this.#pendingInstallation = installation

        if (this.#config.credentials?.fcm) {
            this.#setCredentials({
                ...this.#config.credentials,
                fcm: {
                    ...this.#config.credentials.fcm,
                    installation: currentInstallationToLegacy(installation),
                },
            })
        }
    }

    #setFcmRegistration(fcm: CurrentFcmData): void {
        const gcm = this.#pendingGcm ?? this.#config.credentials?.gcm
        const installation = this.#pendingInstallation ?? this.#config.credentials?.fcm?.installation

        if (!gcm || !installation) {
            this.#memory.set('fcm.registration', fcm)
            return
        }

        this.#setCredentials({
            gcm,
            fcm: currentFcmToLegacy(fcm, installation),
            keys: clone(fcm.keys),
            config: getCredentialsConfig(this.#config),
        })
    }

    #setCredentials(credentials: Credentials): void {
        const oldCredentials = clone(this.#config.credentials ?? undefined)
        const oldCredentialsJson = JSON.stringify(oldCredentials ?? null)
        const newCredentials = clone(credentials)
        const newCredentialsJson = JSON.stringify(newCredentials)

        this.#config.credentials = newCredentials

        if (oldCredentialsJson !== newCredentialsJson) {
            this.#onCredentialsChanged?.({
                oldCredentials,
                newCredentials: clone(newCredentials),
            })
        }
    }
}

class PushReceiver extends PushReceiverRaw {
    public readonly config: NormalizedClientConfig

    readonly #debugState: DebugState
    readonly #gcm: GCM
    readonly #fcm: FCM
    readonly #storage: LegacyStorageAdapter

    constructor(config: ClientConfig) {
        const normalizedConfig = normalizeConfig(config)
        const debugState = { enabled: Boolean(normalizedConfig.debug) }
        const storage = new LegacyStorageAdapter(normalizedConfig)
        const app = new FirebaseApp({
            credentials: createFirebaseCredentials(normalizedConfig.firebase),
            config: createFirebaseConfig(normalizedConfig),
            logger: createLogger(debugState),
            storage,
        })

        super(app, {
            heartbeatIntervalMs: normalizedConfig.heartbeatIntervalMs,
            maxRetryAttempts: normalizedConfig.maxRetryAttempts ?? 0,
        })

        this.config = normalizedConfig
        this.#debugState = debugState
        this.#storage = storage
        this.#gcm = new GCM(app)
        this.#fcm = new FCM(app, this.#gcm)

        const emitter = this as unknown as CredentialsChangeEmitter

        this.#storage.onCredentialsChanged = (event) => emitter.emit('ON_CREDENTIALS_CHANGE', event)
    }

    override get fcmToken(): string | undefined {
        return this.config.credentials?.fcm?.token ?? super.fcmToken
    }

    get persistentIds(): PersistentId[] {
        return this.config.persistentIds
    }

    set persistentIds(persistentIds: PersistentId[]) {
        this.config.persistentIds = persistentIds
    }

    setDebug(enabled?: boolean): void {
        this.#debugState.enabled = Boolean(enabled)
    }

    onCredentialsChanged(listener: (data: EventChangeCredentials) => void): DisposeFunction {
        const emitter = this as unknown as CredentialsChangeEmitter

        emitter.on('ON_CREDENTIALS_CHANGE', listener)

        return () => emitter.off('ON_CREDENTIALS_CHANGE', listener)
    }

    checkCredentials(credentials: Credentials | null | undefined = this.config.credentials): credentials is Credentials {
        return checkCredentialsConfig(this.config, credentials)
    }

    async registerIfNeeded(): Promise<Credentials> {
        if (this.checkCredentials(this.config.credentials)) {
            await this.#gcm.getRegistration()

            return this.config.credentials
        }

        await this.#gcm.getRegistration()
        await this.#fcm.getRegistration()

        if (!this.config.credentials) {
            throw new Error('Registration finished without generated credentials')
        }

        return this.config.credentials
    }
}

export { PushReceiver }
export default PushReceiver
