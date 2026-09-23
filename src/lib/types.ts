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

export type DisposeFunction = () => void

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
    appId: string
    projectId: string
    apiKey: string
    messagingSenderId?: string
    authDomain?: string
    databaseURL?: string
    storageBucket?: string
    measurementId?: string
}

export interface PushConfig {
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

export interface PushReceiverOptions {
    config?: PushConfig
    heartbeatIntervalMs?: number
    /**
     * Maximum reconnect attempts after a disconnect.
     * Undefined or non-positive values disable the retry limit.
     */
    maxRetryAttempts?: number
}

export interface MessageToSend {
    title: string
    body: string
}
