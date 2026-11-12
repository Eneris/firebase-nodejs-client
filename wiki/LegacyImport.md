# `importLegacyState`

One-off import of state persisted by the libraries this one replaces, so an upgrade keeps the
installation (FID), the cached Remote Config and the push identity instead of starting over.
Reads:
- **firebase-nodejs-client 0.3.x** RemoteConfig/Installations storage, which was not
  appId-prefixed: `installations.<projectId>.<appId>.installation` and
  `remoteConfig.<appId>.{config, etag, lastFetchTimestamp}`;
- **@eneris/push-receiver** state: `credentials` (`{ gcm, fcm, keys, config }`) and
  `persistentIds`.

```js
const { importLegacyState } = require('@eneris/firebase-nodejs-client')

const written = importLegacyState(
    {
        appId: credentials.appId,
        projectId: credentials.projectId,
        storage,  // the raw storage you pass to FirebaseApp: get(key)/set(key, value), dot-path keys
    },
    {
        remoteConfig: oldRemoteConfigStore,  // the whole 0.3.x store object, optional
        push: { credentials, persistentIds }, // the @eneris/push-receiver state, optional
    },
)
// written: the storage keys it set, e.g. ['app-id.installations.installation', ...]
```

Run it before constructing `FirebaseApp` modules over that storage (for example in a storage
migration). The function is also available as `require('@eneris/firebase-nodejs-client/dist/legacyImport')`,
a module that does not load the rest of the library (no ESM-only `dot-prop`), for CommonJS
environments such as Jest.

## Behaviour
- Writes under `<appId>.` in the current layout and returns the keys it wrote
- Never overwrites a key that already holds a value: safe to run more than once, never clobbers
  state the current version created
- Skips any malformed or missing piece; does not throw on any input. Errors thrown by `storage`
  itself propagate

## What it writes
| Key | From | Notes |
|---|---|---|
| `installations.installation` | 0.3.x installation, else the push-receiver one | `expiresAt: 0`, so the first use refreshes the auth token; a refresh FIS rejects (401/404) creates a new FID as usual. The 0.3.x FID wins because Remote Config conditions are bucketed by it |
| `remote_config.config`, `etag`, `lastFetchTimestamp` | 0.3.x Remote Config | Only together, and only while none of them is set, so an etag never pairs with a different config |
| `gcm.registration` | push-receiver `credentials.gcm` | Keeps the android id and GCM token |
| `fcm.registration` | push-receiver `credentials.fcm.token` + `keys` | Only with the GCM credentials. Deliberately without `createTime`: the legacy FCM token belongs to push-receiver's own FID, so on the first `connect()` it is deleted (best effort) and a new token is registered under the imported FID |
| `push_receiver.last_persistent_ids` | push-receiver `persistentIds` | Last 30 |
| `push_receiver.announced_token` | push-receiver `credentials.fcm.token` | So the replacing token is announced as `ON_TOKEN_CHANGE(newToken, legacyToken)` |
