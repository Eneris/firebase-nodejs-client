import Long from 'long'
import tls from 'tls'
import Emitter from 'eventemitter3'
import GCM, { type GcmData } from './lib/gcm'
import FCM, { type FcmData } from './lib/fcm'
import Parser from './lib/parser'
import decrypt from './utils/decrypt'
import defer from './utils/defer'
import { emitSafely } from './utils/emit'
import { isTransientError } from './utils/errors'
import Protos from './protobuf'

import {
    Variables, MCSProtoTag,
    DEFAULT_BUNDLE_ID, DEFAULT_CHROME_ID, DEFAULT_CHROME_PLATFORM, DEFAULT_CHROME_CHANNEL,
    DEFAULT_CHROME_VERSION, DEFAULT_TIME_ZONE, DEFAULT_VAPID_KEY, DEFAULT_HEARTBEAT_INTERVAL_MS,
    MAX_STORED_PERSISTENT_IDS,
} from './utils/constants'

import type * as Types from './utils/types'
import FirebaseApp, { assertRequiredProperties, StorageInterface } from './app'

// Source: https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/connection_factory_impl.cc
// kConnectionResetWindowSecs (:44) and ShouldRestorePreviousBackoff() (:48-52): a connection
// reset within this window of a login restores the backoff saved at login (:249-254, saved at
// :486-491), so a login immediately followed by a drop does not reset the retry schedule.
const CONNECTION_RESET_WINDOW_MS = 10_000

// Source: https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/connection_factory_impl.cc
// kReadTimeoutMs (:39), the read timeout ConnectionHandlerImpl uses for the login handshake
// (connection_handler_impl.cc :57-59, OnTimeout :472-476 -> ERR_TIMED_OUT, a socket failure).
// Deviation: Chromium starts that timer once the login request is written and leaves the TCP
// connect to the network stack; here one timer spans TCP + TLS + login, so a connect the OS
// keeps retrying for minutes is bounded too.
const LOGIN_TIMEOUT_MS = 30_000

interface PushReceiverStorage {
    last_persistent_ids: string[]
    // The FCM token last announced to the app, so a rotation across a restart is announced
    // too. Unset until the first registration after upgrading from 1.0.x.
    announced_token?: string
}

interface ClientEvents {
    ON_MESSAGE_RECEIVED: (data: Types.MessageEnvelope) => void
    ON_CONNECT: (data: void) => void
    ON_DISCONNECT: (data: void) => void
    ON_READY: (data: void) => void
    ON_HEARTBEAT: (data: void) => void
    ON_TOKEN_CHANGE: (newToken: string, oldToken: string) => void
}

// One connection attempt: registration, socket, login and heartbeat. The receiver holds at
// most one at a time (`#connection`). Everything that runs later on an attempt's behalf, an
// await, a timer, a socket or parser listener, is bound to the Connection it was started for
// and does nothing unless that is still the current one. So work left over from a closed or
// superseded attempt never reaches the receiver: no fields, no events, no timers, no writes.
class Connection {
    socket: tls.TLSSocket | null = null
    parser: Parser | null = null
    heartbeatTimer?: NodeJS.Timeout
    heartbeatTimeout?: NodeJS.Timeout
    loginTimeout?: NodeJS.Timeout
    // Set by a successful LoginResponse, together with the retry count the login reset. A drop
    // within CONNECTION_RESET_WINDOW_MS of the login puts that count back. Kept on the attempt,
    // not the receiver, so no later attempt can pick up a stale count.
    loggedInAt?: number
    retryCountBeforeLogin = 0
    // Source: https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/mcs_client.cc
    // ResetStateAndBuildLoginRequest restarts stream_id_in_ at 0 for every connection.
    streamId = 0
    lastStreamIdReported = -1
    // Started by the retry schedule: a failure anywhere goes back on the schedule. A fresh
    // connect() whose registration or socket setup fails rejects the call instead.
    readonly retry: boolean

    constructor(retry: boolean) {
        this.retry = retry
    }
}

export default class PushReceiver extends Emitter<ClientEvents> {
    readonly #HOST = 'mtalk.google.com'
    readonly #PORT = 5228
    readonly #DEFAULT_MAX_RETRY_ATTEMPTS = 5
    readonly #RETRY_DELAY_SECONDS = 15
    // Source: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/gcm_driver/gcm_backoff_policy.cc
    // kDefaultBackoffPolicy.maximum_backoff_ms, the policy GCMClientImpl builds its
    // ConnectionFactoryImpl (the MCS socket) with (gcm_client_impl.cc, GetGCMBackoffPolicy()).
    readonly #RETRY_DELAY_CAP_MS = 10 * 60 * 1000
    readonly #KEEP_ALIVE_DELAY_MS = 30_000

    #app: FirebaseApp
    #storage: StorageInterface<PushReceiverStorage>
    #options: Omit<Types.PushReceiverOptions, 'config'>
    #pushConfig: Types.PushConfig
    // The receiver is idle when both are unset, connecting or connected while #connection is
    // set, and waiting out a backoff while only #retryTimeout is.
    #connection: Connection | null = null
    #retryTimeout?: NodeJS.Timeout
    #retryCount = 0
    #ready = defer<void>()
    // Registration calls persist their own result (lib/gcm.ts, lib/fcm.ts), so a cancelled
    // attempt's registration still in flight and its successor's would race for storage.
    // Attempts take turns instead: each waits for the previous registration to settle.
    #registration: Promise<void> = Promise.resolve()

    #fcm: FCM
    #gcm: GCM
    #fcmData?: FcmData

    get fcmToken(): string | undefined {
        return this.#fcmData?.registration.token
    }

    constructor(app: FirebaseApp, config: Types.PushConfig, options: Types.PushReceiverOptions = {}) {
        super()

        assertRequiredProperties(app, [
            'credentials.appId',
            'credentials.projectId',
            'logger.debug',
            'logger.error',
            'logger.warn',
            'storage.get',
            'storage.set',
        ])

        this.#app = app

        this.#options = {
            heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
            maxRetryAttempts: this.#DEFAULT_MAX_RETRY_ATTEMPTS,
            retryInitialConnect: false,
            ...options,
        }

        const pushConfig: Types.PushConfig = {
            bundleId: DEFAULT_BUNDLE_ID,
            chromeId: DEFAULT_CHROME_ID,
            chromePlatform: DEFAULT_CHROME_PLATFORM,
            chromeChannel: DEFAULT_CHROME_CHANNEL,
            chromeVersion: DEFAULT_CHROME_VERSION,
            timeZone: DEFAULT_TIME_ZONE,
            ...config,
            vapidKey: config.vapidKey ?? DEFAULT_VAPID_KEY,
        }

        assertRequiredProperties(pushConfig, [
            'bundleId', 'chromeId', 'chromePlatform', 'chromeChannel', 'chromeVersion', 'timeZone', 'vapidKey',
        ], 'config')

        this.#pushConfig = pushConfig

        this.#storage = {
            get: (key) => this.#app.storage.get(`push_receiver.${key}`),
            set: (key, value) => this.#app.storage.set(`push_receiver.${key}`, value),
        }

        this.#app.logger.debug('constructor', options)

        this.#gcm = new GCM(this.#app, pushConfig)
        this.#fcm = new FCM(this.#app, this.#gcm, pushConfig)
    }

    get #lastPersistentIds(): string[] {
        return this.#storage.get('last_persistent_ids') ?? []
    }

    set #lastPersistentIds(data: string[]) {
        this.#storage.set('last_persistent_ids', data)
    }

    #addPersistentId(persistentId: string) {
        const lastPersistentIds = this.#lastPersistentIds

        if (lastPersistentIds.includes(persistentId)) {
            return
        }

        lastPersistentIds.push(persistentId)

        this.#lastPersistentIds = lastPersistentIds.slice(-MAX_STORED_PERSISTENT_IDS)
    }

    get whenReady(): Promise<void> {
        return this.#ready.promise
    }

    onNotification(listener: (data: Types.MessageEnvelope) => void): Types.DisposeFunction {
        this.on('ON_MESSAGE_RECEIVED', listener)

        return () => this.off('ON_MESSAGE_RECEIVED', listener)
    }

    onReady(listener: () => void): Types.DisposeFunction {
        this.on('ON_READY', listener)

        return () => this.off('ON_READY', listener)
    }

    // Idempotent: starts an attempt only when the receiver is idle. An attempt in flight or a
    // retry waiting out its backoff is joined instead, the call settling with its outcome, so
    // connect() is safe from any listener and never shortens the backoff. To reconnect right
    // away, call destroy() first.
    connect = async (): Promise<void> => {
        if (!this.#connection && !this.#retryTimeout) {
            this.#startConnection(this.#options.retryInitialConnect!)
        }

        return this.whenReady
    }

    // Starts a fresh attempt now, for when the caller knows the network just came back or the
    // machine woke up: a connection that looks alive may be dead, and a retry may be waiting
    // out a long backoff. Idle: same as connect(). Waiting on backoff: the wait is cut short.
    // Logged in: the connection is closed (ON_DISCONNECT) and replaced. An attempt still
    // before its login is left alone; LOGIN_TIMEOUT_MS bounds it. The retry count is kept, so
    // a reconnect() that fails continues the backoff where it was.
    //
    // Chromium reacts to a network change with a canary attempt that bypasses the backoff
    // (connection_factory_impl.cc :231-239) and to a resume with a heartbeat
    // (heartbeat_manager.cc OnResume :130-142); here both are left to the caller, who calls
    // this. Deviation: a failed reconnect() attempt counts towards the backoff and
    // maxRetryAttempts, a Chromium canary does not.
    // Source: https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/connection_factory_impl.cc
    reconnect = async (): Promise<void> => {
        const connection = this.#connection

        if (connection) {
            if (connection.loggedInAt === undefined) {
                return this.whenReady
            }

            this.#closeConnection()
            this.#startConnection(true)
            this.#emit('ON_DISCONNECT')

            return this.whenReady
        }

        if (this.#retryTimeout) {
            clearTimeout(this.#retryTimeout)
            this.#retryTimeout = undefined
            this.#startConnection(true)

            return this.whenReady
        }

        return this.connect()
    }

    // Safe at any point, including from inside a listener: whatever the attempt or the retry
    // schedule was about to do next no longer happens, and whenReady and pending connect()
    // calls reject with the reason. The next connect() starts over with the full retry budget.
    destroy = (reason = new Error('Client destroyed')) => {
        clearTimeout(this.#retryTimeout)
        this.#retryTimeout = undefined
        this.#retryCount = 0
        this.#closeConnection()
        this.#rejectReady(reason)
    }

    // Every event goes out through here: a listener that throws is logged and cannot reach the
    // connection's own error handling (the parser's catch would otherwise close the socket).
    #emit<T extends keyof ClientEvents>(event: T, ...args: Emitter.EventArgs<ClientEvents, T>) {
        emitSafely<ClientEvents, T>(this, this.#app.logger, event, ...args)
    }

    #isCurrent(connection: Connection): boolean {
        return connection === this.#connection
    }

    // The one place an attempt starts, for connect() and the retry timer alike.
    #startConnection(retry: boolean) {
        this.#resetReady()

        const connection = new Connection(retry)
        this.#connection = connection

        void this.#openConnection(connection)
    }

    // Registration, socket and login write; the login is answered asynchronously through the
    // parser. destroy(), or destroy() and connect(), may land during any await, so every
    // resume checks that this is still the current attempt before going on.
    async #openConnection(connection: Connection) {
        try {
            await this.#registration
            if (!this.#isCurrent(connection)) return

            const registering = this.#register()
            this.#registration = registering.then(() => undefined, () => undefined)
            const { gcmData, fcmData } = await registering
            if (!this.#isCurrent(connection)) return

            const token = fcmData.registration.token
            const announcedToken = this.#storage.get('announced_token')
            const previousToken = this.#fcmData?.registration.token ?? announcedToken
            this.#fcmData = fcmData

            if (previousToken && previousToken !== token) {
                this.#emit('ON_TOKEN_CHANGE', token, previousToken)
                // The listener may have destroyed or restarted the receiver. The token is then
                // not recorded as announced, so the next start announces it again: at least once.
                if (!this.#isCurrent(connection)) return
            }

            if (announcedToken !== token) {
                this.#storage.set('announced_token', token)
            }

            this.#openSocket(connection)
            this.#sendLogin(connection, gcmData)
        } catch (error) {
            this.#connectionFailed(connection, error as Error)
        }
    }

    async #register(): Promise<{ gcmData: GcmData, fcmData: FcmData }> {
        const gcmData = await this.#gcm.getRegistration()
        const fcmData = await this.#fcm.getRegistration(gcmData)

        return { gcmData, fcmData }
    }

    #openSocket(connection: Connection) {
        this.#app.logger.debug('connect')

        const socket = tls.connect({
            host: this.#HOST,
            port: this.#PORT,
            servername: this.#HOST,
        })
        connection.socket = socket
        connection.loginTimeout = setTimeout(() => this.#handleLoginTimeout(connection), LOGIN_TIMEOUT_MS)

        // Without an explicit delay the OS default applies (7200s on Linux), so half-open
        // connections dropped by NAT aging stay undetected for hours instead of ~a minute.
        socket.setKeepAlive(true, this.#KEEP_ALIVE_DELAY_MS)
        socket.on('secureConnect', () => this.#handleSocketConnect(connection))
        socket.on('close', () => this.#handleSocketClose(connection))
        socket.on('error', (error) => this.#handleSocketError(connection, error))

        const parser = new Parser(this.#app, socket)
        connection.parser = parser
        parser.on('message', (data) => {
            try {
                this.#handleMessage(connection, data)
            } catch (error) {
                this.#handleParserError(connection, error as Error)
            }
        })
        parser.on('error', (error) => this.#handleParserError(connection, error))
    }

    // A failure on the attempt's own path: registration, socket setup or the login write.
    #connectionFailed(connection: Connection, error: Error) {
        // The failure of an attempt that was cancelled meanwhile is neither logged nor retried.
        if (!this.#isCurrent(connection)) return

        this.#closeConnection()

        if (connection.retry) {
            this.#logFailure(error)
            this.#scheduleRetry()
        } else {
            this.#rejectReady(error)
        }
    }

    // Tears down the current attempt, if any. Its listeners and timers are gone after this,
    // and whatever of it is still in flight fails the current-attempt check when it resumes.
    #closeConnection() {
        const connection = this.#connection

        if (!connection) return

        this.#connection = null
        this.#clearHeartbeat(connection)
        this.#clearLoginTimeout(connection)

        if (connection.socket) {
            connection.socket.removeAllListeners()
            connection.socket.end()
            connection.socket.destroy()
        }

        connection.parser?.destroy()
    }

    #clearLoginTimeout(connection: Connection) {
        clearTimeout(connection.loginTimeout)
        connection.loginTimeout = undefined
    }

    #handleLoginTimeout(connection: Connection) {
        if (!this.#isCurrent(connection)) return

        this.#app.logger.warn(new Error(`PushReceiver login timed out after ${LOGIN_TIMEOUT_MS} ms`))
        this.#handleSocketClose(connection)
    }

    // The connection is gone: put the next attempt on the backoff schedule, or give up once
    // maxRetryAttempts is exhausted. whenReady, and every connect() joining meanwhile, waits
    // for that attempt.
    #scheduleRetry() {
        if (this.#retryCount >= this.#getMaxRetryAttempts()) {
            const error = new Error('PushReceiver retry limit reached')
            this.#app.logger.error(error)
            this.destroy(error)
            return
        }

        this.#resetReady()

        const retryAttempt = ++this.#retryCount
        this.#retryTimeout = setTimeout(() => {
            this.#retryTimeout = undefined
            this.#startConnection(true)
        }, this.#getRetryDelayMs(retryAttempt))
    }

    // A settled whenReady belongs to a login that is over, so the next login gets a new one.
    // A pending one is kept: the connect() calls waiting on it see the retries through.
    #resetReady() {
        if (this.#ready.isResolved) {
            this.#ready = defer<void>()
        }
    }

    #rejectReady(reason: Error) {
        if (!this.#ready.isResolved) {
            void this.#ready.promise.catch(() => {})
            this.#ready.reject(reason)
        }
    }

    #clearHeartbeat(connection: Connection) {
        clearTimeout(connection.heartbeatTimer)
        connection.heartbeatTimer = undefined

        clearTimeout(connection.heartbeatTimeout)
        connection.heartbeatTimeout = undefined
    }

    #startHeartbeat(connection: Connection) {
        this.#clearHeartbeat(connection)

        if (!this.#options.heartbeatIntervalMs) return

        connection.heartbeatTimer = setTimeout(() => this.#sendHeartbeatPing(connection), this.#options.heartbeatIntervalMs)
        connection.heartbeatTimeout = setTimeout(() => this.#handleSocketClose(connection), this.#options.heartbeatIntervalMs * 2)
    }

    // Socket, parser and timer handlers start with the current-attempt check and emit last: a
    // listener may call destroy() or connect(), and nothing of the attempt may run after that.
    #handleSocketConnect(connection: Connection) {
        if (!this.#isCurrent(connection)) return

        this.#startHeartbeat(connection)
        this.#emit('ON_CONNECT')
    }

    #handleSocketClose(connection: Connection) {
        if (!this.#isCurrent(connection)) return

        // A login that did not last the reset window does not count as a success: the backoff
        // continues from where it was before that login.
        if (connection.loggedInAt !== undefined && Date.now() - connection.loggedInAt <= CONNECTION_RESET_WINDOW_MS) {
            this.#retryCount = connection.retryCountBeforeLogin
        }

        this.#closeConnection()
        this.#scheduleRetry()
        this.#emit('ON_DISCONNECT')
    }

    #handleSocketError(connection: Connection, error: Error) {
        if (!this.#isCurrent(connection)) return

        this.#logFailure(error)
        // ignore, the close handler takes care of retry
    }

    // A failure the retry schedule recovers from on its own (offline, a timeout, a 5xx) is a
    // warning; one that will keep failing (a rejected request, a TLS certificate error) is an
    // error. The retry limit and protocol violations are always errors.
    #logFailure(error: Error) {
        if (isTransientError(error)) {
            this.#app.logger.warn(error)
        } else {
            this.#app.logger.error(error)
        }
    }

    #handleParserError(connection: Connection, error: Error) {
        if (!this.#isCurrent(connection)) return

        this.#app.logger.error(error)
        this.#handleSocketClose(connection)
    }

    #getRetryDelayMs(retryAttempt: number): number {
        if (retryAttempt <= 1) {
            return 0
        }

        return Math.min(this.#RETRY_DELAY_SECONDS * (2 ** (retryAttempt - 2)) * 1000, this.#RETRY_DELAY_CAP_MS)
    }

    #getMaxRetryAttempts(): number {
        const { maxRetryAttempts } = this.#options

        if (maxRetryAttempts == null || Number.isNaN(maxRetryAttempts) || maxRetryAttempts <= 0) {
            return Number.POSITIVE_INFINITY
        }

        return maxRetryAttempts
    }

    #getStreamId(connection: Connection): number {
        connection.lastStreamIdReported = connection.streamId
        return connection.streamId
    }

    #newStreamIdAvailable(connection: Connection): boolean {
        return connection.lastStreamIdReported != connection.streamId
    }

    #sendHeartbeatPing(connection: Connection) {
        if (!this.#isCurrent(connection)) return

        const heartbeatPingRequest: Protos.mcs_proto.IHeartbeatPing = {}

        if (this.#newStreamIdAvailable(connection)) {
            heartbeatPingRequest.lastStreamIdReceived = this.#getStreamId(connection)
        }

        this.#app.logger.debug('Heartbeat send pong', heartbeatPingRequest)

        const HeartbeatPingRequestType = Protos.mcs_proto.HeartbeatPing
        const errorMessage = HeartbeatPingRequestType.verify(heartbeatPingRequest)

        if (errorMessage) {
            throw new Error(errorMessage)
        }

        const buffer = HeartbeatPingRequestType.encodeDelimited(heartbeatPingRequest).finish()

        this.#app.logger.debug('HEARTBEAT sending PING', heartbeatPingRequest)

        connection.socket!.write(Buffer.concat([
            Buffer.from([MCSProtoTag.kHeartbeatPingTag]),
            buffer,
        ]))
    }

    #sendHeartbeatPong(connection: Connection, object: any) {
        const heartbeatAckRequest: Protos.mcs_proto.IHeartbeatAck = {}

        if (this.#newStreamIdAvailable(connection)) {
            heartbeatAckRequest.lastStreamIdReceived = this.#getStreamId(connection)
        }

        if (object?.status) {
            heartbeatAckRequest.status = object.status
        }

        this.#app.logger.debug('Heartbeat send pong', heartbeatAckRequest)

        const HeartbeatAckRequestType = Protos.mcs_proto.HeartbeatAck
        const errorMessage = HeartbeatAckRequestType.verify(heartbeatAckRequest)
        if (errorMessage) {
            throw new Error(errorMessage)
        }

        const buffer = HeartbeatAckRequestType.encodeDelimited(heartbeatAckRequest).finish()

        this.#app.logger.debug('HEARTBEAT sending PONG', heartbeatAckRequest)

        connection.socket!.write(Buffer.concat([
            Buffer.from([MCSProtoTag.kHeartbeatAckTag]),
            buffer
        ]))
    }

    #sendLogin(connection: Connection, gcmData: GcmData) {
        const lastPersistentIds = this.#lastPersistentIds

        const LoginRequestType = Protos.mcs_proto.LoginRequest
        const hexAndroidId = Long.fromString(gcmData.androidId).toString(16)
        const loginRequest: Protos.mcs_proto.ILoginRequest = {
            adaptiveHeartbeat: false,
            authService: 2,
            authToken: gcmData.securityToken,
            id: `chrome-${this.#pushConfig.chromeVersion!}`,
            domain: 'mcs.android.com',
            deviceId: `android-${hexAndroidId}`,
            networkType: 1,
            resource: gcmData.androidId,
            user: gcmData.androidId,
            useRmq2: true,
            setting: [{ name: 'new_vc', value: '1' }],
            clientEvent: [],
            // Ids of the last notifications received
            receivedPersistentId: lastPersistentIds,
        }

        if (this.#options.heartbeatIntervalMs) {
            loginRequest.heartbeatStat = {
                ip: '',
                timeout: true,
                intervalMs: this.#options.heartbeatIntervalMs,
            }
        }

        const errorMessage = LoginRequestType.verify(loginRequest)
        if (errorMessage) {
            throw new Error(errorMessage)
        }

        const buffer = LoginRequestType.encodeDelimited(loginRequest).finish()

        connection.socket!.write(Buffer.concat([
            Buffer.from([Variables.kMCSVersion, MCSProtoTag.kLoginRequestTag]),
            buffer,
        ]))
    }

    #handleMessage(connection: Connection, { tag, object }: Types.DataPacket) {
        if (!this.#isCurrent(connection)) return

        // any message will reset the client side heartbeat timeout.
        this.#startHeartbeat(connection)

        // Source: https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/mcs_client.cc
        // HandlePacketFromWire counts the packet before handling it, so an ack sent in reply
        // already includes the ping it answers.
        connection.streamId++

        switch (tag) {
            case MCSProtoTag.kLoginResponseTag:
                // Source: https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/mcs_client.cc
                // A LoginResponse with a non-zero error code is a failed login (:616-623): the
                // connection is reset as a LOGIN_FAILURE, which keeps the backoff growing.
                if (object?.error?.code) {
                    this.#app.logger.warn(new Error(`PushReceiver login failed with error ${object.error.code}: ${object.error.message ?? ''}`))
                    this.#handleSocketClose(connection)
                    return
                }

                this.#clearLoginTimeout(connection)
                // Chromium resets stream_id_in_ to 1 on LoginResponse.
                connection.streamId = 1
                connection.loggedInAt = Date.now()
                connection.retryCountBeforeLogin = this.#retryCount
                this.#retryCount = 0
                // clear persistent ids, as we just sent them to the server while logging in
                this.#lastPersistentIds = []
                this.#ready.resolve()
                this.#emit('ON_READY')
                break

            case MCSProtoTag.kDataMessageStanzaTag:
                this.#handleDataMessage(object)
                break

            case MCSProtoTag.kHeartbeatPingTag:
                this.#app.logger.debug('HEARTBEAT PING', object)
                this.#sendHeartbeatPong(connection, object)
                this.#emit('ON_HEARTBEAT')
                break

            case MCSProtoTag.kHeartbeatAckTag:
                this.#app.logger.debug('HEARTBEAT PONG', object)
                this.#emit('ON_HEARTBEAT')
                break

            case MCSProtoTag.kCloseTag:
                this.#app.logger.debug('Close: Server requested close! message: ', JSON.stringify(object))
                this.#handleSocketClose(connection)
                break

            case MCSProtoTag.kLoginRequestTag:
                this.#app.logger.debug('Login request: message: ', JSON.stringify(object))
                break

            case MCSProtoTag.kIqStanzaTag:
                this.#app.logger.debug('IqStanza: ', JSON.stringify(object))
                // FIXME: If anyone knows what is this and how to respond, please let me know
                break

            default:
                // Newer servers may send tags this client does not know; nothing is lost.
                this.#app.logger.warn(new Error('Unknown message: ' + JSON.stringify(object)))
                return

            // no default
        }
    }

    #handleDataMessage(object: any) {
        const lastPersistentIds = this.#lastPersistentIds

        if (lastPersistentIds.includes(object.persistentId)) {
            return
        }

        const fcmData = this.#fcmData!

        let message!: Types.Message
        try {
            message = decrypt<Types.Message>(object, fcmData.keys)
        } catch (error) {
            const msg = (error as any)?.message ?? ''
            switch (true) {
                case msg.includes('Unsupported state or unable to authenticate data'):
                case msg.includes('crypto-key is missing'):
                case msg.includes('salt is missing'):
                    // NOTE(ibash) Periodically we're unable to decrypt notifications. In
                    // all cases we've been able to receive future notifications using the
                    // same keys. So, we silently drop this notification.
                    this.#app.logger.debug('Message dropped as it could not be decrypted: ' + msg)
                    return
                default:
                    throw error
            }
        }

        const { data: appDataPayload, notification: appNotificationPayload } = this.#extractAppData(object.appData)
        const messagePayload: Types.Message = typeof message === 'object' && message !== null ? message : {}

        if (Object.keys(appDataPayload).length > 0) {
            messagePayload.data = {
                ...appDataPayload,
                ...messagePayload.data,
            }
        }

        if (Object.keys(appNotificationPayload).length > 0) {
            messagePayload.notification = {
                ...appNotificationPayload,
                ...messagePayload.notification,
            }
        }

        // Maintain the last received persistent ids for reconnect deduplication.
        this.#addPersistentId(object.persistentId)

        // Send notification
        this.#emit('ON_MESSAGE_RECEIVED', {
            message: messagePayload,
            // Needs to be saved by the client
            persistentId: object.persistentId,
        })
    }

    #extractAppData(appData: Array<{ key?: string, value?: string }> = []) {
        const data: Types.MessageCustomData = {}
        const notification: Record<string, string> = {}

        for (const item of appData) {
            if (!item?.key || item.value === undefined) {
                continue
            }

            if (item.key === 'crypto-key' || item.key === 'encryption') {
                continue
            }

            if (item.key.startsWith('gcm.notification.')) {
                const notificationKey = item.key.slice('gcm.notification.'.length)

                if (notificationKey) {
                    notification[notificationKey] = item.value
                }

                continue
            }

            data[item.key] = item.value
        }

        return { data, notification }
    }
}

export { PushReceiver }
