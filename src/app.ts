import { getProperty } from 'dot-prop'
import Installations from './installations'
import { FirebaseConfig } from './utils/types'

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

// This interface describes only parts that are required for running this module
export interface CryptoInterface {
    getRandomValues: (value: Uint8Array) => Uint8Array
}

export interface FirebaseAppOptions {
    credentials: FirebaseConfig
    storage: StorageInterface
    logger?: Logger
    crypto?: CryptoInterface
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
    public readonly credentials: FirebaseConfig
    public readonly storage: StorageInterface
    public readonly logger: Logger
    public readonly crypto: CryptoInterface
    public readonly installations: Installations

    constructor(options: FirebaseAppOptions) {
        this.credentials = options.credentials
        this.logger = options.logger || console
        this.crypto = options.crypto ?? (globalThis.crypto as CryptoInterface)

        this.storage = {
            get: (key) => options.storage.get(`${this.credentials.appId}.${key}`),
            set: (key, value) => options.storage.set(`${this.credentials.appId}.${key}`, value),
        }

        assertRequiredProperties(this.credentials, ['appId'])

        this.installations = new Installations(this)

        assertRequiredProperties(this.logger, ['log', 'debug', 'warn', 'error'])
    }
}