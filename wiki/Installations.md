# class `Installations`

Provides the Firebase installation id (FID) with its auth token and the `x-firebase-client` heartbeat header used by the other modules.

## Methods
### `getInstallation`
- Always returns `InstallationEntry` for given application and apiKey
- Creates new Installation if needed
- Generates new token if current one is expired

### `deleteInstalation`
- Deletes current installation if exists
- Used mostly for cleaning up the server data