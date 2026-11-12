// Shared harness for the test files that drive PushReceiver over a fake TLS socket. Not a test
// file itself (`yarn test` only runs `test/*.test.js`).
//
// `src/utils/fetch.ts` hands the global `fetch` to fetch-retry once, at module load, so the
// override below has to be installed before anything requires `../dist`. Requiring this file
// first does that; tests then swap behaviour with setFetchHandler().
const { EventEmitter } = require('node:events')
const { webcrypto } = require('node:crypto')
const tls = require('node:tls')

// Captured before any test enables mock timers, so within() keeps measuring real time.
const realSetTimeout = setTimeout
const realClearTimeout = clearTimeout

let fetchHandler = async (url) => {
    throw new Error(`no fetch handler installed for ${url}`)
}

global.fetch = (...args) => fetchHandler(...args)

const { FirebaseApp } = require('../dist')
const Protos = require('../dist/protobuf').default
const { MCSProtoTag, Variables } = require('../dist/utils/constants')

const CHECKIN_URL = 'https://android.clients.google.com/checkin'
const REGISTER_URL = 'https://android.clients.google.com/c2dm/register3'

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

function setFetchHandler(handler) {
    fetchHandler = handler
}

// A FirebaseApp over an in-memory Map, with a logger that records every call per level so
// tests can assert which level a failure was reported at.
function createApp(appOptions = {}) {
    const values = appOptions.values ?? new Map()
    const logs = { log: [], debug: [], warn: [], error: [] }
    const app = new FirebaseApp({
        credentials,
        crypto: webcrypto,
        logger: {
            log: (...args) => logs.log.push(args),
            debug: (...args) => logs.debug.push(args),
            warn: (...args) => logs.warn.push(args),
            error: (...args) => logs.error.push(args),
        },
        storage: {
            get: (key) => values.get(key),
            set: (key, value) => values.set(key, value),
        },
        ...appOptions.options,
    })

    return { app, values, logs }
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

// The first frame on a connection carries the MCS version byte, every later one does not
// (lib/parser.ts MCS_VERSION_TAG_AND_SIZE vs MCS_TAG_AND_SIZE).
function frame(tag, bytes, { first = false } = {}) {
    return Buffer.from([
        ...(first ? [Variables.kMCSVersion] : []),
        tag,
        ...encodeVarint(bytes.length),
        ...bytes,
    ])
}

function loginResponseFrame({ error } = {}) {
    const LoginResponse = Protos.mcs_proto.LoginResponse
    const bytes = LoginResponse.encode(LoginResponse.create({ id: 'login', ...(error ? { error } : {}) })).finish()

    return frame(MCSProtoTag.kLoginResponseTag, bytes, { first: true })
}

function closeFrame() {
    return frame(MCSProtoTag.kCloseTag, [])
}

// Stands in for tls.TLSSocket: PushReceiver and Parser only use the EventEmitter API plus the
// methods below. `ended`/`destroyed` let a test assert the receiver tore the socket down.
class FakeSocket extends EventEmitter {
    constructor(options) {
        super()
        this.options = options
        this.writes = []
        this.ended = false
        this.destroyed = false
    }

    setKeepAlive() {}

    write(buffer) {
        this.writes.push(buffer)
        return true
    }

    end() {
        this.ended = true
    }

    destroy() {
        this.destroyed = true
    }

    // What the receiver sees once TLS is up and the server answered the login.
    login(options) {
        this.emit('secureConnect')
        this.emit('data', loginResponseFrame(options))
    }

    // A socket the OS/peer closed: Node emits `close` on its own.
    drop() {
        this.emit('close')
    }
}

// Replaces tls.connect for the duration of the test; every socket the receiver opens is
// recorded in order.
function installFakeTls(t) {
    const original = tls.connect
    const sockets = []

    tls.connect = (options) => {
        const socket = new FakeSocket(options)
        sockets.push(socket)
        return socket
    }

    t.after(() => {
        tls.connect = original
    })

    return sockets
}

function checkinResponse({ androidId = 1, securityToken = 2 } = {}) {
    const AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse
    const body = AndroidCheckinResponse.encode(AndroidCheckinResponse.create({
        statsOk: true,
        androidId,
        securityToken,
    })).finish()

    return new Response(body, { status: 200 })
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// Answers every request a PushReceiver registration makes. `counts` lets a test assert how
// many of each went out; `overrides[name]` replaces one endpoint's answer.
function pushFetchHandler(overrides = {}) {
    const counts = { checkin: 0, register: 0, fisCreate: 0, fcmCreate: 0, fcmUpdate: 0, fcmDelete: 0 }

    const handler = async (url, options = {}) => {
        const href = String(url)

        if (href === CHECKIN_URL) {
            counts.checkin++
            return overrides.checkin ? overrides.checkin(counts.checkin, options) : checkinResponse()
        }

        if (href === REGISTER_URL) {
            counts.register++
            return overrides.register
                ? overrides.register(counts.register, options)
                : new Response(`token=gcm-token-${counts.register}`, { status: 200 })
        }

        if (href.includes('firebaseinstallations.googleapis.com') && href.endsWith('/installations')) {
            counts.fisCreate++
            return overrides.fisCreate ? overrides.fisCreate(counts.fisCreate, options) : jsonResponse({
                fid: 'cAAAAAAAAAAAAAAAAAAAAA',
                refreshToken: 'refresh-token',
                authToken: { token: 'auth-token', expiresIn: '604800s' },
            })
        }

        if (href.includes('fcmregistrations.googleapis.com')) {
            if (options.method === 'DELETE') {
                counts.fcmDelete++
                return overrides.fcmDelete ? overrides.fcmDelete(counts.fcmDelete, options) : new Response(null, { status: 200 })
            }

            if (options.method === 'PATCH') {
                counts.fcmUpdate++
                return overrides.fcmUpdate
                    ? overrides.fcmUpdate(counts.fcmUpdate, options)
                    : jsonResponse({ name: 'reg', token: `fcm-token-updated-${counts.fcmUpdate}`, web: {} })
            }

            counts.fcmCreate++
            return overrides.fcmCreate
                ? overrides.fcmCreate(counts.fcmCreate, options)
                : jsonResponse({ name: 'reg', token: `fcm-token-${counts.fcmCreate}`, web: {} })
        }

        throw new Error(`unexpected request: ${options.method ?? 'GET'} ${href}`)
    }

    return { handler, counts }
}

// Lets pending promise chains (fetch bodies, awaits) run. Uses setImmediate, which the tests
// never mock, so it keeps working while setTimeout/Date are mocked.
function flush() {
    return new Promise((resolve) => setImmediate(resolve))
}

async function waitFor(predicate, label = 'condition') {
    for (let i = 0; i < 500; i++) {
        if (predicate()) return
        await flush()
    }

    throw new Error(`timed out waiting for ${label}`)
}

// Settles with the promise's outcome, or rejects once `ms` of real time pass. For tests whose
// red state is "hangs forever".
function within(promise, ms, label = 'promise') {
    let timer
    const deadline = new Promise((resolve, reject) => {
        timer = realSetTimeout(() => reject(new Error(`${label} did not settle within ${ms} ms`)), ms)
    })

    return Promise.race([promise, deadline]).finally(() => realClearTimeout(timer))
}

module.exports = {
    CHECKIN_URL,
    REGISTER_URL,
    credentials,
    setFetchHandler,
    createApp,
    encodeVarint,
    loginResponseFrame,
    closeFrame,
    FakeSocket,
    installFakeTls,
    checkinResponse,
    jsonResponse,
    pushFetchHandler,
    flush,
    waitFor,
    within,
}
