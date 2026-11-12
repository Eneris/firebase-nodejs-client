// importLegacyState(): 0.3.x RemoteConfig/Installations storage and @eneris/push-receiver
// credentials into the current storage layout.
const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { createECDH, randomBytes } = require('node:crypto')

// Loaded first and on its own: consumers that cannot load app.ts (dot-prop is ESM only) must
// still be able to require this module.
const { importLegacyState } = require('../dist/legacyImport')
const loadedWithLegacyImport = Object.keys(require.cache)

const helpers = require('./helpers')
const { PushReceiver, RemoteConfig } = require('../dist')

const appId = 'app-id'
const projectId = 'project-id'
const RC_FID = 'cLEGACYRCFIDAAAAAAAAAA'
const PUSH_FID = 'cLEGACYPUSHFIDAAAAAAAA'

function legacyKeys() {
    const dh = createECDH('prime256v1')
    dh.generateKeys()

    return {
        privateKey: dh.getPrivateKey('base64'),
        publicKey: dh.getPublicKey('base64'),
        authSecret: randomBytes(16).toString('base64'),
    }
}

function legacyRemoteConfigStore() {
    return {
        installations: {
            [projectId]: {
                [appId]: {
                    installation: {
                        name: `projects/123/installations/${RC_FID}`,
                        fid: RC_FID,
                        refreshToken: 'rc-refresh-token',
                        authToken: { token: 'rc-auth-token', expiresIn: 604_800_000 },
                    },
                },
            },
        },
        remoteConfig: {
            [appId]: {
                config: { desktop_urls: '["a"]', other: 'value' },
                etag: 'etag-legacy',
                lastFetchTimestamp: 1_700_000_000_000,
            },
        },
    }
}

function legacyPushState(keys = legacyKeys()) {
    return {
        credentials: {
            gcm: { androidId: '5555', securityToken: '6666', appId: 'wp:receiver.push.com#legacy', token: 'gcm-legacy-token' },
            fcm: {
                token: 'fcm-legacy-token',
                installation: { token: 'push-auth-token', createdAt: 1, expiresIn: 2, refreshToken: 'push-refresh-token', fid: PUSH_FID },
            },
            keys,
            config: { bundleId: 'receiver.push.com', projectId, vapidKey: '' },
        },
        persistentIds: ['p1', 'p2'],
    }
}

function mapStorage(values = new Map()) {
    return {
        values,
        get: (key) => values.get(key),
        set: (key, value) => values.set(key, value),
    }
}

test('importLegacyState', async (t) => {
    await t.test('loads without app.ts or dot-prop', () => {
        const dist = path.resolve(__dirname, '../dist')

        assert.ok(!loadedWithLegacyImport.includes(path.join(dist, 'app.js')), 'dist/app.js loaded')
        assert.ok(!loadedWithLegacyImport.some((file) => file.includes(`${path.sep}dot-prop${path.sep}`)), 'dot-prop loaded')
    })

    await t.test('maps every legacy piece to its current key', () => {
        const storage = mapStorage()
        const push = legacyPushState()

        const written = importLegacyState({ appId, projectId, storage }, { remoteConfig: legacyRemoteConfigStore(), push })

        assert.deepEqual(written.sort(), [
            'app-id.fcm.registration',
            'app-id.gcm.registration',
            'app-id.installations.installation',
            'app-id.push_receiver.announced_token',
            'app-id.push_receiver.last_persistent_ids',
            'app-id.remote_config.config',
            'app-id.remote_config.etag',
            'app-id.remote_config.lastFetchTimestamp',
        ])
        assert.deepEqual(storage.get('app-id.installations.installation'), {
            fid: RC_FID,
            refreshToken: 'rc-refresh-token',
            authToken: 'rc-auth-token',
            expiresAt: 0,
        })
        assert.deepEqual(storage.get('app-id.remote_config.config'), { desktop_urls: '["a"]', other: 'value' })
        assert.equal(storage.get('app-id.remote_config.etag'), 'etag-legacy')
        assert.equal(storage.get('app-id.remote_config.lastFetchTimestamp'), 1_700_000_000_000)
        assert.deepEqual(storage.get('app-id.gcm.registration'), push.credentials.gcm)

        const fcm = storage.get('app-id.fcm.registration')
        assert.deepEqual(Object.keys(fcm).sort(), ['keys', 'registration'], 'no createTime, subscriptionOptions or installationFid')
        assert.equal(fcm.registration.token, 'fcm-legacy-token')
        assert.equal(fcm.registration.web.endpoint, 'https://fcm.googleapis.com/fcm/send/gcm-legacy-token')
        assert.equal(fcm.keys.privateKey, push.credentials.keys.privateKey)

        assert.deepEqual(storage.get('app-id.push_receiver.last_persistent_ids'), ['p1', 'p2'])
        assert.equal(storage.get('app-id.push_receiver.announced_token'), 'fcm-legacy-token')
    })

    await t.test('never overwrites, so a second run writes nothing', () => {
        const storage = mapStorage()
        storage.set('app-id.installations.installation', { fid: 'cCURRENTCURRENTCURRENT', refreshToken: 'r', authToken: 'a', expiresAt: 1 })
        storage.set('app-id.remote_config.etag', 'etag-current')

        const legacy = { remoteConfig: legacyRemoteConfigStore(), push: legacyPushState() }
        const written = importLegacyState({ appId, projectId, storage }, legacy)

        assert.equal(storage.get('app-id.installations.installation').fid, 'cCURRENTCURRENTCURRENT')
        assert.ok(!written.some((key) => key.startsWith('app-id.remote_config.')), 'the Remote Config group is skipped as a whole')
        assert.equal(storage.get('app-id.remote_config.config'), undefined)
        assert.ok(written.includes('app-id.gcm.registration'))

        assert.deepEqual(importLegacyState({ appId, projectId, storage }, legacy), [])
    })

    for (const key of ['config', 'etag', 'lastFetchTimestamp']) {
        await t.test(`skips the whole Remote Config group when remote_config.${key} is already set`, () => {
            const storage = mapStorage()
            storage.set(`app-id.remote_config.${key}`, key === 'lastFetchTimestamp' ? 1 : key === 'etag' ? 'etag-current' : { current: 'value' })

            const written = importLegacyState({ appId, projectId, storage }, { remoteConfig: legacyRemoteConfigStore() })

            assert.ok(!written.some((written) => written.startsWith('app-id.remote_config.')))
            assert.equal(storage.values.size, 2, 'only the pre-set key and the installation')
        })
    }

    await t.test('writes the announced token and persistent ids even when the GCM credentials are not imported', () => {
        const storage = mapStorage()
        storage.set('app-id.gcm.registration', { androidId: '1', securityToken: '2', appId: 'wp:x', token: 'gcm-current' })

        const written = importLegacyState({ appId, projectId, storage }, { push: legacyPushState() })

        assert.ok(written.includes('app-id.push_receiver.announced_token'))
        assert.ok(written.includes('app-id.push_receiver.last_persistent_ids'))
        assert.equal(storage.get('app-id.push_receiver.announced_token'), 'fcm-legacy-token')
    })

    await t.test('skips an FCM registration when the GCM credentials were not imported', () => {
        const storage = mapStorage()
        storage.set('app-id.gcm.registration', { androidId: '1', securityToken: '2', appId: 'wp:x', token: 'gcm-current' })

        const written = importLegacyState({ appId, projectId, storage }, { push: legacyPushState() })

        assert.ok(!written.includes('app-id.fcm.registration'))
        assert.equal(storage.get('app-id.gcm.registration').token, 'gcm-current')
    })

    await t.test('falls back to the push-receiver installation when the 0.3.x one is missing', () => {
        const storage = mapStorage()

        importLegacyState({ appId, projectId, storage }, { remoteConfig: {}, push: legacyPushState() })

        assert.deepEqual(storage.get('app-id.installations.installation'), {
            fid: PUSH_FID,
            refreshToken: 'push-refresh-token',
            authToken: 'push-auth-token',
            expiresAt: 0,
        })
    })

    await t.test('keeps only the last 30 persistent ids', () => {
        const storage = mapStorage()
        const ids = Array.from({ length: 40 }, (_, index) => `id-${index}`)

        importLegacyState({ appId, projectId, storage }, { push: { persistentIds: [...ids, 7, null] } })

        assert.deepEqual(storage.get('app-id.push_receiver.last_persistent_ids'), ids.slice(-30))
    })

    await t.test('skips malformed input without throwing', () => {
        const inputs = [
            undefined,
            null,
            {},
            { remoteConfig: 'text', push: 'text' },
            { remoteConfig: { installations: { [projectId]: { [appId]: { installation: { fid: '' } } } }, remoteConfig: { [appId]: { config: [1, 2] } } } },
            { remoteConfig: { remoteConfig: { [appId]: { config: null, etag: 'e' } } } },
            { push: { credentials: { gcm: { androidId: 5 }, fcm: { token: 7 }, keys: 'k' }, persistentIds: 'p' } },
            { push: { credentials: { fcm: { installation: { fid: PUSH_FID } } } } },
        ]

        for (const legacy of inputs) {
            const storage = mapStorage()
            assert.deepEqual(importLegacyState({ appId, projectId, storage }, legacy), [], JSON.stringify(legacy))
            assert.equal(storage.values.size, 0)
        }
    })

    await t.test('an imported state connects under the imported FID and announces the replaced legacy token', async (t) => {
        const values = new Map()
        importLegacyState({ appId, projectId, storage: mapStorage(values) }, {
            remoteConfig: legacyRemoteConfigStore(),
            push: legacyPushState(),
        })

        const { app } = helpers.createApp({ values })
        const sockets = helpers.installFakeTls(t)
        const requests = []
        const checkinIds = []
        const Protos = require('../dist/protobuf').default
        const push = helpers.pushFetchHandler({
            // A checkin of known credentials echoes them back.
            checkin: (count, options) => {
                checkinIds.push(String(Protos.checkin_proto.AndroidCheckinRequest.decode(options.body).id))
                return helpers.checkinResponse({ androidId: 5555, securityToken: 6666 })
            },
        })
        helpers.setFetchHandler(async (url, options = {}) => {
            const href = String(url)
            requests.push(`${options.method ?? 'GET'} ${href.replace(/\?.*$/, '')}`)

            if (href.endsWith(`/installations/${RC_FID}/authTokens:generate`)) {
                assert.equal(options.headers.Authorization, 'FIS_v2 rc-refresh-token')
                return helpers.jsonResponse({ token: 'rc-auth-token-refreshed', expiresIn: '604800s' })
            }

            if (href.includes('firebaseremoteconfig.googleapis.com')) {
                return new Response(null, { status: 304 })
            }

            return push.handler(url, options)
        })

        const remoteConfig = new RemoteConfig(app, { cacheMaxAge: 0 })
        t.after(() => remoteConfig.destroy())
        assert.equal(remoteConfig.getValue('other').asString(), 'value', 'the cached config is served right away')

        const receiver = new PushReceiver(app, {})
        const changes = []
        receiver.on('ON_TOKEN_CHANGE', (...args) => changes.push(args))
        t.after(() => receiver.destroy())

        const connected = receiver.connect()
        await helpers.waitFor(() => sockets.length === 1, 'socket')
        sockets[0].login()
        await connected

        assert.equal(app.installations.storedFid, RC_FID, 'no new installation was created')
        assert.equal(push.counts.fisCreate, 0)
        assert.deepEqual(checkinIds, ['5555'], 'checked in with the imported android id')
        assert.equal(push.counts.register, 0, 'the GCM identity is kept')
        assert.equal(app.storage.get('gcm.registration').androidId, '5555')
        assert.equal(push.counts.fcmDelete, 1, 'the legacy FCM token is deleted')
        assert.equal(push.counts.fcmCreate, 1)
        assert.equal(app.storage.get('fcm.registration').installationFid, RC_FID)
        assert.deepEqual(changes, [['fcm-token-1', 'fcm-legacy-token']])
        assert.ok(requests.some((request) => request.endsWith('/authTokens:generate')))
    })
})
