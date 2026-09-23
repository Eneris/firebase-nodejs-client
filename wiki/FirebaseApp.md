# class `FirebaseApp`

Shared instance holding credentials, storage, logger and crypto. All other modules take it as their first dependency.

## Options
```js
const app = new FirebaseApp({
    credentials: { /* CREDENTIALS HERE */ },
    storage,            // required, simple get/set persistency
    logger,             // optional, defaults to `console`
    crypto,             // optional, defaults to `globalThis.crypto`, needs `getRandomValues`
})
```

## Properties
- `credentials` - Firebase web app credentials
- `storage` - storage automatically prefixed with `appId`, so multiple apps can share one store
- `logger` - must implement `log`, `debug`, `warn` and `error`
- `crypto` - must implement `getRandomValues`
- `installations` - [`Installations`](Installations.md) instance created for this app

## Notes
- Every module namespaces its own keys inside the provided storage (`push_receiver.*`, `analytics.*`, …), so a single storage instance can be shared by all of them.
- Modules validate the properties they need on construction and throw a `TypeError` with a `missingProperties` array when something is missing.
- Push identity config (bundleId, chrome identity, timeZone, vapidKey) is not held here: it lives in [`PushReceiver`](PushReceiver.md) options, since it's a push concept, not something every consumer of `FirebaseApp` needs.
