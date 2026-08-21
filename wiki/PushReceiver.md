# class `PushReceiver`

Registers the app with GCM/FCM, keeps a persistent TLS connection to `mtalk.google.com` open, decrypts incoming messages and deduplicates them using persistent ids stored in your storage. Registration data is persisted, so a restarted process reuses the same FCM token.

## Config
```js
const client = new PushReceiver(app, {
    heartbeatIntervalMs: 5 * 60 * 1000, // optional, defaults to 5 minutes
    maxRetryAttempts: 5,                // optional, non-positive value disables the limit
})
```

`app.config.bundleId`, `app.config.chromeVersion` and `app.config.vapidKey` are required, as are `credentials.appId` and `credentials.projectId`.

## Methods
### `connect`
- Registers with GCM/FCM if no valid registration is stored
- Opens the connection and resolves once the client is logged in
- Returns `whenReady` when already connected

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

## Example
```js
const crypto = require('crypto')
const { FirebaseApp, PushReceiver } = require('@eneris/firebase-nodejs-client')

const app = new FirebaseApp({
    credentials: { /* CREDENTIALS HERE */ },
    config: { bundleId: 'receiver.push.com', vapidKey: '' },
    storage,
    crypto,
})

const client = new PushReceiver(app)

const stopListening = client.onNotification(({ message, persistentId }) => {
    console.log('Notification received', persistentId, message)
})

await client.connect()

console.log('FCM token:', client.fcmToken)
```

See also [`PushReceiverLegacy`](PushReceiverLegacy.md) and [`example/push.js`](../example/push.js).
