const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { generateKeyPairSync, webcrypto } = require('node:crypto')
const test = require('node:test')

const originalFetch = global.fetch
let fetchHandler

global.fetch = (...args) => fetchHandler(...args)

const {
    Analytics,
    FirebaseApp,
    Installations,
    PushSender,
    RemoteConfig,
} = require('../dist')
const Parser = require('../dist/lib/parser').default
const request = require('../dist/utils/request').default
const { MCSProtoTag, Variables } = require('../dist/utils/constants')

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
    expiresAt: Date.now() + 60_000,
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
