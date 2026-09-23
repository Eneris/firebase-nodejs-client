import crypto from 'crypto'
import request, { getEndpoint } from '../utils/request'

import type GCM from './gcm'
import { type GcmData } from './gcm'
import type FirebaseApp from '../app'

import { assertRequiredProperties, StorageInterface } from '../app'
import { InstallationEntry } from '../installations'
import { escape as toBase64Url } from '../utils/base64'
import type { PushConfig } from './types'

import { DEFAULT_VAPID_KEY, FCM_API, FCM_REGISTRATION_API } from '../utils/constants'

const TOKEN_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000

export interface FcmRegistration {
    name: string
    token: string
    web: {
        applicationPubKey?: string
        auth: string
        endpoint: string
        p256dh: string
    }
}

export interface Keys {
    privateKey: string
    publicKey: string
    authSecret: string
}

export interface SubscriptionOptions {
    auth: string
    endpoint: string
    p256dh: string
    vapidKey: string
}

export interface FcmData {
    registration: FcmRegistration
    keys: Keys
    createTime: number
    subscriptionOptions: SubscriptionOptions
    // FID this registration was created under; optional because legacyFcmToCurrent() cannot
    // supply it. See AGENTS.md "FCM registration is bound to an installation FID".
    installationFid?: string
}

interface FCMStorage {
    registration: FcmData
}

type StoredFcmData = Partial<FcmData> & Pick<FcmData, 'registration' | 'keys'>

export default class FCM {
    readonly #app: FirebaseApp
    readonly #gcm: GCM
    readonly #config: PushConfig
    readonly #storage: StorageInterface<FCMStorage>

    constructor(app: FirebaseApp, gcm: GCM, config: PushConfig) {
        assertRequiredProperties(app, [
            'credentials.apiKey',
            'credentials.projectId',
            'installations.getInstallation',
            'storage.get',
            'storage.set',
        ])
        assertRequiredProperties(config, ['vapidKey'], 'config')

        this.#storage = {
            get: (key) => app.storage.get(`fcm.${key}`),
            set: (key, value) => app.storage.set(`fcm.${key}`, value),
        }

        this.#app = app
        this.#gcm = gcm
        this.#config = config
    }

    #normalizeBase64(value: string): string {
        const normalizedValue = String(value).replace(/-/g, '+').replace(/_/g, '/')
        const padding = '='.repeat((4 - (normalizedValue.length % 4)) % 4)

        return normalizedValue + padding
    }

    #getHeaders(installation: InstallationEntry): Headers {
        return new Headers({
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-goog-api-key': this.#app.credentials.apiKey,
            'x-goog-firebase-installations-auth': `FIS ${installation.authToken}`,
        })
    }

    #normalizeKeys(keys: Keys): Keys {
        return {
            privateKey: this.#normalizeBase64(keys.privateKey),
            publicKey: this.#normalizeBase64(keys.publicKey),
            authSecret: this.#normalizeBase64(keys.authSecret),
        }
    }

    #createSubscriptionOptions(gcmData: GcmData, keys: Keys): SubscriptionOptions {
        return {
            auth: toBase64Url(keys.authSecret),
            endpoint: `${FCM_API}fcm/send/${gcmData.token}`,
            p256dh: toBase64Url(keys.publicKey),
            vapidKey: this.#config.vapidKey!,
        }
    }

    #createRequestBody(subscriptionOptions: SubscriptionOptions): { web: FcmRegistration['web'] } {
        const body: { web: FcmRegistration['web'] } = {
            web: {
                auth: subscriptionOptions.auth,
                endpoint: subscriptionOptions.endpoint,
                p256dh: subscriptionOptions.p256dh,
            },
        }

        if (subscriptionOptions.vapidKey !== DEFAULT_VAPID_KEY) {
            body.web.applicationPubKey = subscriptionOptions.vapidKey
        }

        return body
    }

    async #parseRegistrationResponse(response: Response): Promise<FcmRegistration> {
        const {
            error,
            ...fcmRegistration
        }: FcmRegistration & { error?: { message?: string } } = await response.json()

        if (error) {
            throw new Error('FCM registration failed... ' + error.message)
        }

        if (!fcmRegistration.token) {
            throw new Error('FCM registration failed: missing token in response')
        }

        return fcmRegistration
    }

    async #createRegistration(installation: InstallationEntry, subscriptionOptions: SubscriptionOptions): Promise<FcmRegistration> {
        const response = await request(getEndpoint(this.#app.credentials.projectId, FCM_REGISTRATION_API, 'registrations'), {
            method: 'POST',
            headers: this.#getHeaders(installation),
            body: JSON.stringify(this.#createRequestBody(subscriptionOptions)),
        })

        return this.#parseRegistrationResponse(response)
    }

    async #updateRegistration(token: string, installation: InstallationEntry, subscriptionOptions: SubscriptionOptions): Promise<FcmRegistration> {
        const response = await request(getEndpoint(this.#app.credentials.projectId, FCM_REGISTRATION_API, `registrations/${token}`), {
            method: 'PATCH',
            headers: this.#getHeaders(installation),
            body: JSON.stringify(this.#createRequestBody(subscriptionOptions)),
        })

        return this.#parseRegistrationResponse(response)
    }

    async #deleteRegistration(token: string, installation: InstallationEntry): Promise<void> {
        await request(getEndpoint(this.#app.credentials.projectId, FCM_REGISTRATION_API, `registrations/${token}`), {
            method: 'DELETE',
            headers: this.#getHeaders(installation),
        })
    }

    #isRegistrationValid(dbOptions: SubscriptionOptions, currentOptions: SubscriptionOptions): boolean {
        return dbOptions.auth === currentOptions.auth
            && dbOptions.endpoint === currentOptions.endpoint
            && dbOptions.p256dh === currentOptions.p256dh
            && dbOptions.vapidKey === currentOptions.vapidKey
    }

    async #migrateStoredRegistration(gcm: GcmData, currentRegistration: StoredFcmData): Promise<FcmData> {
        const keys = this.#normalizeKeys(currentRegistration.keys)
        const subscriptionOptions = this.#createSubscriptionOptions(gcm, keys)

        if (currentRegistration.createTime && currentRegistration.subscriptionOptions) {
            return {
                createTime: currentRegistration.createTime,
                installationFid: currentRegistration.installationFid,
                keys,
                registration: currentRegistration.registration,
                subscriptionOptions: currentRegistration.subscriptionOptions,
            }
        }

        const installation = await this.#app.installations.getInstallation()

        try {
            await this.#deleteRegistration(currentRegistration.registration.token, installation)
        } catch (error) {
            this.#app.logger.warn('Failed to delete legacy cached FCM registration, creating a new one', error)
        }

        const registration = await this.#createRegistration(installation, subscriptionOptions)

        return {
            createTime: Date.now(),
            installationFid: installation.fid,
            keys,
            registration,
            subscriptionOptions,
        }
    }

    async #register(gcm: GcmData): Promise<FcmData> {
        const installation = await this.#app.installations.getInstallation()
        const keys = await this.#createKeys()
        const subscriptionOptions = this.#createSubscriptionOptions(gcm, keys)
        const registration = await this.#createRegistration(installation, subscriptionOptions)

        return {
            registration,
            keys,
            createTime: Date.now(),
            subscriptionOptions,
            installationFid: installation.fid,
        }
    }

    async #refreshRegistration(gcm: GcmData, currentRegistration: FcmData): Promise<FcmData> {
        const keys = this.#normalizeKeys(currentRegistration.keys)
        const subscriptionOptions = this.#createSubscriptionOptions(gcm, keys)

        // FIS replaced or deleted the installation this registration was created under: the
        // old registration is dead server-side, so register again from scratch. See
        // AGENTS.md "FCM registration is bound to an installation FID" for why a missing
        // stored FID counts as a mismatch too.
        if (currentRegistration.installationFid
            && currentRegistration.installationFid !== this.#app.installations.storedFid) {
            this.#app.logger.warn('FCM registration was bound to an installation FIS replaced, registering again')

            return this.#register(gcm)
        }

        if (!this.#isRegistrationValid(currentRegistration.subscriptionOptions, subscriptionOptions)) {
            const installation = await this.#app.installations.getInstallation()

            try {
                await this.#deleteRegistration(currentRegistration.registration.token, installation)
            } catch (error) {
                this.#app.logger.warn('Failed to delete stale FCM registration, creating a new one', error)
            }

            return this.#register(gcm)
        }

        if (currentRegistration.createTime + TOKEN_EXPIRATION_MS <= Date.now()) {
            let installation: InstallationEntry

            try {
                installation = await this.#app.installations.getInstallation()
            } catch (error) {
                this.#app.logger.warn('Skipping FCM registration renewal, installation unavailable', error)

                return {
                    ...currentRegistration,
                    keys,
                    subscriptionOptions,
                }
            }

            const registration = await this.#updateRegistration(currentRegistration.registration.token, installation, subscriptionOptions)

            return {
                ...currentRegistration,
                createTime: Date.now(),
                installationFid: installation.fid,
                keys,
                registration,
                subscriptionOptions,
            }
        }

        return {
            ...currentRegistration,
            keys,
            subscriptionOptions,
        }
    }

    #createKeys(): Promise<Keys> {
        return new Promise((resolve, reject) => {
            const dh = crypto.createECDH('prime256v1')

            dh.generateKeys()
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err)
                }

                return resolve({
                    privateKey: dh.getPrivateKey('base64'),
                    publicKey: dh.getPublicKey('base64'),
                    authSecret: buf.toString('base64'),
                })
            })
        })
    }

    async getRegistration(gcmData?: GcmData): Promise<FcmData> {
        const gcmRegistration = gcmData ?? await this.#gcm.getRegistration()

        if (!gcmRegistration) {
            throw new Error('GCM registration not found, cannot get FCM registration')
        }

        const storedRegistration = this.#storage.get('registration') as StoredFcmData | undefined
        let fcmRegistration: FcmData

        if (!storedRegistration) {
            fcmRegistration = await this.#register(gcmRegistration)
        } else {
            fcmRegistration = await this.#migrateStoredRegistration(gcmRegistration, storedRegistration)
            fcmRegistration = await this.#refreshRegistration(gcmRegistration, fcmRegistration)
        }

        this.#storage.set('registration', fcmRegistration)

        return fcmRegistration
    }
}
