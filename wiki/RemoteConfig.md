# class `RemoteConfig`

## Options
```js
const remoteConfig = new RemoteConfig(app, {
    fetchTimeout: 60 * 1000,           // optional, limits an individual fetch, defaults to one minute
    cacheMaxAge: 12 * 60 * 60 * 1000,  // optional, also drives the auto refresh interval, defaults to twelve hours
    languageCode: 'en-GB',             // optional
    defaultConfig: {},                 // optional, served when a key has no remote value
})
```

Fetching starts automatically once the instance is constructed, and again on every `cacheMaxAge` interval.

## Events
- `fetch` - emitted when config fetch is called
- `activate` - emitted when new config is downloaded from remote server and saved in storage

## Methods
- `fetchAndActivate` - attempts to download config from remote server if cache is missing or invalid; concurrent calls share one request
- `getValue` - Returns instance of [`Value`](Value.md) for given key
- `getAll` - Returns all properties as collection of [`Value`](Value.md) instances
- `getAllConverted` - Returns all properties converted into their "best guess" types
- `destroy` - clears automatic refresh and aborts an in-flight request

## Properties
- `defaultConfig` - readable and writable, the default config served when a key has no remote value
- `isCacheValid` - `true` when a config is stored and younger than `cacheMaxAge`

Background fetch failures are reported through the app logger.
