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
- Returns `whenReady` when already connected
- A cached, valid FCM registration needs no FIS call, so a FIS outage does not block connecting

### `destroy`
- Closes the socket, clears heartbeat and retry timers
- Rejects pending `whenReady` waiters with the given reason

### `onNotification`
- Subscribes to received messages, returns a dispose function

### `onReady`
- Subscribes to the ready event, returns a dispose function

## Properties
- `fcmToken` - current FCM registration token, available after `connect`
- `whenReady` - promise resolved when the client is connected and logged in

## Events
Available through the `eventemitter3` API (`on`/`off`).
- `ON_MESSAGE_RECEIVED` - emitted with `{ message, persistentId }` for every decrypted notification
- `ON_CONNECT` - emitted when the socket is established
- `ON_DISCONNECT` - emitted when the connection is lost or closed
- `ON_READY` - emitted after a successful login
- `ON_HEARTBEAT` - emitted on every heartbeat ack
- `ON_TOKEN_CHANGE` - emitted with new token after `connect` when the FCM token changed
  the previous `connect` (for example, FIS replaced the installation); read the new token from
  `fcmToken`

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
