# class `InstallationsWeb`

## Methods
### `getInstallation`
- Always returns `InstallationEntry` for given application and apiKey
- Creates new Installation if needed
- Generates new token if current one is expired

### `deleteInstalation`
- Deletes current installation if exists
- Used mostly for cleaning up the server data