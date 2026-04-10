export interface StorageInterface<T = Record<string, any>> {
    get<K extends keyof T>(key: K): T[K]
    set<K extends keyof T>(key: K, value: T[K]): void
}

export interface Logger {
    log: (...args: any[]) => void
    debug: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
}

export interface InstallationEntry {
    fid: string
    refreshToken: string
    authToken: {
        token: string
        creationTime: number
        expiresIn: number
    }
}

export interface InstallationData {
    token: string
    createdAt: number
    expiresIn: number
    refreshToken: string
    fid: string
}

// TODO: replace this with actual data
export interface FcmData {
    token: string
    installation: InstallationData
}

export type PersistentId = string

export type DisposeFunction = CallableFunction

// table 2b. - https://firebase.google.com/docs/cloud-messaging/http-server-ref
export interface Notification {
    title?: string
    body?: string
    android_channel_id?: string
    icon?: string
    sound?: string
    tag?: string
    color?: string
    click_action?: string
    body_loc_key?: string
    body_loc_args?: string // JSON array as string
    title_loc_key?: string
    title_loc_args?: string // JSON array as string
}

export interface MessageCustomData {
    [key: string]: unknown
}

// table 1. - https://firebase.google.com/docs/cloud-messaging/http-server-ref
export interface Message {
    to?: string
    registration_ids?: string[]
    condition?: string
    collapse_key?: string
    priority?: 'normal' | 'high'
    content_available?: boolean
    mutable_content?: string // JSON boolean ???
    restricted_package_name?: string
    dry_run?: boolean
    data?: MessageCustomData
    notification?: Notification

    // Not in table, but found in data
    fcmMessageId?: string
    from?: string
}

export interface MessageEnvelope {
    message: Message
    persistentId: string
}

export interface DataPacket<T = any> {
    tag: number
    object: T
}

export interface FirebaseConfig {
    projectId: string
    appId: string
    apiKey: string
    messagingSenderId: string
    authDomain?: string
    databaseURL?: string
    storageBucket?: string
    measurementId?: string
}

export interface ClientConfig {
    heartbeatIntervalMs?: number
}

export interface MessageToSend {
    title: string
    body: string
}
