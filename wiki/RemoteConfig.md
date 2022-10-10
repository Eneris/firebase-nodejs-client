# class `RemoteConfig`

## Events
- `fetch` - emitted when config fetch is called
- `activate` - emitted when new config is downloaded from remote server and saved in storage

## Methods
- `fetchAndActivate` - attempts to download config from remote server if cache is missing or invalid
- `getValue` - Returns instance of [`Value`](Value.md) for given key
- `getAll` - Returns all properties as collection of [`Value`](Value.md) instances
- `getAllConverted` - Returns all properties converted into their "best guess" types
