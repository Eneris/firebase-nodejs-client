# class `FirebaseApp`

Shared instance holding credentials, storage, logger, crypto and config. All other modules take it as their first dependency.

## Options
```js
const app = new FirebaseApp({
    credentials: { /* CREDENTIALS HERE */ },
    storage,            // required, simple get/set persistency
    logger,             // optional, defaults to `console`
    crypto,             // optional, defaults to `globalThis.crypto`, needs `getRandomValues`
    config: {           // optional, all values have defaults
        bundleId: 'receiver.push.com',
        chromeId: 'org.chromium.linux',
        chromePlatform: undefined,  // 1 = Windows, 2 = Darwin, 3 = Linux, 4 = Cros, 5 = iOS
        chromeChannel: undefined,   // 1 = stable, 2 = beta, 3 = dev, 4 = canary, 5 = unknown
        chromeVersion: '94.0.4606.51',
        timeZone: 'Europe/Prague',
        vapidKey: '',   // your own web push certificate key pair
    },
})
```

## Properties
- `credentials` - Firebase web app credentials
- `storage` - storage automatically prefixed with `appId`, so multiple apps can share one store
- `logger` - must implement `log`, `debug`, `warn` and `error`
- `crypto` - must implement `getRandomValues`
- `config` - resolved config with defaults applied
- `installations` - [`Installations`](Installations.md) instance created for this app

## Notes
- Every module namespaces its own keys inside the provided storage (`push_receiver.*`, `analytics.*`, …), so a single storage instance can be shared by all of them.
- Modules validate the properties they need on construction and throw a `TypeError` with a `missingProperties` array when something is missing.
