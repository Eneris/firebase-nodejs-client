// PushReceiver connection lifecycle over a fake TLS socket (see test/helpers.js): login,
// retry/backoff, listener isolation, login timeout, reconnect() and token announcements.
const helpers = require('./helpers')
const assert = require('node:assert/strict')
const test = require('node:test')

const { PushReceiver } = require('../dist')

const { createApp, installFakeTls, pushFetchHandler, setFetchHandler, waitFor, closeFrame } = helpers

// setTimeout and Date are mocked so retry delays, the login timeout and the reset window are
// driven by t.mock.timers.tick(). setImmediate stays real: helpers.flush() relies on it.
function mockTime(t) {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() })
}

function setup(t, { options = {}, overrides } = {}) {
    mockTime(t)
    const { app, values, logs } = createApp()
    const fetch = pushFetchHandler(overrides)
    setFetchHandler(fetch.handler)
    const sockets = installFakeTls(t)
    const receiver = new PushReceiver(app, {}, options)
    const events = { ready: 0, connect: 0, disconnect: 0, tokenChanges: [] }

    receiver.on('ON_READY', () => events.ready++)
    receiver.on('ON_CONNECT', () => events.connect++)
    receiver.on('ON_DISCONNECT', () => events.disconnect++)
    receiver.on('ON_TOKEN_CHANGE', (...args) => events.tokenChanges.push(args))

    t.after(() => receiver.destroy())

    return { app, values, logs, fetch, sockets, receiver, events }
}

async function nextSocket(sockets, count) {
    await waitFor(() => sockets.length >= count, `socket #${count}`)
    return sockets[count - 1]
}

test('PushReceiver lifecycle harness', async (t) => {
    await t.test('a login on the fake socket resolves connect() and emits ON_READY', async (t) => {
        const { receiver, sockets, events } = setup(t)

        const connected = receiver.connect()
        const socket = await nextSocket(sockets, 1)
        socket.login()
        await connected

        assert.equal(events.connect, 1)
        assert.equal(events.ready, 1)
        assert.equal(socket.options.host, 'mtalk.google.com')
        assert.ok(socket.writes.length > 0, 'the login request was written')
    })

    await t.test('a server Close long after login reconnects at once', async (t) => {
        const { receiver, sockets, events } = setup(t)

        const connected = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await connected

        t.mock.timers.tick(60_000)
        sockets[0].emit('data', closeFrame())

        assert.equal(sockets[0].destroyed, true)
        assert.equal(events.disconnect, 1)

        t.mock.timers.tick(0)
        ;(await nextSocket(sockets, 2)).login()
        await receiver.whenReady

        assert.equal(events.ready, 2)
    })
})

test('PushReceiver listener isolation', async (t) => {
    await t.test('an ON_READY listener that throws neither closes the connection nor stops the login', async (t) => {
        const { receiver, sockets, events, logs } = setup(t)
        receiver.on('ON_READY', () => {
            throw new Error('listener boom')
        })

        const connected = receiver.connect()
        const socket = await nextSocket(sockets, 1)
        socket.login()
        await connected

        assert.equal(socket.destroyed, false)
        assert.equal(socket.ended, false)
        assert.equal(events.disconnect, 0)
        assert.equal(logs.error.length, 1)
        assert.match(logs.error[0][0].message, /ON_READY listener threw/)
        assert.equal(logs.error[0][0].cause.message, 'listener boom')

        // The heartbeat and retry machinery still belongs to the live connection.
        t.mock.timers.tick(0)
        assert.equal(sockets.length, 1)
    })

    await t.test('an ON_TOKEN_CHANGE listener that throws does not fail the attempt', async (t) => {
        const { app, receiver, sockets } = setup(t)
        receiver.on('ON_TOKEN_CHANGE', () => {
            throw new Error('listener boom')
        })

        const first = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await first

        // A rotated GCM token changes the FCM subscription endpoint, so the next attempt
        // registers a new FCM token and announces it.
        receiver.destroy()
        const gcm = app.storage.get('gcm.registration')
        app.storage.set('gcm.registration', { ...gcm, token: 'gcm-token-rotated' })

        const second = receiver.connect()
        second.catch(() => {})
        const socket = await nextSocket(sockets, 2)
        socket.login()
        await second

        assert.equal(receiver.fcmToken, 'fcm-token-2')
    })
})

// Asserts that the next attempt opens its socket exactly `delay` ms after the current point.
async function expectNextAttemptAfter(t, sockets, delay) {
    const count = sockets.length

    if (delay > 0) {
        t.mock.timers.tick(delay - 1)
        await helpers.flush()
        await helpers.flush()
        assert.equal(sockets.length, count, `no attempt before ${delay} ms`)
        t.mock.timers.tick(1)
    } else {
        t.mock.timers.tick(0)
    }

    return nextSocket(sockets, count + 1)
}

function isSettled(promise) {
    let settled = false
    promise.then(() => { settled = true }, () => { settled = true })
    return helpers.flush().then(() => settled)
}

test('PushReceiver retry state machine', async (t) => {
    await t.test('a connection that drops within 10 s of login keeps growing the backoff', async (t) => {
        const { receiver, sockets } = setup(t)

        const connected = receiver.connect()
        let socket = await nextSocket(sockets, 1)
        socket.login()
        await connected

        // Chromium connection_factory_impl.cc: a reset within kConnectionResetWindowSecs of
        // login restores the backoff saved at login, so a server that accepts the login and
        // drops the connection right away is retried on a growing schedule, not in a hot loop.
        for (const delay of [0, 15_000, 30_000, 60_000]) {
            t.mock.timers.tick(1_000)
            socket.drop()
            socket = await expectNextAttemptAfter(t, sockets, delay)
            socket.login()
            await receiver.whenReady
        }
    })

    await t.test('a connection that drops after the reset window retries at once', async (t) => {
        const { receiver, sockets } = setup(t)

        receiver.connect().catch(() => {})
        // Two attempts that never log in grow the backoff first.
        ;(await nextSocket(sockets, 1)).drop()
        ;(await expectNextAttemptAfter(t, sockets, 0)).drop()
        const socket = await expectNextAttemptAfter(t, sockets, 15_000)
        socket.login()
        await receiver.whenReady

        t.mock.timers.tick(10_001)
        socket.drop()
        await expectNextAttemptAfter(t, sockets, 0)
    })

    await t.test('destroy() and connect() start with a fresh backoff', async (t) => {
        const { receiver, sockets } = setup(t)

        receiver.connect().catch(() => {})
        ;(await nextSocket(sockets, 1)).drop()
        ;(await expectNextAttemptAfter(t, sockets, 0)).drop()
        await expectNextAttemptAfter(t, sockets, 15_000)

        receiver.destroy()
        const connected = receiver.connect()
        const socket = await nextSocket(sockets, 4)
        socket.login()
        await connected

        t.mock.timers.tick(1_000)
        socket.drop()
        await expectNextAttemptAfter(t, sockets, 0)
    })

    await t.test('a LoginResponse carrying an error is a failed attempt, not a login', async (t) => {
        const { receiver, sockets, events, logs } = setup(t)

        const connected = receiver.connect()
        connected.catch(() => {})
        let socket = await nextSocket(sockets, 1)
        socket.login({ error: { code: 7, message: 'bad credentials' } })

        assert.equal(events.ready, 0)
        assert.equal(socket.destroyed, true)
        assert.equal(events.disconnect, 1)
        assert.equal(await isSettled(connected), false, 'connect() keeps waiting for a real login')
        assert.ok(logs.warn.some((args) => /login failed.*7.*bad credentials/i.test(String(args[0]?.message ?? args[0]))))

        // Not a login, so the backoff keeps growing (Chromium mcs_client.cc LOGIN_FAILURE).
        socket = await expectNextAttemptAfter(t, sockets, 0)
        socket.login({ error: { code: 7 } })
        socket = await expectNextAttemptAfter(t, sockets, 15_000)
        socket.login()
        await connected

        assert.equal(events.ready, 1)
    })

    await t.test('no LoginResponse within 30 s closes the socket and retries', async (t) => {
        const { receiver, sockets, events, logs } = setup(t)

        receiver.connect().catch(() => {})
        const socket = await nextSocket(sockets, 1)
        socket.emit('secureConnect')

        t.mock.timers.tick(29_999)
        assert.equal(socket.destroyed, false)

        t.mock.timers.tick(1)
        assert.equal(socket.destroyed, true)
        assert.equal(events.disconnect, 1)
        assert.ok(logs.warn.some((args) => /login timed out/i.test(String(args[0]?.message ?? args[0]))))

        await expectNextAttemptAfter(t, sockets, 0)
    })

    await t.test('a TCP/TLS connect that never completes is bounded by the same timeout', async (t) => {
        const { receiver, sockets } = setup(t)

        receiver.connect().catch(() => {})
        const socket = await nextSocket(sockets, 1)

        t.mock.timers.tick(30_000)
        assert.equal(socket.destroyed, true)
        await expectNextAttemptAfter(t, sockets, 0)
    })

    await t.test('a login clears the login timeout', async (t) => {
        const { receiver, sockets } = setup(t)

        const connected = receiver.connect()
        const socket = await nextSocket(sockets, 1)
        socket.login()
        await connected

        t.mock.timers.tick(60_000)
        assert.equal(socket.destroyed, false)
    })
})

test('PushReceiver retryInitialConnect', async (t) => {
    await t.test('off by default: a failed first registration rejects connect() with no retry', async (t) => {
        const { receiver, sockets, fetch } = setup(t, {
            overrides: { checkin: () => new Response('', { status: 403, statusText: 'Forbidden' }) },
        })

        await assert.rejects(receiver.connect(), /403 Forbidden/)
        t.mock.timers.tick(60_000)
        await helpers.flush()
        assert.equal(fetch.counts.checkin, 1)
        assert.equal(sockets.length, 0)
    })

    await t.test('on: a failed first registration goes on the retry schedule and connect() waits for the login', async (t) => {
        let failures = 2
        const { receiver, sockets, fetch, logs } = setup(t, {
            options: { retryInitialConnect: true },
            overrides: {
                checkin: () => failures-- > 0
                    ? new Response('', { status: 403, statusText: 'Forbidden' })
                    : helpers.checkinResponse(),
            },
        })

        const connected = receiver.connect()
        await waitFor(() => fetch.counts.checkin === 1, 'first checkin')
        assert.equal(await isSettled(connected), false)

        t.mock.timers.tick(0)
        await waitFor(() => fetch.counts.checkin === 2, 'second checkin')
        assert.equal(await isSettled(connected), false)

        const socket = await expectNextAttemptAfter(t, sockets, 15_000)
        socket.login()
        await connected

        assert.equal(logs.error.length, 2, 'each failed attempt is reported')
    })
})

test('PushReceiver reconnect()', async (t) => {
    await t.test('idle: starts like connect()', async (t) => {
        const { receiver, sockets } = setup(t)

        const connected = receiver.reconnect()
        ;(await nextSocket(sockets, 1)).login()
        await connected
    })

    await t.test('waiting on backoff: cuts the wait short and keeps the retry count', async (t) => {
        const { receiver, sockets } = setup(t)

        receiver.connect().catch(() => {})
        ;(await nextSocket(sockets, 1)).drop()
        ;(await expectNextAttemptAfter(t, sockets, 0)).drop()
        // The next attempt waits 15 s; reconnect() starts it now.
        const reconnected = receiver.reconnect()
        const socket = await nextSocket(sockets, 3)
        // That attempt fails too: the count went on from 2, so the next wait is 30 s.
        socket.drop()
        const last = await expectNextAttemptAfter(t, sockets, 30_000)
        last.login()
        await reconnected
    })

    await t.test('attempt before login: joins it, opens no second socket', async (t) => {
        const { receiver, sockets } = setup(t)

        const connected = receiver.connect()
        const socket = await nextSocket(sockets, 1)
        const reconnected = receiver.reconnect()
        await helpers.flush()
        assert.equal(sockets.length, 1)
        assert.equal(socket.destroyed, false)

        socket.login()
        await Promise.all([connected, reconnected])
    })

    await t.test('logged in: replaces the connection, ON_DISCONNECT then a new login', async (t) => {
        const { receiver, sockets, events } = setup(t)

        const connected = receiver.connect()
        const first = await nextSocket(sockets, 1)
        first.login()
        await connected

        const reconnected = receiver.reconnect()
        assert.equal(first.destroyed, true)
        assert.equal(events.disconnect, 1)
        assert.equal(await isSettled(reconnected), false)

        ;(await nextSocket(sockets, 2)).login()
        await reconnected
        assert.equal(events.ready, 2)
    })

    await t.test('a reconnect() during an in-flight registration runs no second registration', async (t) => {
        const { receiver, sockets, fetch } = setup(t)

        receiver.connect()
        receiver.reconnect()
        receiver.reconnect()
        ;(await nextSocket(sockets, 1)).login()
        await receiver.whenReady

        assert.equal(fetch.counts.checkin, 1)
        assert.equal(fetch.counts.register, 1)
        assert.equal(sockets.length, 1)
    })
})

test('PushReceiver log levels', async (t) => {
    await t.test('a transient registration failure on the retry schedule is a warning', async (t) => {
        // utils/request.ts sends a checkin 4 times (3 retries) before giving up on a 503.
        const { receiver, sockets, logs } = setup(t, {
            options: { retryInitialConnect: true },
            overrides: {
                checkin: (count) => count <= 4
                    ? new Response('', { status: 503, statusText: 'Service Unavailable' })
                    : helpers.checkinResponse(),
            },
        })

        receiver.connect().catch(() => {})
        // Drive request.ts's retry delays and the receiver's retry until the next attempt
        // opens its socket.
        while (sockets.length === 0) {
            await helpers.flush()
            t.mock.timers.tick(5_000)
        }

        assert.equal(logs.warn.length, 1)
        assert.match(logs.warn[0][0].message, /503/)
        assert.equal(logs.error.length, 0)

        sockets[0].login()
        await receiver.whenReady
    })

    await t.test('a socket error is a warning when transient, an error otherwise', async (t) => {
        const { receiver, sockets, logs } = setup(t)

        receiver.connect().catch(() => {})
        const socket = await nextSocket(sockets, 1)
        socket.emit('error', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))
        socket.emit('error', Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' }))

        assert.equal(logs.warn.length, 1)
        assert.equal(logs.error.length, 1)
        assert.equal(logs.error[0][0].code, 'CERT_HAS_EXPIRED')
    })

    await t.test('the retry limit is an error', async (t) => {
        const { receiver, sockets, logs } = setup(t, { options: { maxRetryAttempts: 1 } })

        const connected = receiver.connect()
        connected.catch(() => {})
        ;(await nextSocket(sockets, 1)).drop()
        ;(await expectNextAttemptAfter(t, sockets, 0)).drop()

        await assert.rejects(connected, /retry limit reached/)
        assert.ok(logs.error.some((args) => /retry limit reached/.test(args[0].message)))
    })
})

test('PushReceiver token announcements', async (t) => {
    await t.test('a fresh install announces nothing and records the token', async (t) => {
        const { app, receiver, sockets, events } = setup(t)

        const connected = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await connected

        assert.deepEqual(events.tokenChanges, [])
        assert.equal(app.storage.get('push_receiver.announced_token'), 'fcm-token-1')
    })

    await t.test('a token that changed while the app was not running is announced on the next start', async (t) => {
        const { app, values, receiver, sockets } = setup(t)

        const connected = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await connected
        receiver.destroy()

        // The stored GCM token rotated, so the next start registers a new FCM token.
        const gcm = app.storage.get('gcm.registration')
        app.storage.set('gcm.registration', { ...gcm, token: 'gcm-token-rotated' })

        // A new receiver over the same storage stands in for a restarted process.
        const { app: restartedApp } = createApp({ values })
        const restarted = new PushReceiver(restartedApp, {})
        const changes = []
        restarted.on('ON_TOKEN_CHANGE', (...args) => changes.push(args))
        t.after(() => restarted.destroy())

        const reconnected = restarted.connect()
        ;(await nextSocket(sockets, 2)).login()
        await reconnected

        assert.deepEqual(changes, [['fcm-token-2', 'fcm-token-1']])
        assert.equal(restartedApp.storage.get('push_receiver.announced_token'), 'fcm-token-2')
    })

    await t.test('an in-process rotation passes the old token too', async (t) => {
        const { app, receiver, sockets, events } = setup(t)

        const first = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await first
        receiver.destroy()

        const gcm = app.storage.get('gcm.registration')
        app.storage.set('gcm.registration', { ...gcm, token: 'gcm-token-rotated' })

        const second = receiver.connect()
        ;(await nextSocket(sockets, 2)).login()
        await second

        assert.deepEqual(events.tokenChanges, [['fcm-token-2', 'fcm-token-1']])
    })

    await t.test('a listener that destroys the receiver gets the announcement again on the next start', async (t) => {
        const { app, values, receiver, sockets } = setup(t)

        const first = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await first
        receiver.destroy()

        const gcm = app.storage.get('gcm.registration')
        app.storage.set('gcm.registration', { ...gcm, token: 'gcm-token-rotated' })
        receiver.on('ON_TOKEN_CHANGE', () => receiver.destroy())
        await assert.rejects(receiver.connect(), /Client destroyed/)
        assert.equal(app.storage.get('push_receiver.announced_token'), 'fcm-token-1')

        const { app: restartedApp } = createApp({ values })
        const restarted = new PushReceiver(restartedApp, {})
        const changes = []
        restarted.on('ON_TOKEN_CHANGE', (...args) => changes.push(args))
        t.after(() => restarted.destroy())

        const reconnected = restarted.connect()
        ;(await nextSocket(sockets, 2)).login()
        await reconnected

        assert.deepEqual(changes, [['fcm-token-2', 'fcm-token-1']])
    })
})

test('PushReceiver gaps (tester round 3)', async (t) => {
    await t.test('logins dropped within the reset window count toward a finite maxRetryAttempts', async (t) => {
        const { receiver, sockets, logs } = setup(t, { options: { maxRetryAttempts: 2 } })

        const connected = receiver.connect()
        let socket = await nextSocket(sockets, 1)
        socket.login()
        await connected

        // Restored counts: 0 -> retry 1 (0 s), 1 -> retry 2 (15 s), 2 -> limit.
        for (const delay of [0, 15_000]) {
            t.mock.timers.tick(1_000)
            socket.drop()
            socket = await expectNextAttemptAfter(t, sockets, delay)
            socket.login()
            await receiver.whenReady
        }

        t.mock.timers.tick(1_000)
        socket.drop()

        assert.ok(logs.error.some((args) => /retry limit reached/.test(args[0].message)))
        t.mock.timers.tick(10 * 60 * 1000)
        await helpers.flush()
        assert.equal(sockets.length, 3, 'no attempt after the limit')
    })

    await t.test('failed logins count toward a finite maxRetryAttempts and reject connect()', async (t) => {
        const { receiver, sockets } = setup(t, { options: { maxRetryAttempts: 1 } })

        const connected = receiver.connect()
        connected.catch(() => {})
        ;(await nextSocket(sockets, 1)).login({ error: { code: 7 } })
        ;(await expectNextAttemptAfter(t, sockets, 0)).login({ error: { code: 7 } })

        await assert.rejects(connected, /retry limit reached/)
    })

    await t.test('destroy() clears the login timeout', async (t) => {
        const { receiver, sockets, events, logs } = setup(t)

        receiver.connect().catch(() => {})
        await nextSocket(sockets, 1)
        receiver.destroy()

        t.mock.timers.tick(60_000)
        await helpers.flush()

        assert.equal(sockets.length, 1)
        assert.equal(events.disconnect, 0)
        assert.equal(logs.warn.length, 0)
        assert.equal(logs.error.length, 0)
    })

    await t.test('an unknown MCS tag is a warning and keeps the connection', async (t) => {
        const { receiver, sockets, logs } = setup(t)
        const Protos = require('../dist/protobuf').default
        const { MCSProtoTag } = require('../dist/utils/constants')

        const connected = receiver.connect()
        const socket = await nextSocket(sockets, 1)
        socket.login()
        await connected

        // StreamErrorStanza parses, but the receiver has no handler for it.
        const bytes = Protos.mcs_proto.StreamErrorStanza.encode({ type: 'unexpected' }).finish()
        socket.emit('data', Buffer.from([MCSProtoTag.kStreamErrorStanzaTag, ...helpers.encodeVarint(bytes.length), ...bytes]))

        assert.ok(logs.warn.some((args) => /Unknown message/.test(args[0].message)))
        assert.equal(logs.error.length, 0)
        assert.equal(socket.destroyed, false)
    })

    await t.test('reconnect() after destroy() starts a new attempt like connect()', async (t) => {
        const { receiver, sockets } = setup(t)

        const connected = receiver.connect()
        ;(await nextSocket(sockets, 1)).login()
        await connected
        receiver.destroy()

        const reconnected = receiver.reconnect()
        ;(await nextSocket(sockets, 2)).login()
        await reconnected
    })
})
