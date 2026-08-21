# class `Analytics`

Sends GA4 events to the same `g/collect` endpoint `gtag.js` uses, so no `api_secret` is needed. The client id is derived from the Firebase installation id and sessions are persisted in the app storage.

Requests are sent with a browser `User-Agent`, `Origin` and `Referer` built from `credentials.authDomain`, otherwise GA4 filters the hits as bot traffic.

## Options
```js
const analytics = new Analytics({
    app,            // FirebaseApp with `authDomain` and `measurementId` in credentials
    installations,  // Installations instance used to derive the client id
    debug: false,   // appends `_dbg=1` so events show up in GA4 DebugView
})
```

## Methods
### `logEvent`
- Sends a GA4 event with optional parameters
- String params are sent as `ep.*`, numeric params as `epn.*`

### `setUserId`
- Stores the user id sent as `uid` with every subsequent event, `null` clears it

### `setUserProperties`
- Stores user properties sent as `up.*` / `upn.*` with every subsequent event

### `setDefaultEventParameters`
- Merges the given params into every subsequent event, `{}` clears them

### `getGoogleAnalyticsClientId`
- Returns the persisted client id, creating it from the installation FID on first call
- Falls back to a generated id when the FID cannot be retrieved

## Example
```js
const { FirebaseApp, Installations, Analytics } = require('@eneris/firebase-nodejs-client')

const app = new FirebaseApp({ credentials, storage, crypto: crypto.webcrypto })
const installations = new Installations(app)

const analytics = new Analytics({ app, installations, debug: true })

analytics.setDefaultEventParameters({ app_version: '1.0.0' })
analytics.setUserId('user-123')
analytics.setUserProperties({ plan: 'premium' })

await analytics.logEvent('page_view', { page_title: 'Home' })
```

See also [`example/analytics.js`](../example/analytics.js).
