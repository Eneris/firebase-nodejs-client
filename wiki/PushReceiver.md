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
Available through the `eventemitter3` API (`on`/`off`).
- `ON_MESSAGE_RECEIVED` - emitted with `{ message, persistentId }` for every decrypted notification
- `ON_CONNECT` - emitted when the socket is established
- `ON_DISCONNECT` - emitted when the connection is lost or closed
- `ON_READY` - emitted after a successful login
- `ON_HEARTBEAT` - emitted on every heartbeat ack
- `ON_TOKEN_CHANGE` - emitted with the new token after `connect` when the FCM token changed
  since the previous `connect` (for example, FIS replaced the installation); read the new token
  from `fcmToken`

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
