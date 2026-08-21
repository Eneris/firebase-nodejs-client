import { getProperty } from 'dot-prop'
import Installations from './installations'

export interface FirebaseCredentials {
    apiKey: string
    authDomain: string
    databaseURL: string
    projectId: string
    storageBucket: string
    messagingSenderId: string
    appId: string
    measurementId: string
}

export interface Logger {
    log: (...args: any) => void
    debug: (...args: any) => void
    warn: (...args: any) => void
    error: (err: Error) => void
}

export interface StorageInterface<T = Record<string, any>> {
    get<K extends keyof T>(key: K): T[K]
    set<K extends keyof T>(key: K, value: T[K]): void
}

export interface FirebaseAppConfig {
    bundleId?: string
    chromeId?: string
    /**
     * 1 = Windows
     * 2 = Darwin
     * 3 = Linux
     * 4 = Cros
     * 5 = iOS
     */
    chromePlatform?: number
    /**
     * 1 = stable
     * 2 = beta
     * 3 = dev
     * 4 = canary
     * 5 = unknown
     */
    chromeChannel?: number
    chromeVersion?: string
    timeZone?: string
    vapidKey?: string
}

export interface ResolvedFirebaseAppConfig {
    bundleId: string
    chromeId: string
    chromePlatform?: number
    chromeChannel?: number
    chromeVersion: string
    timeZone: string
    vapidKey: string
}

// This interface describes only parts that are required for running this module
export interface CryptoInterface {
    getRandomValues: (value: Uint8Array) => Uint8Array
}

export interface FirebaseAppOptions {
    credentials: FirebaseCredentials
    storage: StorageInterface
    logger?: Logger
    crypto?: CryptoInterface
    config?: Required<FirebaseAppConfig>
}

type MissingPropertiesError = TypeError & {
    missingProperties: string[]
}

function createMissingPropertiesError(parameterName: string, missingProperties: string[]): MissingPropertiesError {
    const error = new TypeError(
        `Invalid ${parameterName} parameter: missing properties ${missingProperties.join(', ')}`,
    ) as MissingPropertiesError

    error.missingProperties = missingProperties

    return error
}

export function assertRequiredProperties(app: object, requirements: string[], parameterName = 'app'): void {
    if (!app) {
        throw new TypeError(`Invalid ${parameterName} parameter`)
    }

    const missing = requirements.filter((requirement) => {
        const value = getProperty(app, requirement)

        if (typeof value === 'function') return false
        return value === undefined || value === null || value === ''
    })

    if (missing.length > 0) {
        throw createMissingPropertiesError(parameterName, missing)
    }
}

export default class FirebaseApp {
    public readonly credentials: FirebaseCredentials
    public readonly storage: StorageInterface
    public readonly logger: Logger
    public readonly crypto: CryptoInterface
    public readonly config: ResolvedFirebaseAppConfig
    public readonly installations: Installations

    constructor(options: FirebaseAppOptions) {
        this.credentials = options.credentials
        this.logger = options.logger || console
        this.crypto = options.crypto ?? (globalThis.crypto as CryptoInterface)
        this.config = {
            bundleId: 'receiver.push.com',
            chromeId: 'org.chromium.linux',
            chromeVersion: '94.0.4606.51',
            timeZone: 'Europe/Prague',
            vapidKey: 'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4', // Default vapid key from firebase-js-sdk, can be overridden by options
            ...options.config,
        }

        this.storage = {
            get: (key) => options.storage.get(`${this.credentials.appId}.${key}`),
            set: (key, value) => options.storage.set(`${this.credentials.appId}.${key}`, value),
        }

        this.installations = new Installations(this)

        assertRequiredProperties(this.logger, ['log', 'debug', 'warn', 'error'])
    }
}