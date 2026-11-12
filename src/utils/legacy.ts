// Conversions from the @eneris/push-receiver credentials shape to the current one. Shared by
// pushReceiverLegacy.ts (live adapter) and legacyImport.ts (one-off import), so this module
// must stay free of runtime imports that pull in app.ts (dot-prop is ESM only): type imports
// only, plus the dependency-free utils below.
import { escape as toBase64Url } from './base64'
import { DEFAULT_VAPID_KEY, FCM_API } from './constants'

import type { InstallationEntry } from '../installations'
import type { FcmRegistration, Keys, SubscriptionOptions } from '../lib/fcm'

// @eneris/push-receiver's installation entry: `createdAt` and `expiresIn` in ms.
export interface InstallationData {
    token: string
    createdAt: number
    expiresIn: number
    refreshToken: string
    fid: string
}

export function normalizeBase64(value: string): string {
    const normalizedValue = String(value).replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (normalizedValue.length % 4)) % 4)

    return normalizedValue + padding
}

export function legacyInstallationToCurrent(installation: InstallationData): InstallationEntry {
    return {
        fid: installation.fid,
        refreshToken: installation.refreshToken,
        authToken: installation.token,
        expiresAt: installation.createdAt + installation.expiresIn,
    }
}

// The current FCM registration fields a legacy FCM token + GCM token + keys stand for.
export function legacyFcmToCurrent(fcmToken: string, gcmToken: string, keys: Keys, vapidKey: string): {
    registration: FcmRegistration
    keys: Keys
    subscriptionOptions: SubscriptionOptions
} {
    const normalizedKeys = {
        privateKey: normalizeBase64(keys.privateKey),
        publicKey: normalizeBase64(keys.publicKey),
        authSecret: normalizeBase64(keys.authSecret),
    }

    const subscriptionOptions = {
        auth: toBase64Url(normalizedKeys.authSecret),
        endpoint: `${FCM_API}fcm/send/${gcmToken}`,
        p256dh: toBase64Url(normalizedKeys.publicKey),
        vapidKey,
    }

    const web: FcmRegistration['web'] = {
        auth: subscriptionOptions.auth,
        endpoint: subscriptionOptions.endpoint,
        p256dh: subscriptionOptions.p256dh,
    }

    if (subscriptionOptions.vapidKey !== DEFAULT_VAPID_KEY) {
        web.applicationPubKey = subscriptionOptions.vapidKey
    }

    return {
        registration: {
            name: '',
            token: fcmToken,
            web,
        },
        keys: normalizedKeys,
        subscriptionOptions,
    }
}
