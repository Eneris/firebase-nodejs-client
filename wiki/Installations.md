# class `Installations`

Provides the Firebase installation id (FID) with its auth token and the `x-firebase-client` heartbeat header used by the other modules.

## Methods
### `getInstallation`
- Always returns `InstallationEntry` for given application and apiKey
- Creates new Installation if needed
- Generates new token if current one is expired, one hour before the real expiry
- Self-heals when FIS answers a refresh with 401 or 404, which means it no longer knows this
  FID: requests a brand new installation and only overwrites the stored one once that
  succeeds, so a failed replacement never discards a working FID/refresh token. The new
  installation has a new FID, which invalidates any existing FCM registration server-side and
  rotates the FCM token (see [`PushReceiver`](PushReceiver.md)'s `ON_TOKEN_CHANGE`)
- Any other refresh failure (429 or 5xx once retries are exhausted, 400, 403, an abort or
  timeout, an unusable response body) keeps the stored credentials untouched: while the stored
  auth token is still genuinely usable it is served as-is with a warning logged, and only
  rethrown once it is genuinely expired. A plain connectivity failure does not reach this
  branch at all, because the request keeps retrying until the network comes back
- After a failed refresh, further refreshes are skipped for 60 seconds while the stored token
  is still usable, so an ongoing FIS outage does not retry on every call

### `deleteInstallation`
- Deletes current installation if exists
- Clears the local entry, so a subsequent `getInstallation` creates a fresh installation
  instead of serving the deleted one
- Used mostly for cleaning up the server data

The legacy misspelling `deleteInstalation` remains as a deprecated alias.

## Errors
- `InstallationsRequestError` - thrown by `getInstallation`/`deleteInstallation` when FIS
  answers a request with a non-ok HTTP status. Carries `status`, the HTTP status code, in
  addition to the usual `message`, so callers can tell an authoritative rejection (401/404)
  apart from a transient one without parsing the message text. Exported from the package
  root, `@eneris/firebase-nodejs-client`.