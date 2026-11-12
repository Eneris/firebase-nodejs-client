// One-off import of state persisted by the libraries this one replaces, so an upgrade keeps the
// installation (FID), the cached Remote Config and the push identity instead of starting over:
// - firebase-nodejs-client 0.3.x RemoteConfig/Installations storage (not appId-prefixed):
//   `installations.<projectId>.<appId>.installation` = { fid, refreshToken, authToken: { token,
//   expiresIn } } and `remoteConfig.<appId>.{config, etag, lastFetchTimestamp}`;
// - @eneris/push-receiver state: `credentials` ({ gcm, fcm, keys, config }) and `persistentIds`.
//
// Must stay free of runtime imports that pull in app.ts (dot-prop is ESM only), so a CommonJS
// consumer that cannot load the rest of the library (a Jest test) can still require
// `dist/legacyImport`.
import { legacyFcmToCurrent, legacyInstallationToCurrent } from './utils/legacy'
import { DEFAULT_VAPID_KEY, MAX_STORED_PERSISTENT_IDS } from './utils/constants'

import type { InstallationEntry } from './installations'

export interface LegacyImportStorage {
    // Raw keys, the same storage FirebaseApp is given (FirebaseApp adds the appId prefix itself,
    // this function adds it here). Keys are dot paths, as with `conf`.
    get(key: string): unknown
    set(key: string, value: unknown): void
}

export interface LegacyImportTarget {
    appId: string
    projectId: string
    storage: LegacyImportStorage
}

export interface LegacyState {
    // The whole 0.3.x RemoteConfig/Installations store object.
    remoteConfig?: unknown
    // The @eneris/push-receiver state the app persisted.
    push?: {
        credentials?: unknown
        persistentIds?: unknown
    }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0
}

function pick(value: unknown, ...path: string[]): unknown {
    let current = value

    for (const key of path) {
        if (!isRecord(current)) return undefined
        current = current[key]
    }

    return current
}

// expiresAt 0 makes the first getInstallation() refresh the auth token: the legacy entries'
// expiry cannot be trusted (0.3.x never set the creationTime its expiry check needed, and
// @eneris/push-receiver never refreshed its token). A refresh rejected with 401/404 makes
// Installations create a new FID, as for any other dead installation.
function importInstallation(remoteConfig: unknown, credentials: unknown, projectId: string, appId: string): InstallationEntry | undefined {
    const stored = pick(remoteConfig, 'installations', projectId, appId, 'installation')

    if (isRecord(stored) && isNonEmptyString(stored.fid) && isNonEmptyString(stored.refreshToken)) {
        const authToken = pick(stored, 'authToken', 'token')

        return {
            fid: stored.fid,
            refreshToken: stored.refreshToken,
            authToken: isNonEmptyString(authToken) ? authToken : '',
            expiresAt: 0,
        }
    }

    const pushInstallation = pick(credentials, 'fcm', 'installation')

    if (isRecord(pushInstallation) && isNonEmptyString(pushInstallation.fid) && isNonEmptyString(pushInstallation.refreshToken)) {
        const converted = legacyInstallationToCurrent({
            fid: pushInstallation.fid,
            refreshToken: pushInstallation.refreshToken,
            token: isNonEmptyString(pushInstallation.token) ? pushInstallation.token : '',
            createdAt: 0,
            expiresIn: 0,
        })

        return { ...converted, expiresAt: 0 }
    }

    return undefined
}

// Writes what it finds under `${appId}.` in the current layout and returns the keys it wrote.
// Never overwrites a key that already holds a value, so it is safe to run more than once and
// never clobbers state the current version already created. Malformed or missing pieces are
// skipped; it does not throw on any input (errors from `storage` itself still propagate).
//
// What it writes:
// - `installations.installation`: from the 0.3.x installation, else from the push-receiver
//   one. The 0.3.x one wins because Remote Config conditions are bucketed by that FID.
// - `remote_config.config`/`etag`/`lastFetchTimestamp`: only together, and only while none of
//   them is set, so an etag never ends up paired with a different config.
// - `gcm.registration`: the push-receiver GCM credentials (keeps the android id).
// - `fcm.registration`: only with the GCM credentials, and deliberately without `createTime`,
//   `subscriptionOptions` and `installationFid`. The legacy FCM token belongs to the
//   push-receiver's own FID, so lib/fcm.ts deletes it (best effort) and registers a new token
//   under the imported FID on the first connect.
// - `push_receiver.last_persistent_ids`: the last MAX_STORED_PERSISTENT_IDS ids.
// - `push_receiver.announced_token`: the legacy FCM token, so the token that replaces it is
//   announced as ON_TOKEN_CHANGE(newToken, legacyToken).
export function importLegacyState(target: LegacyImportTarget, legacy: LegacyState): string[] {
    const { appId, projectId, storage } = target
    const written: string[] = []
    const remoteConfig = legacy?.remoteConfig
    const credentials = legacy?.push?.credentials

    const isSet = (key: string) => storage.get(`${appId}.${key}`) !== undefined
    const write = (key: string, value: unknown): boolean => {
        if (isSet(key)) return false

        storage.set(`${appId}.${key}`, value)
        written.push(`${appId}.${key}`)

        return true
    }

    const installation = importInstallation(remoteConfig, credentials, projectId, appId)

    if (installation) {
        write('installations.installation', installation)
    }

    const remoteConfigState = pick(remoteConfig, 'remoteConfig', appId)
    const config = pick(remoteConfigState, 'config')

    if (isRecord(config) && !isSet('remote_config.config') && !isSet('remote_config.etag') && !isSet('remote_config.lastFetchTimestamp')) {
        const etag = pick(remoteConfigState, 'etag')
        const lastFetchTimestamp = pick(remoteConfigState, 'lastFetchTimestamp')

        write('remote_config.config', config)

        if (typeof etag === 'string') {
            write('remote_config.etag', etag)
        }

        if (typeof lastFetchTimestamp === 'number' && Number.isFinite(lastFetchTimestamp)) {
            write('remote_config.lastFetchTimestamp', lastFetchTimestamp)
        }
    }

    const gcm = pick(credentials, 'gcm')
    let importedGcmToken: string | undefined

    if (isRecord(gcm)
        && isNonEmptyString(gcm.androidId)
        && isNonEmptyString(gcm.securityToken)
        && isNonEmptyString(gcm.appId)
        && isNonEmptyString(gcm.token)) {
        const imported = write('gcm.registration', {
            androidId: gcm.androidId,
            securityToken: gcm.securityToken,
            appId: gcm.appId,
            token: gcm.token,
        })

        importedGcmToken = imported ? gcm.token : undefined
    }

    const fcmToken = pick(credentials, 'fcm', 'token')
    const keys = pick(credentials, 'keys')

    if (importedGcmToken
        && isNonEmptyString(fcmToken)
        && isRecord(keys)
        && isNonEmptyString(keys.privateKey)
        && isNonEmptyString(keys.publicKey)
        && isNonEmptyString(keys.authSecret)) {
        const vapidKey = pick(credentials, 'config', 'vapidKey')
        const current = legacyFcmToCurrent(
            fcmToken,
            importedGcmToken,
            { privateKey: keys.privateKey, publicKey: keys.publicKey, authSecret: keys.authSecret },
            isNonEmptyString(vapidKey) ? vapidKey : DEFAULT_VAPID_KEY,
        )

        write('fcm.registration', { registration: current.registration, keys: current.keys })
    }

    const persistentIds = legacy?.push?.persistentIds

    if (Array.isArray(persistentIds)) {
        const ids = persistentIds.filter(isNonEmptyString).slice(-MAX_STORED_PERSISTENT_IDS)

        if (ids.length > 0) {
            write('push_receiver.last_persistent_ids', ids)
        }
    }

    if (isNonEmptyString(fcmToken)) {
        write('push_receiver.announced_token', fcmToken)
    }

    return written
}
