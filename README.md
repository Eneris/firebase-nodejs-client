# Firebase NodeJS Client
Compact firebase client implementation for NodeJS environment

## Why do we need another module

Current official modules support only
 - Node.js as Admin with few to no client capabilities
 - Browser only env (hard linked to `window`, `IndexedDB` and `WebWorkers`)

I needed a module that I could use in any JavaScript environment. The main difference is that you can provide your own storage with simple get/set methods for data persistence.

Putting this public, so it can help some other projects too.
Will add more parts based on my project needs or upon request.

## What is done / planned
 - ✅ Web Installations
 - ✅ Mobile Installations
 - ✅ Remote config
 - ✅ Cloud Messaging - receiving push notifications (`PushReceiver`)
 - ✅ Cloud Messaging - sending push notifications (`PushSender`)
 - ✅ Google Analytics 4 events (`Analytics`)
 - ✅ HeartBeat
 - ✅ Reliability tests using the Node.js test runner

## Exports

| Export | Description |
|---|---|
| [`FirebaseApp`](wiki/FirebaseApp.md) | Shared app instance holding credentials, storage, logger, crypto and config |
| [`Installations`](wiki/Installations.md) | Firebase Installations (FID + auth token) and heartbeat header |
| [`RemoteConfig`](wiki/RemoteConfig.md) | Remote config fetch/activate with auto refresh (also the default export) |
| [`Analytics`](wiki/Analytics.md) | GA4 event logging through the `g/collect` endpoint |
| [`PushReceiver`](wiki/PushReceiver.md) | Persistent MCS/FCM connection receiving push notifications |
| [`PushSender`](wiki/PushSender.md) | Sending push notifications via the FCM HTTP v1 API |
| [`PushReceiverLegacy`](wiki/PushReceiverLegacy.md) | Drop-in compatible API for `@eneris/push-receiver` consumers |

## How to use it
```js
const fs = require('fs')
const path = require('path')
const { FirebaseApp, Installations, RemoteConfig } = require('../dist')

const storageFileName = path.join(__dirname, 'storage.json')

let store = {}

if (fs.existsSync(storageFileName)) {
    store = JSON.parse(fs.readFileSync(storageFileName).toString())
}

const app = new FirebaseApp({
    credentials: { /* CREDENTIALS HERE */ },
    storage: {
        get: (key) => store[key],
        set: (key, value) => {
            store[key] = value

            fs.writeFileSync(storageFileName, JSON.stringify(store, null, 2))
        }
    }
})

const remoteConfig = new RemoteConfig(app, {
    defaultConfig: {
        test: 'true'
    }
})

remoteConfig.on('fetch', () => {
    console.log('fetch')
})

remoteConfig.on('activate', () => {
    console.log('activate')
})

remoteConfig.fetchAndActivate().then(() => {
    console.log(remoteConfig.getAll())
})
```

Every module namespaces its own keys inside the provided storage, so a single storage instance can be shared by all of them. See [`FirebaseApp`](wiki/FirebaseApp.md) for all available options.

## Receiving push notifications

[`PushReceiver`](wiki/PushReceiver.md) registers the app with GCM/FCM, keeps a persistent connection to `mtalk.google.com` open, decrypts incoming messages and deduplicates them using persistent ids stored in your storage. Registration data is persisted, so a restarted process reuses the same FCM token.

```js
const client = new PushReceiver(app)

client.onNotification(({ message, persistentId }) => {
    console.log('Notification received', persistentId, message)
})

await client.connect()

console.log('FCM token:', client.fcmToken)
```

Migrating from `@eneris/push-receiver`? Use [`PushReceiverLegacy`](wiki/PushReceiverLegacy.md), which keeps the old config and credentials shape.

## Sending push notifications

[`PushSender`](wiki/PushSender.md) sends messages through the FCM HTTP v1 API using your service account.

```js
const sender = new PushSender({ /* SERVICE ACCOUNT JSON HERE */ })

await sender.send({ title: 'Hello', body: 'World' }, fcmToken)
```

## Analytics

[`Analytics`](wiki/Analytics.md) sends GA4 events to the same `g/collect` endpoint `gtag.js` uses, so no `api_secret` is needed.

```js
const analytics = new Analytics({ app })

await analytics.logEvent('page_view', { page_title: 'Home' })
```

## Examples
- [`example/fetch.js`](example/fetch.js) - remote config
- [`example/push.js`](example/push.js) - push receiver + sender
- [`example/analytics.js`](example/analytics.js) - analytics events

### Wiki
- [`FirebaseApp`](wiki/FirebaseApp.md)
- [`Installations`](wiki/Installations.md)
- [`RemoteConfig`](wiki/RemoteConfig.md)
- [`Value`](wiki/Value.md)
- [`Analytics`](wiki/Analytics.md)
- [`PushReceiver`](wiki/PushReceiver.md)
- [`PushReceiverLegacy`](wiki/PushReceiverLegacy.md)
- [`PushSender`](wiki/PushSender.md)

## Credits
 - Big thanks to authors of https://github.com/firebase/firebase-js-sdk . Most of the logic/types/infromation comes from there
 - Push receiving logic originates from https://github.com/Eneris/push-receiver