# class `RemoteConfig`

## Events
- `fetch` - emitted when config fetch is called
- `activate` - emitted when new config is downloaded from remote server and saved in storage

## Methods
- `fetchAndActivate` - attempts to download config from remote server if cache is missing or invalid; concurrent calls share one request
- `getValue` - Returns instance of [`Value`](Value.md) for given key
- `getAll` - Returns all properties as collection of [`Value`](Value.md) instances
- `getAllConverted` - Returns all properties converted into their "best guess" types
- `destroy` - clears automatic refresh and aborts an in-flight request

Set `fetchTimeout` in the constructor options to limit an individual fetch. Background fetch failures are reported through the app logger.
