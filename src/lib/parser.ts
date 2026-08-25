import ProtobufJS from 'protobufjs'
import { TLSSocket } from 'tls'
import Emitter from 'eventemitter3'
import Protos from '../protobuf'
import {
    Variables,
    ProcessingState,
    MCSProtoTag
} from '../utils/constants'


import type { DataPacket } from './types'

import type FirebaseApp from '../app'
import { assertRequiredProperties } from '../app'

const MAX_MESSAGE_SIZE = 8 * 1024 * 1024

// Parser parses wire data from gcm.
// This takes the role of WaitForData in the chromium connection handler.
//
// The main differences from the chromium implementation are:
// - Did not use a max packet length (kDefaultDataPacketLimit), instead we just
//   buffer data in this.#data
// - Error handling around protobufs
// - Setting timeouts while waiting for data
//
// ref: https://cs.chromium.org/chromium/src/google_apis/gcm/engine/connection_handler_impl.cc?rcl=dc7c41bc0ee5fee0ed269495dde6b8c40df43e40&l=178

interface ParserEvents {
    error: (err: Error) => void
    message: (data: DataPacket) => void
}

export default class Parser extends Emitter<ParserEvents> {
    #socket: TLSSocket
    #app: FirebaseApp
    #state: ProcessingState = ProcessingState.MCS_VERSION_TAG_AND_SIZE
    #data: Buffer = Buffer.alloc(0)
    #messageTag = 0
    #messageSize = 0
    #handshakeComplete = false
    #isWaitingForData = true
    #destroyed = false

    constructor(app: FirebaseApp, socket: TLSSocket) {
        super()

        assertRequiredProperties(app, ['logger.debug', 'logger.error'])

        this.#socket = socket
        this.#app = app
        this.#socket.on('data', this.#handleData)
    }

    destroy(): void {
        this.#destroyed = true
        this.#isWaitingForData = false
        this.#socket.removeListener('data', this.#handleData)
    }

    #emitError(error: Error): void {
        this.destroy()
        this.emit('error', error)
    }

    #handleData = (buffer: Buffer) => {
        this.#app.logger.debug(`Got data: ${buffer.length}`)
        this.#data = Buffer.concat([this.#data, buffer])
        if (this.#isWaitingForData) {
            this.#isWaitingForData = false
            this.#waitForData()
        }
    }

    #waitForData() {
        while (!this.#destroyed && !this.#isWaitingForData) {
            this.#app.logger.debug(`waitForData state: ${this.#state}`)

            let minBytesNeeded = 0

            switch (this.#state) {
                case ProcessingState.MCS_VERSION_TAG_AND_SIZE:
                    minBytesNeeded += Variables.kVersionPacketLen
                // eslint-disable-next-line no-fallthrough
                case ProcessingState.MCS_TAG_AND_SIZE:
                    minBytesNeeded += Variables.kTagPacketLen
                    // eslint-disable-next-line no-fallthrough
                case ProcessingState.MCS_SIZE:
                    minBytesNeeded += Variables.kSizePacketLenMin
                    break
                case ProcessingState.MCS_PROTO_BYTES:
                    minBytesNeeded = this.#messageSize
                    break
                default:
                    this.#emitError(new Error(`Unexpected state: ${this.#state}`))
                    return
            }

            if (this.#data.length < minBytesNeeded) {
                this.#app.logger.debug(`Waiting for ${minBytesNeeded - this.#data.length} more bytes. Got ${this.#data.length}`)
                this.#isWaitingForData = true
                return
            }

            this.#app.logger.debug(`Processing MCS data: state == ${this.#state}`)

            switch (this.#state) {
                case ProcessingState.MCS_VERSION_TAG_AND_SIZE:
                    this.#handleGotVersion()
                    if (this.#shouldStopProcessing()) {
                        return
                    }
                    this.#handleGotMessageTag()
                    if (this.#shouldStopProcessing()) {
                        return
                    }
                    this.#handleGotMessageSize()
                    break
                case ProcessingState.MCS_TAG_AND_SIZE:
                    this.#handleGotMessageTag()
                    if (this.#shouldStopProcessing()) {
                        return
                    }
                    this.#handleGotMessageSize()
                    break
                case ProcessingState.MCS_SIZE:
                    this.#handleGotMessageSize()
                    break
                case ProcessingState.MCS_PROTO_BYTES:
                    this.#handleGotMessageBytes()
                    break
                default:
                    this.#emitError(new Error(`Unexpected state: ${this.#state}`))
                    return
            }
        }
    }

    #shouldStopProcessing() {
        return this.#destroyed || this.#isWaitingForData
    }

    #handleGotVersion() {
        const version = this.#data.readInt8(0)
        this.#data = this.#data.slice(1)
        this.#app.logger.debug(`VERSION IS ${version}`)

        if (version < Variables.kMCSVersion && version !== 38) {
            this.#emitError(new Error(`Got wrong version: ${version}`))
            return
        }
    }

    #handleGotMessageTag() {
        this.#messageTag = this.#data.readInt8(0)
        this.#data = this.#data.slice(1)
        this.#app.logger.debug(`RECEIVED PROTO OF TYPE ${this.#messageTag}`)

    }

    #handleGotMessageSize() {
        let incompleteSizePacket = false
        const reader = new ProtobufJS.BufferReader(this.#data)

        try {
            this.#messageSize = reader.int32()
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('index out of range:')) {
                incompleteSizePacket = true
            } else {
                this.#emitError(error as Error)
                return
            }
        }

        // TODO(ibash) in chromium code there is an extra check here of:
        // if prev_byte_count >= kSizePacketLenMax then something else went wrong
        // NOTE(ibash) I could only test this case by manually cutting the buffer
        // above to be mid-packet like: new ProtobufJS.BufferReader(this.#data.slice(0, 1))
        if (incompleteSizePacket) {
            this.#state = ProcessingState.MCS_SIZE
            this.#isWaitingForData = true
            return
        }

        this.#data = this.#data.slice(reader.pos)

        this.#app.logger.debug(`Proto size: ${this.#messageSize}`)

        if (this.#messageSize < 0 || this.#messageSize > MAX_MESSAGE_SIZE) {
            this.#emitError(new Error(`Invalid MCS message size: ${this.#messageSize}`))
            return
        }

        if (this.#messageSize > 0) {
            this.#state = ProcessingState.MCS_PROTO_BYTES
            return
        }

        this.#handleGotMessageBytes()
    }

    #handleGotMessageBytes() {
        const protobuf = this.#buildProtobufFromTag(this.#messageTag)
        if (!protobuf) {
            this.#emitError(new Error('Unknown tag'))
            return
        }

        // Messages with no content are valid just use the default protobuf for
        // that tag.
        if (this.#messageSize === 0) {
            this.emit('message', { tag: this.#messageTag, object: {} })
            this.#getNextMessage()
            return
        }

        if (this.#data.length < this.#messageSize) {
            // Continue reading data.
            this.#app.logger.debug(`Continuing data read. Buffer size is ${this.#data.length}, expecting ${this.#messageSize}`)
            this.#state = ProcessingState.MCS_PROTO_BYTES
            this.#isWaitingForData = true
            return
        }

        const buffer = this.#data.slice(0, this.#messageSize)
        let object: Record<string, unknown>

        try {
            const message = protobuf.decode(buffer)

            object = protobuf.toObject(message, {
                longs: String,
                enums: String,
                bytes: Buffer,
            })
        } catch (error) {
            this.#emitError(error as Error)
            return
        }

        this.#data = this.#data.slice(this.#messageSize)

        this.emit('message', { tag: this.#messageTag, object: object })

        if (this.#messageTag === MCSProtoTag.kLoginResponseTag) {
            if (this.#handshakeComplete) {
                this.#app.logger.error(new Error('Unexpected login response'))
            } else {
                this.#handshakeComplete = true
                this.#app.logger.debug('GCM Handshake complete.')
            }
        }

        this.#getNextMessage()
    }

    #getNextMessage() {
        this.#messageTag = 0
        this.#messageSize = 0
        this.#state = ProcessingState.MCS_TAG_AND_SIZE
    }

    #buildProtobufFromTag(tag: number) {
        switch (tag) {
            case MCSProtoTag.kHeartbeatPingTag: return Protos.mcs_proto.HeartbeatPing
            case MCSProtoTag.kHeartbeatAckTag: return Protos.mcs_proto.HeartbeatAck
            case MCSProtoTag.kLoginRequestTag: return Protos.mcs_proto.LoginRequest
            case MCSProtoTag.kLoginResponseTag: return Protos.mcs_proto.LoginResponse
            case MCSProtoTag.kCloseTag: return Protos.mcs_proto.Close
            case MCSProtoTag.kIqStanzaTag: return Protos.mcs_proto.IqStanza
            case MCSProtoTag.kDataMessageStanzaTag: return Protos.mcs_proto.DataMessageStanza
            case MCSProtoTag.kStreamErrorStanzaTag: return Protos.mcs_proto.StreamErrorStanza
            default:
                return null
        }
    }
}
