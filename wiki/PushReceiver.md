# class `PushReceiver`

Registers the app with GCM/FCM, keeps a persistent TLS connection to `mtalk.google.com` open, decrypts incoming messages and deduplicates them using persistent ids stored in your storage. Registration data is persisted, so a restarted process reuses the same FCM token.

## Config
```js
const client = new PushReceiver(app, {
    // config (required object), every field defaults to the matching DEFAULT_* below
    bundleId: 'receiver.push.com',
    chromeId: 'org.chromium.linux',
    chromePlatform: 3,  // 1 = Windows, 2 = Darwin, 3 = Linux, 4 = Cros, 5 = iOS
    chromeChannel: 1,   // 1 = stable, 2 = beta, 3 = dev, 4 = canary, 5 = unknown
    chromeVersion: '148.0.7778.271',
    timeZone: 'Europe/Prague',
    vapidKey: 'BDOU9...',  // DEFAULT_VAPID_KEY in src/utils/constants.ts is firebase-js-sdk's public vapid key
}, {
    // options (optional)
    heartbeatIntervalMs: 5 * 60 * 1000, // optional, defaults to 5 minutes
    maxRetryAttempts: 5,                // optional, non-positive value disables the limit
    retryInitialConnect: false,         // optional, see `connect`
})
```

The constructor takes `(app, config, options)`. The `config` object is required, but pass `{}` to use all defaults. Every `config` field is optional and defaults to the matching `DEFAULT_*` constant in `src/utils/constants.ts`; the defaults are applied once, in the constructor, before it asserts the resolved config. The constructor throws if a field resolves empty (for example passed as `undefined` or `''`), or if `credentials.appId`, `credentials.apiKey` or `credentials.projectId` is missing. The one exception is `vapidKey`: an explicit `undefined` falls back to `DEFAULT_VAPID_KEY` instead of throwing; every other field still throws on an explicit `undefined`.

## Methods
### `connect`
- Registers with GCM/FCM if no valid registration is stored
- Opens the connection and resolves once the client is logged in
- Idempotent: when already connected, when a connection attempt (including a reconnect) is
  under way, or when a reconnect is waiting out its backoff, it returns `whenReady` and joins
  that, settling with its outcome. It never restarts an attempt or shortens the backoff, so it
  is safe to call from any listener. To reconnect right away, call `destroy()` first
- Its returned promise can still reject (a fresh attempt's registration failure or synchronous `tls.connect()` error, or the
  retry limit): a listener that calls `connect()` without awaiting or catching that promise
  (for example `on('ON_DISCONNECT', () => connect())`) risks an unhandled rejection, which
  crashes Node. Attach a `.catch()` (or `void connect().catch(...)`) even when only reconnecting
  in the background
- A cached, valid FCM registration needs no FIS call, so a FIS outage does not block connecting
- With `retryInitialConnect: true`, the first attempt of a `connect()` on an idle receiver is
  on the retry schedule like every later one: a registration failure (for example offline at
  startup) is logged and retried with backoff, and the call stays pending until a login,
  `destroy()` or the retry limit. The rest of this point describes the default, `false`
- If registration fails, or `tls.connect()` itself throws synchronously (a bad option value —
  rare in practice), on a `connect()` of an idle receiver (never connected, or after
  `destroy()`), the call rejects with that error and the receiver stays idle: no retry. A
  refused or blocked connection does *not* throw: `tls.connect()` still returns a socket, and
  the failure arrives asynchronously as a `close` event like any other lost connection (see the
  next point), so it goes on the retry schedule instead of rejecting `connect()` outright
- If the socket closes before login completes, the call doesn't reject on the spot: it waits
  through the reconnect/backoff retries, resolving once a later attempt logs in, or rejecting
  with `"PushReceiver retry limit reached"` once `maxRetryAttempts` is exhausted. A `connect()`
  on an idle receiver starts with the full `maxRetryAttempts` budget again
- A later drop, after a successful `connect`, that stays offline past `maxRetryAttempts` destroys
  the receiver the same way (`"PushReceiver retry limit reached"`) but fires no event for it, so
  the app must call `connect()` again to get a working connection
- The backoff between retries grows exponentially (0, 15, 30, 60, 120, 240 s, ...) but is capped
  at 10 minutes per attempt, the same cap as Chromium's MCS connection backoff, so `maxRetryAttempts:
  0` (retry forever) never leaves the receiver waiting hours between attempts
- A login resets the backoff only once the connection has lasted 10 seconds. A connection that
  drops sooner continues the backoff where it was before that login (Chromium's
  `kConnectionResetWindowSecs`), so a server that accepts the login and drops the connection
  right away is retried on a growing schedule instead of in a hot loop. Such drops count
  towards `maxRetryAttempts`
- A `LoginResponse` carrying an error is a failed attempt, not a login: logged as a warning,
  the socket is closed (`ON_DISCONNECT`), no `ON_READY`, `whenReady` stays pending and the
  backoff keeps growing
- An attempt that has not logged in 30 seconds after the socket was opened (TCP, TLS and the
  login answer together) is closed and retried like a lost connection (`ON_DISCONNECT`)

### `reconnect`
- Starts a fresh attempt now. Call it when the app knows the network just came back or the
  machine woke from sleep: a connection that looks alive may be dead (the heartbeat would only
  notice minutes later), and a retry may be waiting out a long backoff
- Idle receiver: same as `connect()`
- Waiting out a backoff: the wait is cut short and the next attempt starts now
- Logged in: the connection is closed (`ON_DISCONNECT`) and a new attempt starts
- An attempt still before its login (registering, connecting or waiting for the login answer)
  is left alone and joined; the 30 second login timeout bounds how long that can take
- The retry count is kept: a `reconnect()` attempt that fails continues the backoff, and
  counts towards `maxRetryAttempts`
- Returns `whenReady`. Like `connect()` it can reject (retry limit, `destroy()`), so attach a
  `.catch()`: `powerMonitor.on('resume', () => void client.reconnect().catch(log))`

### `destroy`
- Closes the socket, clears heartbeat and retry timers
- Rejects pending `whenReady` waiters and pending `connect()` calls with the given reason
- Safe at any point, including from inside an event listener: nothing the receiver was about
  to do (reconnect, heartbeat, a write) happens afterwards, and no further event fires
- Safe to follow with `connect()` right away to restart the receiver: the new attempt waits for
  a registration the destroyed one still had in flight to settle and reuses what it stored, and
  is otherwise unaffected by it

### `onNotification`
- Subscribes to received messages, returns a dispose function

### `onReady`
- Subscribes to the ready event, returns a dispose function

## Properties
- `fcmToken` - current FCM registration token, available after `connect`; it only changes
  together with an `ON_TOKEN_CHANGE` event
- `whenReady` - promise resolved when the client is connected and logged in; pending again
  while a lost connection is being reconnected. A `destroy()` that lands before login completes
  rejects it; one that lands afterward leaves it resolved, since that login is over — it stays
  resolved until the next `connect()` starts a new attempt

## Events
Available through the `eventemitter3` API (`on`/`off`). A listener that throws is logged at
`error` through the app logger and cannot affect the receiver: the connection stays up and the
attempt goes on. As with Node's `EventEmitter`, a throwing listener still stops the listeners
registered after it for that one event. A listener's returned promise is not awaited, so an
async listener must handle its own rejections.
- `ON_MESSAGE_RECEIVED` - emitted with `{ message, persistentId }` for every decrypted notification
- `ON_CONNECT` - emitted when the socket is established
- `ON_DISCONNECT` - emitted when the connection is lost or closed
- `ON_READY` - emitted after a successful login
- `ON_HEARTBEAT` - emitted on every heartbeat ack
- `ON_TOKEN_CHANGE` - emitted as `(newToken, oldToken)` before the login of an attempt whose
  FCM token differs from the one last announced, also across restarts: the last announced
  token is persisted (`push_receiver.announced_token`). Causes: FIS replaced the installation,
  checkin rejected the GCM credentials, an FCM registration that no longer existed. The first
  start of a fresh install, or the first one after upgrading from 1.0.x (nothing persisted
  yet), announces nothing. Delivered at least once: if a listener destroys the receiver, the
  token is not recorded as announced and the next process start announces it again (a
  `connect()` in the same process does not: the receiver already holds that token)

## Logging
Failures the retry schedule recovers from on its own (offline, a timeout, a 429 or 5xx, a reset
socket) are logged at `warn`; failures that will keep happening (a rejected request, a TLS
certificate error), protocol violations, listener throws and the retry limit at `error`.

## Example
```js
const crypto = require('crypto')
const { FirebaseApp, PushReceiver } = require('@eneris/firebase-nodejs-client')

const app = new FirebaseApp({
    credentials: { /* CREDENTIALS HERE */ },
    storage,
    crypto,
})

const client = new PushReceiver(app, {})

const stopListening = client.onNotification(({ message, persistentId }) => {
    console.log('Notification received', persistentId, message)
})

await client.connect()

console.log('FCM token:', client.fcmToken)
```

See also [`PushReceiverLegacy`](PushReceiverLegacy.md) and [`example/push.js`](../example/push.js).
