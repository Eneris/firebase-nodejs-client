// Bounded waits: the fetch retry loop's abort path, the Firebase Installations request timeout,
// RemoteConfig's fetchTimeout covering the installation wait, and RemoteConfig's background
// retry after a failed scheduled fetch.
const helpers = require('./helpers')
const assert = require('node:assert/strict')
const test = require('node:test')

const { RemoteConfig } = require('../dist')
const fetchWithRetry = require('../dist/utils/fetch').default

const { createApp, setFetchHandler, flush, within, jsonResponse } = helpers

const installation = {
    fid: 'c123456789012345678901',
    refreshToken: 'refresh-token',
    authToken: 'auth-token',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
}

// A handler that fails like an offline machine until the test is over, then lets any retry
// loop still running finish, so a red run cannot keep the process alive.
function offlineUntilDone(t, counter = { calls: 0 }) {
    let done = false
    t.after(() => { done = true })

    return {
        counter,
        handler: async () => {
            counter.calls++
            if (done) return new Response('{}', { status: 400, statusText: 'Bad Request' })
            throw new TypeError('fetch failed')
        },
    }
}

test('fetchWithRetry abort path', async (t) => {
    await t.test('an abort during the backoff delay rejects at once and sends nothing more', async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] })
        const { handler, counter } = offlineUntilDone(t)
        setFetchHandler(handler)
        const controller = new AbortController()

        const pending = fetchWithRetry('https://example.test', { signal: controller.signal })
        pending.catch(() => {})
        await flush()
        assert.equal(counter.calls, 1)

        controller.abort()

        await assert.rejects(within(pending, 500, 'aborted fetch'), (error) => error.name === 'AbortError')
        t.mock.timers.tick(10 * 60 * 1000)
        await flush()
        assert.equal(counter.calls, 1)
    })

    await t.test('an already aborted signal sends nothing', async (t) => {
        const { handler, counter } = offlineUntilDone(t)
        setFetchHandler(handler)

        await assert.rejects(fetchWithRetry('https://example.test', { signal: AbortSignal.abort() }), (error) => error.name === 'AbortError')
        assert.equal(counter.calls, 0)
    })
})

test('Firebase Installations request timeout', async (t) => {
    await t.test('defaults to 60 s, 0 turns it off', () => {
        assert.equal(createApp().app.requestTimeoutMs, 60_000)
        assert.equal(createApp({ options: { requestTimeoutMs: 0 } }).app.requestTimeoutMs, 0)
    })

    await t.test('an installation request that keeps failing rejects once requestTimeoutMs passes', async (t) => {
        const { app } = createApp({ options: { requestTimeoutMs: 50 } })
        setFetchHandler(offlineUntilDone(t).handler)

        await assert.rejects(
            within(app.installations.getInstallation(), 3_000, 'getInstallation'),
            (error) => error.name === 'TimeoutError',
        )
        assert.equal(app.storage.get('installations.installation'), undefined)
    })

    await t.test('a refresh timing out keeps the stored installation and serves it while usable', async (t) => {
        const { app } = createApp({ options: { requestTimeoutMs: 50 } })
        const stored = { ...installation, expiresAt: Date.now() + 30 * 60 * 1000 }
        app.storage.set('installations.installation', stored)
        setFetchHandler(offlineUntilDone(t).handler)

        const result = await within(app.installations.getInstallation(), 3_000, 'getInstallation')

        assert.deepEqual(result, stored)
        assert.deepEqual(app.storage.get('installations.installation'), stored)
    })
})

test('RemoteConfig fetchTimeout covers the installation wait', async (t) => {
    await t.test('a hanging installation request fails the fetch at fetchTimeout', async () => {
        const { app } = createApp()
        let release
        app.installations.getInstallation = () => new Promise((resolve) => { release = resolve })
        setFetchHandler(async () => assert.fail('no RC request without an installation'))

        const remoteConfig = new RemoteConfig(app, { fetchTimeout: 50, cacheMaxAge: 0 })

        try {
            await assert.rejects(
                within(remoteConfig.fetchAndActivate(true), 3_000, 'fetchAndActivate'),
                (error) => error.name === 'TimeoutError',
            )
        } finally {
            remoteConfig.destroy()
            release?.(installation)
        }
    })

    await t.test('destroy() aborts a fetch waiting for its installation', async () => {
        const { app } = createApp()
        app.installations.getInstallation = () => new Promise(() => {})

        const remoteConfig = new RemoteConfig(app, { cacheMaxAge: 0 })
        const pending = remoteConfig.fetchAndActivate(true)
        await flush()
        remoteConfig.destroy()

        await assert.rejects(within(pending, 3_000, 'fetchAndActivate'), (error) => error.name === 'AbortError')
    })
})

test('RemoteConfig background retry', async (t) => {
    function rcResponse() {
        return jsonResponse({ state: 'UPDATE', entries: { key: 'value' } })
    }

    await t.test('a failed scheduled fetch is retried on a doubling delay until it succeeds', async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
        const { app, logs } = createApp()
        app.storage.set('installations.installation', installation)
        let requests = 0
        let failing = true
        setFetchHandler(async () => {
            requests++
            return failing ? new Response('{}', { status: 400, statusText: 'Bad Request' }) : rcResponse()
        })

        const remoteConfig = new RemoteConfig(app)
        t.after(() => remoteConfig.destroy())

        await helpers.waitFor(() => requests === 1, 'constructor fetch')
        await flush()
        assert.equal(logs.error.length, 1, 'a permanent failure is reported at error')

        t.mock.timers.tick(59_999)
        await flush()
        assert.equal(requests, 1)
        t.mock.timers.tick(1)
        await helpers.waitFor(() => requests === 2, 'first retry')
        await flush()

        t.mock.timers.tick(119_999)
        await flush()
        assert.equal(requests, 2)
        failing = false
        t.mock.timers.tick(1)
        await helpers.waitFor(() => requests === 3, 'second retry')
        await helpers.waitFor(() => app.storage.get('remote_config.config') !== undefined, 'config stored')

        // Success: no further retry, only the regular cacheMaxAge interval.
        t.mock.timers.tick(60 * 60 * 1000)
        await flush()
        assert.equal(requests, 3)
    })

    await t.test('destroy() cancels a pending background retry', async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
        const { app } = createApp()
        app.storage.set('installations.installation', installation)
        let requests = 0
        setFetchHandler(async () => {
            requests++
            return new Response('{}', { status: 400, statusText: 'Bad Request' })
        })

        const remoteConfig = new RemoteConfig(app)
        await helpers.waitFor(() => requests === 1, 'constructor fetch')
        await flush()
        remoteConfig.destroy()

        t.mock.timers.tick(24 * 60 * 60 * 1000)
        await flush()
        assert.equal(requests, 1)
    })

    await t.test('a failed fetchAndActivate() the caller started is not retried in the background', async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
        const { app } = createApp()
        app.storage.set('installations.installation', installation)
        app.storage.set('remote_config.config', { existing: 'value' })
        app.storage.set('remote_config.lastFetchTimestamp', Date.now())
        let requests = 0
        setFetchHandler(async () => {
            requests++
            return new Response('{}', { status: 400, statusText: 'Bad Request' })
        })

        const remoteConfig = new RemoteConfig(app)
        t.after(() => remoteConfig.destroy())

        await assert.rejects(remoteConfig.fetchAndActivate(true), /status: 400/)
        t.mock.timers.tick(10 * 60 * 1000)
        await flush()
        assert.equal(requests, 1)
    })
})

test('timeouts gaps (tester round 3)', async (t) => {
    await t.test('deleteInstallation is bounded by requestTimeoutMs and keeps the stored entry', async (t) => {
        const { app } = createApp({ options: { requestTimeoutMs: 50 } })
        app.storage.set('installations.installation', installation)
        setFetchHandler(offlineUntilDone(t).handler)

        await assert.rejects(
            within(app.installations.deleteInstallation(), 3_000, 'deleteInstallation'),
            (error) => error.name === 'TimeoutError',
        )
        assert.deepEqual(app.storage.get('installations.installation'), installation)
    })

    function failingRemoteConfig(t, options) {
        t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() })
        const { app } = createApp()
        app.storage.set('installations.installation', installation)
        const state = { requests: 0, failing: true }
        setFetchHandler(async () => {
            state.requests++
            return state.failing
                ? new Response('{}', { status: 400, statusText: 'Bad Request' })
                : jsonResponse({ state: 'UPDATE', entries: { key: 'value' } })
        })

        const remoteConfig = new RemoteConfig(app, options)
        t.after(() => remoteConfig.destroy())

        return state
    }

    async function expectRequestAfter(t, state, delay) {
        const count = state.requests
        t.mock.timers.tick(delay - 1)
        await flush()
        await flush()
        assert.equal(state.requests, count, `no request before ${delay} ms`)
        t.mock.timers.tick(1)
        await helpers.waitFor(() => state.requests === count + 1, `request after ${delay} ms`)
        await flush()
        await flush()
    }

    await t.test('the retry delay is capped at cacheMaxAge', async (t) => {
        // Interval at cacheMaxAge + 1 s = 151 s; it clears a pending retry and fetches itself.
        const state = failingRemoteConfig(t, { cacheMaxAge: 150_000 })
        await helpers.waitFor(() => state.requests === 1, 'constructor fetch')
        await flush()

        await expectRequestAfter(t, state, 60_000)          // retry 1 at 60 s
        await expectRequestAfter(t, state, 91_000)          // interval at 151 s, before retry 2 (180 s)
        await expectRequestAfter(t, state, 150_000)         // retry 3: min(240 s, 150 s), at 301 s
    })

    await t.test('with cacheMaxAge 0 the retry delay is capped at 12 h', async (t) => {
        const state = failingRemoteConfig(t, { cacheMaxAge: 0 })
        await helpers.waitFor(() => state.requests === 1, 'constructor fetch')
        await flush()

        for (let n = 0; n < 10; n++) {
            await expectRequestAfter(t, state, 60_000 * 2 ** n)
        }

        // 60 s * 2^10 is 17 h: capped.
        await expectRequestAfter(t, state, 12 * 60 * 60 * 1000)
    })

    await t.test('a success resets the delay for the next failure', async (t) => {
        const state = failingRemoteConfig(t, {})
        await helpers.waitFor(() => state.requests === 1, 'constructor fetch')
        await flush()

        await expectRequestAfter(t, state, 60_000)
        state.failing = false
        await expectRequestAfter(t, state, 120_000)        // succeeds at 180 s

        state.failing = true
        // The interval ticks every 12 h + 1 s from construction. The first tick finds the cache
        // from 180 s still fresh and sends nothing; the second one fetches, and fails.
        const interval = 12 * 60 * 60 * 1000 + 1_000
        t.mock.timers.tick(interval - 180_000)
        await flush()
        await flush()
        assert.equal(state.requests, 3, 'the first interval tick finds a fresh cache')
        await expectRequestAfter(t, state, interval)
        await expectRequestAfter(t, state, 60_000)          // back to 60 s, not 240 s
    })
})
