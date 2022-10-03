import type { StorageInterface } from "../utils/storage"

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

export interface FirebaseAppOptions {
    credentials: FirebaseCredentials
    storage: StorageInterface
}

export default class FirebaseApp {
    public readonly credentials: FirebaseCredentials
    public readonly storage: StorageInterface

    constructor(options: FirebaseAppOptions) {
        this.credentials = options.credentials
        this.storage = options.storage
    }
}