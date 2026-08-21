# class `PushReceiverLegacy`

Wraps [`PushReceiver`](PushReceiver.md) with the configuration and credentials shape used by [`@eneris/push-receiver`](https://github.com/Eneris/push-receiver). It builds the `FirebaseApp` internally from the flat config object and maps stored credentials to the new storage layout.

Use it only when migrating an existing integration - new code should use [`PushReceiver`](PushReceiver.md).

## Config
```js
const client = new PushReceiverLegacy({
    firebase: { projectId, appId, apiKey, messagingSenderId },
    credentials,        // previously persisted credentials, optional
    persistentIds: [],  // ids of already received messages
    bundleId: 'receiver.push.com',
    chromeId: 'org.chromium.linux',
    chromeVersion: '94.0.4606.51',
    timeZone: 'Europe/Prague',
    vapidKey: '',
    heartbeatIntervalMs: 5 * 60 * 1000,
    debug: false,
})
```

## Methods
### `registerIfNeeded`
- Returns existing credentials and performs a check-in when they are still valid
- Otherwise runs a full GCM + FCM registration and returns the new credentials

### `onCredentialsChanged`
- Subscribes to `ON_CREDENTIALS_CHANGE`, returns a dispose function
- Persist the emitted credentials to reuse the same token after a restart

### `checkCredentials`
- Validates the given (or currently configured) credentials against the config

### `setDebug`
- Toggles debug logging at runtime

## Properties
- `config` - normalized config with defaults applied
- `fcmToken` - token from the legacy credentials, falling back to the base class
- `persistentIds` - readable and writable list of already processed message ids

All members of [`PushReceiver`](PushReceiver.md) are inherited.
