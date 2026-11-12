# Errors

Typed errors and the classifier the library uses for log levels and self-heal decisions. All
are exported from the package root, so `instanceof` works across module copies.

- `HttpRequestError` - a non-ok HTTP response from GCM checkin/register, FCM registration or
  Remote Config. Carries `status` and `statusText`; the message keeps the
  `Request failed: <status> <text>` shape (Remote Config: `Failed to fetch RemoteConfig status: <status>`)
- `InstallationsRequestError` - a non-ok response from Firebase Installations, carries
  `status`; see [`Installations`](Installations.md#errors)
- `GcmRegisterError` - GCM register answered `Error=<CODE>`. Carries `code`, e.g.
  `INVALID_SENDER`, `PHONE_REGISTRATION_ERROR`
- `isTransientError(error)` - `true` for a failure expected to go away on its own: a network
  error (`fetch failed`, `ECONNRESET`, `ENOTFOUND`, `ETIMEDOUT`, ... also in `error.cause`), an
  abort or timeout (`AbortError`, `TimeoutError`), or an HTTP 429/5xx. `false` for everything
  else, including any other 4xx
