import type { StorageInterface } from '../utils/storage'

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

export interface FirebaseAppOptions {
    credentials: FirebaseCredentials
    storage: StorageInterface
    logger?: Logger
}

export default class FirebaseApp {
    public readonly credentials: FirebaseCredentials
    public readonly storage: StorageInterface
    public readonly logger: Logger

    constructor(options: FirebaseAppOptions) {
        this.credentials = options.credentials
        this.storage = options.storage
        this.logger = options.logger || console

        if (
            typeof this.logger?.log !== 'function'
            || typeof this.logger?.debug !== 'function'
            || typeof this.logger?.warn !== 'function'
            || typeof this.logger?.error !== 'function'
        ) throw new TypeError('Logger interface is invalid')
    }
}