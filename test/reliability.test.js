const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { generateKeyPairSync, webcrypto } = require('node:crypto')
const tls = require('node:tls')
const test = require('node:test')

const originalFetch = global.fetch
const originalTlsConnect = tls.connect
let fetchHandler

global.fetch = (...args) => fetchHandler(...args)

const {
    Analytics,
    FirebaseApp,
    Installations,
    PushReceiver,
    PushReceiverLegacy,
    PushSender,
    RemoteConfig,
} = require('../dist')
const Parser = require('../dist/lib/parser').default
const request = require('../dist/utils/request').default
const fetchWithRetry = require('../dist/utils/fetch').default
const GCM = require('../dist/lib/gcm').default
const FCM = require('../dist/lib/fcm').default
const Protos = require('../dist/protobuf').default
const {
    DEFAULT_BUNDLE_ID,
    DEFAULT_CHROME_ID,
    DEFAULT_CHROME_PLATFORM,
    DEFAULT_CHROME_CHANNEL,
    DEFAULT_CHROME_VERSION,
    DEFAULT_TIME_ZONE,
    DEFAULT_VAPID_KEY,
    MCSProtoTag,
    Variables,
} = require('../dist/utils/constants')

const pushConfig = {
    bundleId: DEFAULT_BUNDLE_ID,
    chromeId: DEFAULT_CHROME_ID,
    chromePlatform: DEFAULT_CHROME_PLATFORM,
    chromeChannel: DEFAULT_CHROME_CHANNEL,
    chromeVersion: DEFAULT_CHROME_VERSION,
    timeZone: DEFAULT_TIME_ZONE,
    vapidKey: DEFAULT_VAPID_KEY,
}

const credentials = {
    apiKey: 'api-key',
    authDomain: 'example.test',
    databaseURL: '',
    projectId: 'project-id',
    storageBucket: '',
    messagingSenderId: 'sender-id',
    appId: 'app-id',
    measurementId: 'G-TEST',
}

const installation = {
    fid: 'c123456789012345678901',
    refreshToken: 'refresh-token',
    authToken: 'auth-token',
    // FIS issues 7 day tokens. Stay clear of the refresh margin so tests that only need a
    // usable installation do not trigger an unrelated refresh request.
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
}

function createApp() {
    const values = new Map()
    const app = new FirebaseApp({
        credentials,
        crypto: webcrypto,
        logger: {
            log() {},
            debug() {},
            warn() {},
            error() {},
        },
        storage: {
            get: (key) => values.get(key),
            set: (key, value) => values.set(key, value),
        },
    })

    return { app, values }
}

function encodeVarint(value) {
    const bytes = []

    do {
        let byte = value & 0x7f
        value >>>= 7
        if (value > 0) byte |= 0x80
        bytes.push(byte)
    } while (value > 0)

    return bytes
}

test('release reliability regressions', async (t) => {
    t.after(() => {
        global.fetch = originalFetch
        tls.connect = originalTlsConnect
    })

    await t.test('request retry count is bounded and preserves custom limits', async () => {
        let attempts = 0
        fetchHandler = async () => {
            attempts++
            return new Response('sensitive response', { status: 500, statusText: 'Server Error' })
        }

        await assert.rejects(
            request('https://example.test', undefined, 1),
            (error) => {
                assert.match(error.message, /500 Server Error/)
                assert.doesNotMatch(error.message, /sensitive response/)
                return true
            },
        )
        assert.equal(attempts, 2)
    })

    await t.test('fetchWithRetry bounds server errors but keeps retrying a rejected request', async () => {
        // fetch-retry ignores its own `retries` option when `retryOn` is a function, so the
        // bound lives in src/utils/fetch.ts and is worth pinning: it once retried forever.
        let serverErrors = 0
        fetchHandler = async () => {
            serverErrors++
            return new Response('{}', { status: 503, statusText: 'Service Unavailable' })
        }

        const exhausted = await fetchWithRetry('https://example.test', { retryDelay: 0 })

        assert.equal(exhausted.status, 503)
        assert.equal(serverErrors, 4) // the first attempt plus 3 retries

        // A rejected request is not bounded: it keeps going until it succeeds, so that a
        // request made while offline completes once connectivity returns.
        let rejections = 0
        fetchHandler = async () => {
            rejections++
            if (rejections <= 6) throw new TypeError('fetch failed')
            return new Response('{}', { status: 200 })
        }

        const recovered = await fetchWithRetry('https://example.test', { retryDelay: 0 })

        assert.equal(recovered.status, 200)
        assert.equal(rejections, 7)
    })

    await t.test('installation creation is shared across service instances', async () => {
        const { app } = createApp()
        const secondInstallations = new Installations(app)
        let requests = 0

        fetchHandler = async () => {
            requests++
            return new Response(JSON.stringify({
                fid: installation.fid,
                refreshToken: installation.refreshToken,
                authToken: {
                    token: installation.authToken,
                    expiresIn: '3600s',
                },
            }), { status: 200, headers: { 'content-type': 'application/json' } })
        }

        const [first, second] = await Promise.all([
            app.installations.getInstallation(),
            secondInstallations.getInstallation(),
        ])

        assert.deepEqual(first, second)
        assert.equal(requests, 1)
    })

    await t.test('installation creation reports an HTTP failure', async () => {
        const { app } = createApp()
        fetchHandler = async () => new Response('{}', { status: 400, statusText: 'Bad Request' })

        await assert.rejects(
            app.installations.getInstallation(),
            /Installation creation failed with status 400 'Bad Request'/,
        )
    })

    await t.test('installation creation rejects a response without a usable refresh token', async () => {
        const { app } = createApp()

        fetchHandler = async () => new Response(JSON.stringify({
            fid: installation.fid,
            authToken: { token: 'auth-token', expiresIn: '604800s' },
        }), { status: 200, headers: { 'content-type': 'application/json' } })

        await assert.rejects(
            app.installations.getInstallation(),
            /Installation creation returned no usable refreshToken/,
        )
        assert.equal(app.storage.get('installations.installation'), undefined)
    })

    await t.test('installation creation keeps the requested fid when the response omits it', async () => {
        const { app } = createApp()
        let requestedFid

        fetchHandler = async (url, options) => {
            requestedFid = JSON.parse(options.body).fid
            return new Response(JSON.stringify({
                refreshToken: installation.refreshToken,
                authToken: { token: 'auth-token', expiresIn: '604800s' },
            }), { status: 200, headers: { 'content-type': 'application/json' } })
        }

        const created = await app.installations.getInstallation()

        assert.match(requestedFid, /^[cdef][\w-]{21}$/)
        assert.equal(created.fid, requestedFid)
    })

    await t.test('installation refresh rejects a response without a usable auth token', async () => {
        const { app } = createApp()
        const stored = { ...installation, expiresAt: Date.now() - 1000 }
        app.storage.set('installations.installation', stored)

        fetchHandler = async () => new Response(JSON.stringify({ expiresIn: '604800s' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })

        await assert.rejects(
            app.installations.getInstallation(),
            /Installation refresh returned an unusable auth token/,
        )
        assert.deepEqual(app.storage.get('installations.installation'), stored)

        fetchHandler = async () => new Response(JSON.stringify({ token: 'new-token', expiresIn: 'forever' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })

        await assert.rejects(
            app.installations.getInstallation(),
            /Installation refresh returned an unusable auth token/,
        )
        assert.deepEqual(app.storage.get('installations.installation'), stored)
    })

    await t.test('installation refresh runs before the auth token actually expires', async () => {
        const { app } = createApp()
        app.storage.set('installations.installation', { ...installation, expiresAt: Date.now() + 10 * 60 * 1000 })
        let requests = 0

        fetchHandler = async (url, options) => {
            requests++
            assert.match(String(url), /installations\/c123456789012345678901\/authTokens:generate$/)
            assert.equal(options.headers.Authorization, 'FIS_v2 refresh-token')
            return new Response(JSON.stringify({ token: 'refreshed-token', expiresIn: '604800s' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }

        const refreshed = await app.installations.getInstallation()

        assert.equal(requests, 1)
        assert.equal(refreshed.authToken, 'refreshed-token')
        assert.ok(refreshed.expiresAt > Date.now() + 6 * 24 * 60 * 60 * 1000)
        assert.equal(app.storage.get('installations.installation').authToken, 'refreshed-token')
    })

    for (const status of [401, 404]) {
        await t.test(`installation refresh answering ${status} recreates the installation in place`, async () => {
            const { app } = createApp()
            const stored = { ...installation, expiresAt: Date.now() - 1000 }
            app.storage.set('installations.installation', stored)
            let refreshRequests = 0
            let createRequests = 0

            fetchHandler = async (url) => {
                const href = String(url)

                if (href.endsWith('/authTokens:generate')) {
                    refreshRequests++
                    return new Response('{}', { status, statusText: status === 401 ? 'Unauthorized' : 'Not Found' })
                }

                createRequests++
                return new Response(JSON.stringify({
                    fid: 'dNEWNEWNEWNEWNEWNEWNE',
                    refreshToken: 'new-refresh-token',
                    authToken: { token: 'new-auth-token', expiresIn: '604800s' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            const result = await app.installations.getInstallation()

            assert.notEqual(result.fid, stored.fid)
            assert.equal(result.fid, 'dNEWNEWNEWNEWNEWNEWNE')
            assert.deepEqual(app.storage.get('installations.installation'), result)
            assert.equal(refreshRequests, 1)
            assert.equal(createRequests, 1)
        })
    }

    await t.test('installation refresh answering 401 followed by a failing create rejects and keeps the stored installation intact', async () => {
        const { app } = createApp()
        const stored = { ...installation, expiresAt: Date.now() - 1000 }
        app.storage.set('installations.installation', stored)
        let createRequests = 0

        fetchHandler = async (url) => {
            const href = String(url)

            if (href.endsWith('/authTokens:generate')) {
                return new Response('{}', { status: 401, statusText: 'Unauthorized' })
            }

            createRequests++
            return new Response('{}', { status: 400, statusText: 'Bad Request' })
        }

        await assert.rejects(
            app.installations.getInstallation(),
            /Installation creation failed with status 400 'Bad Request'/,
        )
        // The user's core requirement: a failed self-heal must never lose working credentials.
        assert.deepEqual(app.storage.get('installations.installation'), stored)
        assert.equal(createRequests, 1)
    })

    for (const [description, response] of [
        ['a non-retried status', () => new Response('{}', { status: 400, statusText: 'Bad Request' })],
        ['a 200 with an unusable body', () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })],
    ]) {
        await t.test(`installation refresh transient failure (${description}) serves the stored entry while it is genuinely still usable`, async () => {
            const { app } = createApp()
            const stored = { ...installation, expiresAt: Date.now() + 30 * 60 * 1000 }
            app.storage.set('installations.installation', stored)
            let requests = 0

            fetchHandler = async () => {
                requests++
                return response()
            }

            const result = await app.installations.getInstallation()

            assert.deepEqual(result, stored)
            assert.deepEqual(app.storage.get('installations.installation'), stored)
            assert.equal(requests, 1)
        })
    }

    await t.test('installation refresh transient failure with a genuinely expired token rethrows and keeps credentials', async () => {
        const { app } = createApp()
        const stored = { ...installation, expiresAt: Date.now() - 60 * 60 * 1000 }
        app.storage.set('installations.installation', stored)

        fetchHandler = async () => new Response('{}', { status: 400, statusText: 'Bad Request' })

        await assert.rejects(
            app.installations.getInstallation(),
            /Installation refresh failed with status 400 'Bad Request'/,
        )
        assert.deepEqual(app.storage.get('installations.installation'), stored)
    })

    await t.test('a failed refresh starts a 60s cool-down that skips the next refresh attempt', async () => {
        const { app } = createApp()
        const stored = { ...installation, expiresAt: Date.now() + 30 * 60 * 1000 }
        app.storage.set('installations.installation', stored)
        let requests = 0

        fetchHandler = async () => {
            requests++
            return new Response('{}', { status: 400, statusText: 'Bad Request' })
        }

        const first = await app.installations.getInstallation()
        assert.deepEqual(first, stored)
        assert.equal(requests, 1)

        const second = await app.installations.getInstallation()
        assert.deepEqual(second, stored)
        assert.equal(requests, 1, 'the cool-down must skip the second refresh attempt entirely')
    })

    await t.test('an installation with an implausibly long remaining lifetime (backwards-clock guard) triggers a refresh', async () => {
        const { app } = createApp()
        const stored = { ...installation, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }
        app.storage.set('installations.installation', stored)
        let requests = 0

        fetchHandler = async (url) => {
            requests++
            assert.match(String(url), /authTokens:generate$/)
            return new Response(JSON.stringify({ token: 'clock-fixed-token', expiresIn: '604800s' }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }

        const result = await app.installations.getInstallation()

        assert.equal(requests, 1)
        assert.equal(result.authToken, 'clock-fixed-token')
        assert.ok(result.expiresAt <= Date.now() + 7 * 24 * 60 * 60 * 1000)
        assert.ok(result.expiresAt > Date.now() + 6 * 24 * 60 * 60 * 1000)
    })

    await t.test('deleteInstallation clears the stored entry on success and keeps it on a failed deletion', async () => {
        const { app } = createApp()
        app.storage.set('installations.installation', installation)

        fetchHandler = async () => new Response('{}', { status: 400, statusText: 'Bad Request' })

        await assert.rejects(
            app.installations.deleteInstallation(),
            /Installation deletion failed with status 400 'Bad Request'/,
        )
        assert.deepEqual(app.storage.get('installations.installation'), installation)
        assert.equal(app.installations.storedFid, installation.fid)

        fetchHandler = async () => new Response(null, { status: 200 })

        await app.installations.deleteInstallation()

        assert.equal(app.storage.get('installations.installation'), undefined)
        assert.equal(app.installations.storedFid, undefined)
    })

    await t.test('FCM: a cached, valid registration needs no FIS call at all', async () => {
        const { app } = createApp()
        const gcmData = { androidId: '1', securityToken: '2', token: 'gcm-token' }
        const gcm = new GCM(app, pushConfig)
        const fcm = new FCM(app, gcm, pushConfig)

        fetchHandler = async (url, options) => {
            const href = String(url)

            if (href.includes('firebaseinstallations.googleapis.com') && href.endsWith('/installations')) {
                return new Response(JSON.stringify({
                    fid: installation.fid,
                    refreshToken: installation.refreshToken,
                    authToken: { token: installation.authToken, expiresIn: '604800s' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            if (href.includes('fcmregistrations.googleapis.com') && options.method === 'POST') {
                return new Response(JSON.stringify({ name: 'reg', token: 'fcm-token-steady', web: {} }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            assert.fail(`unexpected request: ${href}`)
        }

        const first = await fcm.getRegistration(gcmData)
        assert.equal(first.registration.token, 'fcm-token-steady')

        // Prove the steady-state path performs no FIS call at all: replace
        // installations.getInstallation() with a spy that fails the test immediately if it
        // is ever invoked. Clearing the stored installation is no longer a safe way to prove
        // this: a missing installation is now treated as "the installation this registration
        // was bound to is gone" and deliberately forces re-registration (see the dedicated
        // FID-mismatch tests below), so it would defeat the point of this test.
        app.installations.getInstallation = async () => assert.fail('unexpected installations.getInstallation() call in the steady state')
        fetchHandler = async (url) => assert.fail(`unexpected request in the steady state: ${url}`)

        const second = await fcm.getRegistration(gcmData)

        assert.deepEqual(second, first)
    })

    await t.test('FCM: installationFid mismatch and a missing installationFid', async (t) => {
        const gcmData = { androidId: '1', securityToken: '2', token: 'gcm-token' }

        function makeFetchHandler(fid, tokenPrefix) {
            let fcmCalls = 0

            return async (url, options) => {
                const href = String(url)

                if (href.includes('firebaseinstallations.googleapis.com') && href.endsWith('/installations')) {
                    return new Response(JSON.stringify({
                        fid,
                        refreshToken: 'refresh-token',
                        authToken: { token: 'auth-token', expiresIn: '604800s' },
                    }), { status: 200, headers: { 'content-type': 'application/json' } })
                }

                if (href.includes('fcmregistrations.googleapis.com') && options.method === 'DELETE') {
                    return new Response(null, { status: 200 })
                }

                if (href.includes('fcmregistrations.googleapis.com') && options.method === 'POST') {
                    fcmCalls++
                    return new Response(JSON.stringify({ name: 'reg', token: `${tokenPrefix}-${fcmCalls}`, web: {} }), {
                        status: 200,
                        headers: { 'content-type': 'application/json' },
                    })
                }

                assert.fail(`unexpected request: ${href}`)
            }
        }

        await t.test('a changed installationFid forces re-registration', async () => {
            const { app } = createApp()
            fetchHandler = makeFetchHandler('cAAAAAAAAAAAAAAAAAAAAA', 'fcm-token')
            const fcm = new FCM(app, new GCM(app, pushConfig), pushConfig)

            const first = await fcm.getRegistration(gcmData)
            assert.equal(first.installationFid, 'cAAAAAAAAAAAAAAAAAAAAA')

            // FIS replaced the installation (self-heal): the stored fid changes, and the
            // FCM registration bound to the old one must be replaced on the next call.
            const stored = app.storage.get('installations.installation')
            app.storage.set('installations.installation', { ...stored, fid: 'dBBBBBBBBBBBBBBBBBBBBB' })

            const second = await fcm.getRegistration(gcmData)

            assert.notEqual(second.registration.token, first.registration.token)
            assert.equal(second.installationFid, 'dBBBBBBBBBBBBBBBBBBBBB')
        })

        await t.test('a stamped registration with no stored installation forces re-registration', async () => {
            const { app } = createApp()
            fetchHandler = makeFetchHandler('cAAAAAAAAAAAAAAAAAAAAA', 'fcm-token')
            const fcm = new FCM(app, new GCM(app, pushConfig), pushConfig)

            const first = await fcm.getRegistration(gcmData)
            assert.equal(first.installationFid, 'cAAAAAAAAAAAAAAAAAAAAA')

            // Simulate deleteInstallation(): the stored installation is gone entirely, not
            // just replaced with a different fid, so `installations.storedFid` reads as
            // undefined rather than "different but present".
            app.storage.set('installations.installation', undefined)

            let deleteCalls = 0
            const nextFetchHandler = makeFetchHandler('dBBBBBBBBBBBBBBBBBBBBB', 'fcm-token-new')
            fetchHandler = async (url, options) => {
                if (String(url).includes('fcmregistrations.googleapis.com') && options.method === 'DELETE') {
                    deleteCalls++
                }
                return nextFetchHandler(url, options)
            }

            const second = await fcm.getRegistration(gcmData)

            assert.notEqual(second.registration.token, first.registration.token)
            assert.equal(second.installationFid, 'dBBBBBBBBBBBBBBBBBBBBB')
            // No installation is left to own the old FCM registration, so it cannot be
            // deleted -- only re-registered from scratch.
            assert.equal(deleteCalls, 0)
        })

        await t.test('a missing installationFid does not force re-registration', async () => {
            const { app } = createApp()
            fetchHandler = makeFetchHandler('cAAAAAAAAAAAAAAAAAAAAA', 'fcm-token')
            const fcm = new FCM(app, new GCM(app, pushConfig), pushConfig)

            const first = await fcm.getRegistration(gcmData)

            const stripped = { ...app.storage.get('fcm.registration') }
            delete stripped.installationFid
            app.storage.set('fcm.registration', stripped)

            // A different fid is stored too, to prove a *missing* stamp is treated
            // differently from a *mismatched* one: this must not force re-registration.
            const stored = app.storage.get('installations.installation')
            app.storage.set('installations.installation', { ...stored, fid: 'dBBBBBBBBBBBBBBBBBBBBB' })

            fetchHandler = async (url) => assert.fail(`unexpected request: ${url}`)

            const second = await fcm.getRegistration(gcmData)

            assert.equal(second.registration.token, first.registration.token)
        })
    })

    await t.test('PushReceiver emits ON_TOKEN_CHANGE only when the FCM token actually rotates', async () => {
        const { app } = createApp()
        const CHECKIN_URL = 'https://android.clients.google.com/checkin'
        const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3'
        const AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse
        let fcmRegistrationRequests = 0

        fetchHandler = async (url, options) => {
            const href = String(url)

            if (href === CHECKIN_URL) {
                const buffer = AndroidCheckinResponse.encode(AndroidCheckinResponse.create({
                    statsOk: true,
                    androidId: 1,
                    securityToken: 2,
                })).finish()
                return new Response(buffer, { status: 200 })
            }

            if (href === REGISTER_URL) {
                return new Response('id=gcm-token-initial', { status: 200 })
            }

            if (href.includes('firebaseinstallations.googleapis.com') && href.endsWith('/installations')) {
                return new Response(JSON.stringify({
                    fid: installation.fid,
                    refreshToken: installation.refreshToken,
                    authToken: { token: installation.authToken, expiresIn: '604800s' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            if (href.includes('fcmregistrations.googleapis.com') && options.method === 'DELETE') {
                return new Response(null, { status: 200 })
            }

            if (href.includes('fcmregistrations.googleapis.com') && options.method === 'POST') {
                fcmRegistrationRequests++
                return new Response(JSON.stringify({ name: 'reg', token: `fcm-token-${fcmRegistrationRequests}`, web: {} }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            throw new Error(`unexpected request: ${href}`)
        }

        // connect() drives a real tls.TLSSocket and a full MCS login handshake; faking that
        // is out of scope for this suite. Instead tls.connect is made to fail synchronously:
        // by that point the installations/FCM registration work ON_TOKEN_CHANGE depends on
        // has already run, and the resulting rejection is asserted for instead of ignored.
        tls.connect = () => { throw new Error('tls.connect is not exercised by this test') }

        const events = []
        const pushReceiver = new PushReceiver(app)
        pushReceiver.on('ON_TOKEN_CHANGE', () => events.push(pushReceiver.fcmToken))

        await assert.rejects(pushReceiver.connect(), /tls\.connect is not exercised by this test/)
        assert.equal(events.length, 0, 'no ON_TOKEN_CHANGE on the very first connect')
        assert.equal(pushReceiver.fcmToken, 'fcm-token-1')

        // Simulate the GCM token itself rotating (e.g. a fresh registration server-side) so
        // the next connect() call actually produces a different FCM token.
        const gcmRegistration = app.storage.get('gcm.registration')
        app.storage.set('gcm.registration', { ...gcmRegistration, token: 'gcm-token-rotated' })

        await assert.rejects(pushReceiver.connect(), /tls\.connect is not exercised by this test/)
        assert.deepEqual(events, ['fcm-token-2'])
        assert.equal(pushReceiver.fcmToken, 'fcm-token-2')
    })

    await t.test('PushReceiver config: a partial override merges over the defaults', async () => {
        const { app } = createApp()
        const CHECKIN_URL = 'https://android.clients.google.com/checkin'
        const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3'
        const AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse
        let registerBody

        fetchHandler = async (url, options) => {
            const href = String(url)

            if (href === CHECKIN_URL) {
                const buffer = AndroidCheckinResponse.encode(AndroidCheckinResponse.create({
                    statsOk: true,
                    androidId: 1,
                    securityToken: 2,
                })).finish()
                return new Response(buffer, { status: 200 })
            }

            if (href === REGISTER_URL) {
                registerBody = options.body
                return new Response('id=gcm-token-initial', { status: 200 })
            }

            if (href.includes('firebaseinstallations.googleapis.com') && href.endsWith('/installations')) {
                return new Response(JSON.stringify({
                    fid: installation.fid,
                    refreshToken: installation.refreshToken,
                    authToken: { token: installation.authToken, expiresIn: '604800s' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            if (href.includes('fcmregistrations.googleapis.com') && options.method === 'POST') {
                return new Response(JSON.stringify({ name: 'reg', token: 'fcm-token', web: {} }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            throw new Error(`unexpected request: ${href}`)
        }

        // As in the ON_TOKEN_CHANGE test above, tls.connect is made to fail synchronously:
        // the checkin/register work this test cares about has already run by that point.
        tls.connect = () => { throw new Error('tls.connect is not exercised by this test') }

        const pushReceiver = new PushReceiver(app, { config: { bundleId: 'custom.bundle' } })

        await assert.rejects(pushReceiver.connect(), /tls\.connect is not exercised by this test/)

        const params = new URLSearchParams(registerBody)
        assert.ok(params.get('X-subtype').startsWith('wp:custom.bundle#'))
        assert.equal(params.get('sender'), DEFAULT_VAPID_KEY)
    })

    await t.test('PushReceiver config: vapidKey is the one field that falls back on an explicit undefined', async () => {
        const { app } = createApp()
        const CHECKIN_URL = 'https://android.clients.google.com/checkin'
        const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3'
        const AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse
        let registerBody

        fetchHandler = async (url, options) => {
            const href = String(url)

            if (href === CHECKIN_URL) {
                const buffer = AndroidCheckinResponse.encode(AndroidCheckinResponse.create({
                    statsOk: true,
                    androidId: 1,
                    securityToken: 2,
                })).finish()
                return new Response(buffer, { status: 200 })
            }

            if (href === REGISTER_URL) {
                registerBody = options.body
                return new Response('id=gcm-token-initial', { status: 200 })
            }

            if (href.includes('firebaseinstallations.googleapis.com') && href.endsWith('/installations')) {
                return new Response(JSON.stringify({
                    fid: installation.fid,
                    refreshToken: installation.refreshToken,
                    authToken: { token: installation.authToken, expiresIn: '604800s' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            if (href.includes('fcmregistrations.googleapis.com') && options.method === 'POST') {
                return new Response(JSON.stringify({ name: 'reg', token: 'fcm-token', web: {} }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            throw new Error(`unexpected request: ${href}`)
        }

        tls.connect = () => { throw new Error('tls.connect is not exercised by this test') }

        const pushReceiver = new PushReceiver(app, { config: { vapidKey: undefined } })

        await assert.rejects(pushReceiver.connect(), /tls\.connect is not exercised by this test/)

        const params = new URLSearchParams(registerBody)
        assert.equal(params.get('sender'), DEFAULT_VAPID_KEY)

        // Every other field still throws on an explicit undefined.
        assert.throws(() => new PushReceiver(app, { config: { bundleId: undefined } }), (error) => {
            assert.deepEqual(error.missingProperties, ['bundleId'])
            return true
        })
    })

    await t.test('GCM and FCM assert their config at construction', () => {
        const { app } = createApp()

        assert.throws(() => new GCM(app, {}), (error) => {
            assert.deepEqual(error.missingProperties, [
                'bundleId', 'chromeId', 'chromePlatform', 'chromeChannel', 'chromeVersion', 'timeZone', 'vapidKey',
            ])
            return true
        })

        const gcm = new GCM(app, pushConfig)

        assert.throws(() => new FCM(app, gcm, {}), (error) => {
            assert.deepEqual(error.missingProperties, ['vapidKey'])
            return true
        })
    })

    await t.test('PushReceiverLegacy constructs from { firebase } only, keeping the vapidKey persistence split', () => {
        const pushReceiver = new PushReceiverLegacy({ firebase: credentials })

        assert.equal(pushReceiver.config.vapidKey, '')
    })

    await t.test('Remote Config clears a failed in-flight request and handles 304', async () => {
        const { app } = createApp()
        app.storage.set('installations.installation', installation)
        app.storage.set('remote_config.config', { existing: 'value' })
        app.storage.set('remote_config.lastFetchTimestamp', Date.now())

        const remoteConfig = new RemoteConfig(app)
        let requests = 0
        fetchHandler = async () => {
            requests++
            return new Response('{}', { status: 400, statusText: 'Bad Request' })
        }

        await assert.rejects(remoteConfig.fetchAndActivate(true), /status: 400/)
        await assert.rejects(remoteConfig.fetchAndActivate(true), /status: 400/)
        assert.equal(requests, 2)

        const previousTimestamp = app.storage.get('remote_config.lastFetchTimestamp')
        fetchHandler = async () => new Response(null, { status: 304 })
        await remoteConfig.fetchAndActivate(true)
        assert.ok(app.storage.get('remote_config.lastFetchTimestamp') >= previousTimestamp)
        remoteConfig.destroy()
    })

    await t.test('Remote Config destroy aborts an in-flight request without retrying', async () => {
        const { app } = createApp()
        app.storage.set('installations.installation', installation)
        app.storage.set('remote_config.config', { existing: 'value' })
        app.storage.set('remote_config.lastFetchTimestamp', Date.now())
        const remoteConfig = new RemoteConfig(app)
        let requests = 0

        fetchHandler = async (url, options) => {
            requests++
            return new Promise((resolve, reject) => {
                options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
            })
        }

        const pendingFetch = remoteConfig.fetchAndActivate(true)
        await new Promise((resolve) => setImmediate(resolve))
        remoteConfig.destroy()

        await assert.rejects(pendingFetch, (error) => error.name === 'AbortError')
        await assert.rejects(remoteConfig.fetchAndActivate(), /RemoteConfig has been destroyed/)
        assert.equal(requests, 1)
    })

    await t.test('Analytics rolls sessions after 30 minutes of inactivity', async () => {
        const { app } = createApp()
        app.storage.set('installations.installation', installation)
        app.storage.set('analytics.sessionId', 'old-session')
        app.storage.set('analytics.sessionCount', 1)
        app.storage.set('analytics.lastEventTime', Date.now() - 31 * 60 * 1000)
        const urls = []

        fetchHandler = async (url) => {
            urls.push(new URL(url))
            return new Response(null, { status: 204 })
        }

        const analytics = new Analytics({ app })
        await analytics.logEvent('first')
        await analytics.logEvent('second')

        assert.notEqual(urls[0].searchParams.get('sid'), 'old-session')
        assert.equal(urls[0].searchParams.get('sct'), '2')
        assert.equal(urls[1].searchParams.get('sid'), urls[0].searchParams.get('sid'))
        assert.equal(urls[1].searchParams.get('sct'), '2')
    })

    await t.test('PushSender reuses an unexpired OAuth token', async () => {
        const { privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        })
        let oauthRequests = 0
        let messageRequests = 0

        fetchHandler = async (url) => {
            if (String(url).includes('accounts.google.com')) {
                oauthRequests++
                return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })
            }

            messageRequests++
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
        }

        const sender = new PushSender({
            project_id: 'project-id',
            private_key: privateKey,
            client_email: 'sender@example.test',
        })

        await sender.send({ title: 'one', body: 'first' }, 'fcm-token')
        await sender.send({ title: 'two', body: 'second' }, 'fcm-token')

        assert.equal(oauthRequests, 1)
        assert.equal(messageRequests, 2)
    })

    await t.test('Parser rejects oversized and malformed frames through its error event', () => {
        const { app } = createApp()
        const oversizedSocket = new EventEmitter()
        const oversizedParser = new Parser(app, oversizedSocket)
        let oversizedError
        oversizedParser.on('error', (error) => { oversizedError = error })

        oversizedSocket.emit('data', Buffer.from([
            Variables.kMCSVersion,
            MCSProtoTag.kLoginResponseTag,
            ...encodeVarint(8 * 1024 * 1024 + 1),
        ]))
        assert.match(oversizedError.message, /Invalid MCS message size/)

        const malformedSocket = new EventEmitter()
        const malformedParser = new Parser(app, malformedSocket)
        let malformedError
        malformedParser.on('error', (error) => { malformedError = error })
        malformedSocket.emit('data', Buffer.from([
            Variables.kMCSVersion,
            MCSProtoTag.kLoginResponseTag,
            2,
            0x08,
            0x80,
        ]))
        assert.ok(malformedError instanceof Error)
    })
})
