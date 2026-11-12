# class `RemoteConfig`

## Options
```js
const remoteConfig = new RemoteConfig(app, {
    fetchTimeout: 60 * 1000,           // optional, limits an individual fetch including the wait for the installation, defaults to one minute
    cacheMaxAge: 12 * 60 * 60 * 1000,  // optional, also drives the auto refresh interval, defaults to twelve hours
    languageCode: 'en-GB',             // optional
    defaultConfig: {},                 // optional, served when a key has no remote value
})
```

Fetching starts automatically once the instance is constructed, and again on every `cacheMaxAge` interval. When one of these automatic fetches fails, it is retried after one minute, then two, four, and so on, up to `cacheMaxAge`; any successful fetch ends that. A failed `fetchAndActivate()` you called yourself is not retried.

## Events
- `fetch` - emitted when config fetch is called
- `activate` - emitted when new config is downloaded from remote server and saved in storage,
  after the config, its etag and the fetch timestamp are all stored

A listener that throws is logged at `error` and does not fail the fetch.

## Methods
- `fetchAndActivate` - attempts to download config from remote server if cache is missing or invalid; concurrent calls share one request
- `getValue` - Returns instance of [`Value`](Value.md) for given key
- `getAll` - Returns all properties as collection of [`Value`](Value.md) instances
- `getAllConverted` - Returns all properties converted into their "best guess" types
- `destroy` - clears automatic refresh and its retry, and aborts an in-flight request, also
  one still waiting for its installation

## Properties
- `defaultConfig` - readable and writable, the default config served when a key has no remote value
- `isCacheValid` - `true` when a config is stored and younger than `cacheMaxAge`

Background fetch failures are reported through the app logger: transient ones (offline, a
timeout, a 429 or 5xx) at `warn`, others at `error`.

`fetchTimeout` bounds the whole call: the wait for the installation (FID and auth token) as well
as the Remote Config request. A timed out wait does not cancel the installation request, which
other modules may share.
