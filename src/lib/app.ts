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

// This interface describes only parts that are required for running this module
export interface CryptoInterface {
    getRandomValues: (value: Uint8Array) => Uint8Array
}

export interface FirebaseAppOptions {
    credentials: FirebaseCredentials
    storage: StorageInterface
    logger?: Logger
    crypto?: CryptoInterface
}

export default class FirebaseApp {
    public readonly credentials: FirebaseCredentials
    public readonly storage: StorageInterface
    public readonly logger: Logger
    public readonly crypto: CryptoInterface

    constructor(options: FirebaseAppOptions) {
        this.credentials = options.credentials
        this.storage = options.storage
        this.logger = options.logger || console
        this.crypto = options.crypto || globalThis.crypto

        if (
            typeof this.logger?.log !== 'function'
            || typeof this.logger?.debug !== 'function'
            || typeof this.logger?.warn !== 'function'
            || typeof this.logger?.error !== 'function'
        ) throw new TypeError('Logger interface is invalid')
    }
}