import Long from 'long'
import tls from 'tls'
import crypto from 'crypto'
import Emitter from 'eventemitter3'
import GCM, { type GcmData } from './lib/gcm'
import FCM, { type FcmData } from './lib/fcm'
import Parser from './lib/parser'
import decrypt from './utils/decrypt'
import defer from './utils/defer'
import { escape } from './utils/base64'
import Protos from './protobuf'

import { Variables, MCSProtoTag } from './utils/constants'

import type * as Types from './lib/types'
import FirebaseApp, { assertRequiredProperties, StorageInterface } from './app'

const MAX_STORED_PERSISTENT_IDS = 30

interface PushReceiverStorage {
    last_persistent_ids: string[]
}

interface ClientEvents {
    ON_MESSAGE_RECEIVED: (data: Types.MessageEnvelope) => void
    ON_CONNECT: (data: void) => void
    ON_DISCONNECT: (data: void) => void
    ON_READY: (data: void) => void
    ON_HEARTBEAT: (data: void) => void
}

export default class PushReceiver extends Emitter<ClientEvents> {
    readonly #HOST = 'mtalk.google.com'
    readonly #PORT = 5228
    readonly #MAX_RETRY_TIMEOUT = 15

    #app: FirebaseApp
    #storage: StorageInterface<PushReceiverStorage>
    #config: Types.ClientConfig
    #socket: tls.TLSSocket | null = null
    #retryCount = 0
    #retryTimeout?: NodeJS.Timeout
    #parser: Parser | null = null
    #heartbeatTimer?: NodeJS.Timeout
    #heartbeatTimeout?: NodeJS.Timeout
    #streamId = 0
    #lastStreamIdReported = -1
    #ready = defer()

    #fcm: FCM
    #gcm: GCM
    #gcmData?: GcmData
    #fcmData?: FcmData

    get fcmToken(): string | undefined {
        return this.#fcmData?.registration.token
    }

    constructor(app: FirebaseApp, config: Types.ClientConfig) {
        super()

        assertRequiredProperties(app, [
            'config.bundleId',
            'config.chromeVersion',
            'config.vapidKey',
            'credentials.appId',
            'credentials.projectId',
            'logger.debug',
            'logger.error',
            'logger.warn',
            'storage.get',
            'storage.set',
        ])

        this.#app = app

        this.#config = {
            heartbeatIntervalMs: 5 * 60 * 1000, // 5 min
            ...config
        }

        this.#storage = {
            get: (key) => this.#app.storage.get(`push_receiver.${key}`),
            set: (key, value) => this.#app.storage.set(`push_receiver.${key}`, value),
        }

        this.#app.logger.debug('constructor', config)

        this.#gcm = new GCM(this.#app)
        this.#fcm = new FCM(this.#app, this.#gcm)
    }

    get #lastPersistentIds(): string[] {
        return this.#storage.get('last_persistent_ids')
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

    get whenReady() {
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

    connect = async (): Promise<void> => {
        if (this.#socket) return

        this.#gcmData = await this.#gcm.getRegistration()
        this.#fcmData = await this.#fcm.getRegistration()

        this.#app.logger.debug('connect')

        this.#lastStreamIdReported = -1

        this.#socket = new tls.TLSSocket(null as any)
        this.#socket.setKeepAlive(true)
        this.#socket.on('connect', () => this.#handleSocketConnect())
        this.#socket.on('close', () => this.#handleSocketClose())
        this.#socket.on('error', (err) => this.#handleSocketError(err))
        this.#socket.connect({ host: this.#HOST, port: this.#PORT })

        this.#parser = new Parser(this.#app, this.#socket)
        this.#parser.on('message', (data) => this.#handleMessage(data))
        this.#parser.on('error', (err) => this.#handleParserError(err))

        this.#sendLogin()

        return new Promise((res) => {
            const dispose = this.onReady(() => {
                dispose()
                res()
            })
        })
    }

    destroy = () => {
        this.#clearReady()

        clearTimeout(this.#retryTimeout)
        this.#clearHeartbeat()

        if (this.#socket) {
            this.#socket.removeAllListeners()
            this.#socket.end()
            this.#socket.destroy()
            this.#socket = null
        }

        if (this.#parser) {
            this.#parser.destroy()
            this.#parser = null 
        }
    }

    get #configMetaData() {
        return {
            bundleId: this.#app.config.bundleId,
            projectId: this.#app.credentials.projectId,
            vapidKey: this.#app.config.vapidKey,
        }
    }

    #clearReady() {
        if (!this.#ready.isResolved) {
            this.#ready.reject(new Error('Client destroyed'))
        }

        this.#ready = defer()
    }

    #clearHeartbeat() {
        clearTimeout(this.#heartbeatTimer)
        this.#heartbeatTimer = undefined

        clearTimeout(this.#heartbeatTimeout)
        this.#heartbeatTimeout = undefined
    }

    #startHeartbeat() {
        this.#clearHeartbeat()

        if (!this.#config.heartbeatIntervalMs) return

        this.#heartbeatTimer = setTimeout(() => this.#sendHeartbeatPing(), this.#config.heartbeatIntervalMs)
        this.#heartbeatTimeout = setTimeout(() => this.#socketRetry(), this.#config.heartbeatIntervalMs * 2)
    }

    #handleSocketConnect = (): void => {
        this.#retryCount = 0
        this.emit('ON_CONNECT')
        this.#startHeartbeat()
    }

    #handleSocketClose = (): void => {
        this.emit('ON_DISCONNECT')
        this.#clearHeartbeat()
        this.#socketRetry()
    }

    #handleSocketError = (err: Error): void => {
        this.#app.logger.error(err)
        // ignore, the close handler takes care of retry
    }

    #socketRetry() {
        this.destroy()
        const timeout = Math.min(++this.#retryCount, this.#MAX_RETRY_TIMEOUT) * 1000
        this.#retryTimeout = setTimeout(() => this.connect(), timeout)
    }

    #getStreamId(): number {
        this.#lastStreamIdReported = this.#streamId
        return this.#streamId
    }

    #newStreamIdAvailable(): boolean {
        return this.#lastStreamIdReported != this.#streamId
    }

    #sendHeartbeatPing() {
        const heartbeatPingRequest: Record<string, unknown> = {}

        if (this.#newStreamIdAvailable()) {
            heartbeatPingRequest.last_stream_id_received = this.#getStreamId()
        }

        this.#app.logger.debug('Heartbeat send pong', heartbeatPingRequest)

        const HeartbeatPingRequestType = Protos.mcs_proto.HeartbeatPing
        const errorMessage = HeartbeatPingRequestType.verify(heartbeatPingRequest)

        if (errorMessage) {
            throw new Error(errorMessage)
        }

        const buffer = HeartbeatPingRequestType.encodeDelimited(heartbeatPingRequest).finish()

        this.#app.logger.debug('HEARTBEAT sending PING', heartbeatPingRequest)

        this.#socket!.write(Buffer.concat([
            Buffer.from([MCSProtoTag.kHeartbeatPingTag]),
            buffer,
        ]))
    }

    #sendHeartbeatPong(object: any) {
        const heartbeatAckRequest: Record<string, any> = {}

        if (this.#newStreamIdAvailable()) {
            heartbeatAckRequest.last_stream_id_received = this.#getStreamId()
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

        this.#socket!.write(Buffer.concat([
            Buffer.from([MCSProtoTag.kHeartbeatAckTag]),
            buffer
        ]))
    }

    async #sendLogin() {
        if (!this.#app.config?.chromeVersion) {
            throw new Error('Chrome version is required in Firebase app config')
        }

        const gcmData = this.#gcmData!

        const lastPersistentIds = this.#lastPersistentIds

        const LoginRequestType = Protos.mcs_proto.LoginRequest
        const hexAndroidId = Long.fromString(gcmData.androidId).toString(16)
        const loginRequest: Protos.mcs_proto.ILoginRequest = {
            adaptiveHeartbeat: false,
            authService: 2,
            authToken: gcmData.securityToken,
            id: `chrome-${this.#app.config.chromeVersion}`,
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

        if (this.#config.heartbeatIntervalMs) {
            loginRequest.heartbeatStat = {
                ip: '',
                timeout: true,
                intervalMs: this.#config.heartbeatIntervalMs,
            }
        }

        const errorMessage = LoginRequestType.verify(loginRequest)
        if (errorMessage) {
            throw new Error(errorMessage)
        }

        const buffer = LoginRequestType.encodeDelimited(loginRequest).finish()

        this.#socket!.write(Buffer.concat([
            Buffer.from([Variables.kMCSVersion, MCSProtoTag.kLoginRequestTag]),
            buffer,
        ]))
    }

    #handleMessage = ({ tag, object }: Types.DataPacket): void => {
        // any message will reset the client side heartbeat timeout.
        this.#startHeartbeat()

        switch (tag) {
            case MCSProtoTag.kLoginResponseTag:
                // clear persistent ids, as we just sent them to the server while logging in
                this.#lastPersistentIds = []
                this.emit('ON_READY')
                this.#startHeartbeat()
                this.#ready.resolve()
                break

            case MCSProtoTag.kDataMessageStanzaTag:
                this.#handleDataMessage(object)
                break

            case MCSProtoTag.kHeartbeatPingTag:
                this.emit('ON_HEARTBEAT')
                this.#app.logger.debug('HEARTBEAT PING', object)
                this.#sendHeartbeatPong(object)
                break

            case MCSProtoTag.kHeartbeatAckTag:
                this.emit('ON_HEARTBEAT')
                this.#app.logger.debug('HEARTBEAT PONG', object)
                break

            case MCSProtoTag.kCloseTag:
                this.#app.logger.debug('Close: Server requested close! message: ', JSON.stringify(object))
                this.#handleSocketClose()
                break

            case MCSProtoTag.kLoginRequestTag:
                this.#app.logger.debug('Login request: message: ', JSON.stringify(object))
                break

            case MCSProtoTag.kIqStanzaTag:
                this.#app.logger.debug('IqStanza: ', JSON.stringify(object))
                // FIXME: If anyone knows what is this and how to respond, please let me know
                break

            default:
                this.#app.logger.error(new Error('Unknown message: ' + JSON.stringify(object)))
                return

            // no default
        }

        this.#streamId++
    }

    #handleDataMessage = (object: any): void => {
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
                    this.#app.logger.warn('Message dropped as it could not be decrypted: ' + msg)
                    return
                default:
                    throw error
            }
        }

        // Maintain the last received persistent ids for reconnect deduplication.
        this.#addPersistentId(object.persistentId)

        // Send notification
        this.emit('ON_MESSAGE_RECEIVED', {
            message,
            // Needs to be saved by the client
            persistentId: object.persistentId,
        })
    }

    #handleParserError = (error: any) => {
        this.#app.logger.error(error)
        this.#socketRetry()
    }
}

export { PushReceiver }
