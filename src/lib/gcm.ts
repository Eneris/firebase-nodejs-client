import Long from 'long'
import { randomUUID } from 'crypto'
import request from '../utils/request'
import delay from '../utils/timeout'
import Protos from '../protobuf'

import type FirebaseApp from '../app'
import type { StorageInterface } from '../app'
import { assertRequiredProperties } from '../app'
import type { PushConfig } from '../utils/types'

const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3'
const CHECKIN_URL = 'https://android.clients.google.com/checkin'

// Retries of the register call itself, on top of the first attempt.
const MAX_REGISTER_RETRIES = 5

export interface GcmCheckinResponse {
    androidId: string
    securityToken: string
}

export interface GcmRegisterResponse {
    appId: string
    token: string
}

export type GcmData = GcmCheckinResponse & GcmRegisterResponse

interface GCMStorage {
    registration: GcmData
}

export default class GCM {
    readonly #app: FirebaseApp
    readonly #config: PushConfig
    readonly #storage: StorageInterface<GCMStorage>

    constructor(app: FirebaseApp, config: PushConfig) {
        assertRequiredProperties(app, [
            'logger.debug',
            'logger.warn',
            'storage.get',
            'storage.set',
        ])
        assertRequiredProperties(config, [
            'bundleId',
            'chromeId',
            'chromePlatform',
            'chromeChannel',
            'chromeVersion',
            'timeZone',
            'vapidKey',
        ], 'config')

        this.#app = app
        this.#config = config
        this.#storage = {
            get: (key) => app.storage.get(`gcm.${key}`),
            set: (key, value) => app.storage.set(`gcm.${key}`, value),
        }
    }

    async getRegistration(): Promise<GcmData> {
        const gcmRegistration = this.#storage.get('registration')

        if (!gcmRegistration) {
            const options = await this.checkIn(gcmRegistration)
            const registration = await this.#doRegister(options)
            this.#storage.set('registration', registration)
            return registration
        }

        const checkin = await this.checkIn(gcmRegistration)
        const refreshedRegistration = { ...gcmRegistration, ...checkin }
        this.#storage.set('registration', refreshedRegistration)

        return refreshedRegistration
    }

    #parseLong(number: bigint, unsigned?: boolean | number, radix?: number): Long {
        return Long.fromString(number.toString(), unsigned, radix)
    }

    async checkIn(gcmRegistration?: GcmData): Promise<GcmCheckinResponse> {
        const body = await (await request(CHECKIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-protobuf',
            },
            body: this.#prepareCheckinBuffer(gcmRegistration) as Uint8Array<ArrayBuffer>,
        })).arrayBuffer()

        const AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse
        const message = AndroidCheckinResponse.decode(new Uint8Array(body))
        const object = AndroidCheckinResponse.toObject(message, {
            longs: String,
            enums: String,
            bytes: String,
        })

        return {
            androidId: object.androidId,
            securityToken: object.securityToken,
        }
    }

    async #doRegister({ androidId, securityToken }: GcmCheckinResponse): Promise<GcmData> {
        const appId = `wp:${this.#config.bundleId}#${randomUUID()}`
        const body = (new URLSearchParams({
            app: this.#config.chromeId!,
            'X-subtype': appId,
            device: androidId,
            sender: this.#config.vapidKey!,
        })).toString()

        const response = await this.#postRegister({ androidId, securityToken, body })
        const token = response.split('=')[1]

        return {
            token,
            androidId,
            securityToken,
            appId,
        }
    }

    async #postRegister({ androidId, securityToken, body, retry = 0 }: {
        androidId: GcmData['androidId']
        securityToken: GcmData['securityToken']
        body: string
        retry?: number
    }): Promise<string> {
        const response = await (await request(REGISTER_URL, {
            method: 'POST',
            headers: {
                Authorization: `AidLogin ${androidId}:${securityToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        })).text()

        if (response.includes('Error')) {
            // Google answers PHONE_REGISTRATION_ERROR for the first few attempts as a matter of
            // course and then registers fine, so a single failed attempt is not worth reporting.
            // Only an exhausted retry budget is a real failure, and that one throws.
            if (retry >= MAX_REGISTER_RETRIES) {
                throw new Error(`GCM register has failed after ${retry + 1} attempts: ${response}`)
            }

            this.#app.logger.debug(`Register request failed with ${response}, retrying (${retry + 1})`)
            await delay(1000)
            return this.#postRegister({ androidId, securityToken, body, retry: retry + 1 })
        }

        return response
    }

    #prepareCheckinBuffer(gcmRegistration?: GcmData) {
        const AndroidCheckinRequest = Protos.checkin_proto.AndroidCheckinRequest

        const payload: Protos.checkin_proto.IAndroidCheckinRequest = {
            accountCookie: [],
            checkin: {
                cellOperator: '', // Optional
                chromeBuild: {
                    platform: this.#config.chromePlatform!,
                    chromeVersion: this.#config.chromeVersion,
                    channel: this.#config.chromeChannel!,
                },
                type: Protos.checkin_proto.DeviceType.DEVICE_CHROME_BROWSER,
                lastCheckinMsec: this.#parseLong(0n), // TODO
                roaming: '', // Optional
                simOperator: '', // Optional
                userNumber: 0, // Optional
            },
            desiredBuild: '', // Optional
            digest: '', // Optional
            fragment: 0,
            id: gcmRegistration?.androidId ? Long.fromString(gcmRegistration.androidId) : undefined,
            locale: '', // Optional
            loggingId: this.#parseLong(0n), // Optional
            macAddr: [],
            macAddrType: [],
            marketCheckin: '', // Optional
            otaCert: [],
            securityToken: gcmRegistration?.securityToken ? Long.fromString(gcmRegistration.securityToken, true) : undefined,
            timeZone: this.#config.timeZone,
            userName: '', // Optional
            userSerialNumber: 0, // TODO
            version: 3, // TODO - ???
        }

        const errMsg = AndroidCheckinRequest.verify(payload)
        if (errMsg) throw Error(errMsg)

        const message = AndroidCheckinRequest.create(payload)
        return AndroidCheckinRequest.encode(message).finish()
    }
}
