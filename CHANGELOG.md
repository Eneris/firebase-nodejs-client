# Changelog
## 1.1.0
### Fixed
 - An event listener that throws can no longer break the library. In `PushReceiver` a throw from any `ON_*` listener used to reach the frame parser's error handling and close the MCS connection (and a throwing `ON_TOKEN_CHANGE` listener failed the attempt); in `RemoteConfig` a throwing `activate` listener rejected `fetchAndActivate()`. The throw is now logged at `error` and the library carries on. As with Node's `EventEmitter`, it still stops the listeners after it for that one emit. `PushReceiverLegacy`'s `ON_CREDENTIALS_CHANGE` is isolated the same way
 - `RemoteConfig` stores the config, etag and fetch timestamp before emitting `activate`, so a listener sees the complete state
 - A connection that drops within 10 seconds of its login no longer resets the reconnect backoff: the backoff continues from where it was before that login, as in Chromium's `connection_factory_impl.cc` (`kConnectionResetWindowSecs`). A server that accepted the login and dropped the connection used to be retried immediately, in a hot loop
 - A `LoginResponse` carrying an error is now a failed attempt: no `ON_READY`, `whenReady` stays pending, the backoff keeps growing (Chromium `mcs_client.cc`, `LOGIN_FAILURE`). It used to count as a successful login
 - A GCM checkin rejected with 400 or 401 (stale credentials) now drops the stored GCM registration and registers again in the same call, instead of failing every attempt forever (Chromium `gcm_client_impl.cc` `OnCheckinCompleted` resets its GCM store on these). The new GCM token rotates the FCM token, announced through `ON_TOKEN_CHANGE`
 - A GCM checkin answer without an android id or security token is now a failed checkin instead of being stored as credentials with `undefined` ids (Chromium `checkin_request.cc`, `kZeroIdOrToken`)
 - An FCM registration renewal answered with 404 (registration gone) now registers a new one in the same call instead of failing the connection attempt
 - `RemoteConfig`'s `fetchTimeout`, and `destroy()`, now also bound the wait for the installation: a Firebase Installations request that never completed used to keep `fetchAndActivate()` pending forever
 - `destroy()` or a timeout now ends a `fetch` retry loop at once, also while it waits out its backoff delay, and leaves no timer behind; it used to keep the event loop alive for up to 10 minutes
 - The FCM registration's FID check now waits for a Firebase Installations request already in flight (for example `RemoteConfig` replacing a rejected installation), so a registration bound to a replaced FID is re-registered on that attempt instead of being served until the next one

### Changed
 - **Firebase Installations requests are bounded.** One request, retries included, now ends after `requestTimeoutMs` (new `FirebaseApp` option, default 60 s; `0` restores the previous unbounded retry). A timed out request is a transient failure: stored credentials are kept and served while usable. Callers retry on their own schedule (`PushReceiver` backoff, `RemoteConfig` background retry)
 - **Login timeout.** A `PushReceiver` attempt that has not logged in 30 seconds after opening its socket (TCP, TLS and login together) is closed and retried like a lost connection, with `ON_DISCONNECT`. Chromium uses the same 30 s (`kReadTimeoutMs`) for the login answer only
 - A failed FCM registration renewal that is transient (network error, timeout, 429, 5xx) now keeps serving the current registration, with a warning, and renews again on the next attempt, instead of failing the connection attempt. Message delivery does not depend on the renewal. firebase-js-sdk's `updateToken()` rethrows here
 - `ON_TOKEN_CHANGE` is now emitted as `(newToken, oldToken)` and also for a token that changed while the process was not running: the last announced token is persisted under `push_receiver.announced_token`. The first start after upgrading from 1.0.x announces nothing (nothing persisted yet). `PushReceiverLegacy` keeps it in memory only
 - Log levels: transient failures (offline, a timeout, a 429/5xx, a reset socket) are logged at `warn`; `error` is left for permanent failures, protocol violations, listener throws and the retry limit. Previously every failed reconnect attempt, socket error and `RemoteConfig` background fetch failure was an `error`; an unknown MCS tag is now a `warn`
 - Quick login-then-drop cycles and failed logins now count towards `maxRetryAttempts` (they used to reset the count), so with a finite limit such a server makes the receiver give up with `PushReceiver retry limit reached`
 - `RemoteConfig` now requires `logger.error`
 - Errors from `utils/request.ts` (GCM checkin/register, FCM registration) are now `HttpRequestError` and GCM register errors `GcmRegisterError`; messages are unchanged. A non-ok `RemoteConfig` fetch status is an `HttpRequestError` too, same message

### Added
 - `PushReceiver` option `retryInitialConnect` (default `false`): a failed first attempt of `connect()` goes on the retry schedule instead of rejecting, so `connect()` stays pending until a login
 - `PushReceiver.reconnect()`: starts a fresh attempt now, cutting a backoff short or replacing a logged-in connection; for OS resume and network-change handlers
 - `RemoteConfig` retries a failed automatic fetch (at construction or on the `cacheMaxAge` interval) after 1, 2, 4, ... minutes up to `cacheMaxAge`, instead of waiting for the next interval
 - `Installations.whenSettled()`: waits for an installation request already in flight, never starts one
 - `FirebaseApp` option and property `requestTimeoutMs`
 - `HttpRequestError` (`status`, `statusText`), `GcmRegisterError` (`code`) and `isTransientError()`, exported from the package root
 - `importLegacyState()`: one-off import of firebase-nodejs-client 0.3.x Remote Config/Installations storage and `@eneris/push-receiver` credentials into the current layout, also loadable as `dist/legacyImport` without the rest of the library

## 1.0.4
 - Upgraded `protobufjs` to 8.8.1, `protobufjs-cli` to 2.7.1, `@types/node` to 26.6.6 and `oxlint` to 1.90.0

## 1.0.3
 - Replaced ESLint and `@typescript-eslint` with Oxlint (`oxlint.config.mts`), keeping the same rule set
 - Upgraded TypeScript from 6.x to 7.x and `@types/node` from 25.x to 26.x
 - Fixed GCM registration retrying `INVALID_SENDER`, `INVALID_PARAMETERS`, `QUOTA_EXCEEDED` and `TOO_MANY_REGISTRATIONS` instead of failing immediately, matching Chromium's `ShouldRetryWithStatus()`
 - Fixed an unparseable Remote Config fetch response body silently wiping the active config; a non-JSON body on any non-304 status now rejects the fetch with `FETCH_PARSE` instead
 - Fixed `RemoteConfig.getValue` returning a non-string `defaultConfig` value as-is instead of stringifying it first, like upstream's `getValue` does; object and array defaults are JSON-encoded instead, so `asJSON()` and `asConverted()` keep their structure
 - Fixed heartbeat ping/ack requests writing a hand-rolled `last_stream_id_received` key instead of the generated protobuf's `lastStreamIdReceived`, which was silently dropped on the wire; stream id counting also now restarts at 0 for every new connection instead of once at process startup, matching Chromium's `mcs_client.cc`
 - Fixed a heartbeat timeout or an MCS frame parser error reconnecting without emitting `ON_DISCONNECT`, unlike a server `Close` or a plain socket close
 - Fixed a reconnect attempt that failed during checkin/registration (for example while offline) giving up instead of staying on the backoff schedule, so `PushReceiver` no longer goes silent until the app calls `connect()` again
 - Redesigned `PushReceiver`'s connection lifecycle around a single tracked attempt: overlapping `connect()` calls, a firing retry timer and `destroy()` can no longer race and leave a second, unmanaged socket open
 - `connect()` is now idempotent: it joins an attempt already in flight, or a retry waiting out its backoff, instead of starting a second one, and never shortens the backoff; call `destroy()` first to reconnect immediately
 - `destroy()` is now safe to call at any time, including from inside an event listener: nothing the cancelled attempt was about to do runs afterwards, and it rejects any pending `connect()` call together with a still-pending `whenReady` (one that already resolved, a completed login, stays resolved)
 - If the socket closes before login completes, `connect()` no longer rejects on the spot: it stays pending through the reconnect/backoff retries, resolving once a later attempt logs in, or rejecting with `PushReceiver retry limit reached` once `maxRetryAttempts` is exhausted; a fresh `connect()` on an idle receiver still rejects outright, with no retry, on a registration failure or a synchronous `tls.connect()` error
 - A fresh `connect()` after `PushReceiver retry limit reached` now gets the full `maxRetryAttempts` budget again instead of exhausting it immediately
 - Capped the reconnect backoff at 10 minutes per attempt instead of letting it grow exponentially forever, the same cap as Chromium's MCS connection backoff

## 1.0.1
 - **Breaking:** `PushReceiver` push identity config moved from `options.config` to its own required second argument: `new PushReceiver(app, config, options)`. Pass `{}` to use all `DEFAULT_*` values
 - Fixed `Value.asConverted` (and so `RemoteConfig.getAllConverted`) returning `true` for `'false'`, and converting an empty value to `0` instead of keeping it an empty string
 - Exported `Value` from the package root
 - Moved shared types from `src/lib/types.ts` to `src/utils/types.ts`
 - Published under the `latest` dist-tag

## 1.0.0-push-receiver
 - Added `PushReceiver` - persistent MCS/FCM connection with registration, decryption, heartbeat and reconnect handling
 - Added `PushReceiverLegacy` - drop-in compatible API for `@eneris/push-receiver` consumers
 - Added `PushSender` - sending notifications through the FCM HTTP v1 API
 - Added `Analytics` - GA4 event logging through the `g/collect` endpoint
 - Moved `FirebaseApp`, `Installations` and `RemoteConfig` from `src/lib` to the package root and unified storage namespacing per module
 - `FirebaseApp` now accepts a pluggable `crypto` implementation; push identity config (bundleId, chrome identity, timeZone, vapidKey) is passed as `config` in `PushReceiver` options instead, each field defaulting to the matching `DEFAULT_*` in `src/utils/constants.ts`
 - Package now ships `src` and `wiki`, lists its markdown files explicitly (`README.md`, `CHANGELOG.md`; `AGENTS.md` is no longer shipped), and publishes with public access under the `experimental` dist-tag
 - Requires Node.js >= 20.19 (`dot-prop` is ESM only)
 - Added certificate verification and SNI to the persistent FCM connection
 - Bounded HTTP retries, corrected OAuth token expiry caching and hardened MCS frame parsing
 - Fixed Remote Config request cleanup, timeout handling and background error reporting
 - Added per-app installation locking and GA4 session rollover after 30 minutes of inactivity
 - Added reliability regression tests using the Node.js test runner
 - Validated Firebase Installations auth token responses and `fid`/`refreshToken` on creation before storing them, rejecting an unusable response instead of caching a broken entry
 - Tightened installation auth token expiry parsing and added a one hour refresh margin plus a backwards-clock guard, so a token about to expire (or a corrupted `expiresAt`) is never handed out as valid
 - Self-healed Firebase Installations refresh failures: a 401/404 recreates the installation with a new FID, any other failure keeps the stored credentials and serves the existing auth token while it is still genuinely usable, with a 60 second cool-down between refresh attempts
 - Exported `InstallationsRequestError`, carrying a machine-readable `status`, for Installations request failures
 - `deleteInstallation` now clears the local entry so a deleted installation is not served afterwards
 - FCM registration lookups skip Firebase Installations entirely when the cached registration is already valid, so a Firebase Installations outage no longer blocks `PushReceiver.connect()`
 - Added `ON_TOKEN_CHANGE` event to `PushReceiver`, emitted when the FCM token changes after `connect` (for example, following an installation self-heal)
 - GCM register retries are no longer reported as warnings: Google answers `PHONE_REGISTRATION_ERROR` for the first few attempts routinely, so a failed attempt is logged at debug level and only an exhausted retry budget throws, with the last server response included in the error
 - A cached FCM registration whose installation is gone (cleared or replaced) is now re-registered, instead of serving a token bound to an installation that no longer exists
 - Reworked the `fetch` retry policy: a rejected request retries until it succeeds, so a request made while offline completes once connectivity returns, while 429 and 5xx are bounded at 3 retries. The backoff doubles per attempt up to 10 minutes. `fetch-retry` ignores its own `retries` option when `retryOn` is a function, so the previous bound never applied and a persistent failure could retry forever

## 0.4.0
 - Replaced `axios` + `axios-retry` with native `fetch` + `fetch-retry`, removing Node.js HTTP adapter dependency
 - Enabled TypeScript strict mode (`strict: true`) and resolved all resulting type errors
 - Added `declarationMap`, `skipLibCheck`, and `forceConsistentCasingInFileNames` to tsconfig
 - Upgraded TypeScript from 5.x to 6.x
 - Upgraded ESLint from 8.x to 10.x and `@typescript-eslint` plugins from 6.x to 8.x
 - Updated `@types/node` from 18.x to 25.x

## 0.2.0
 - `fetchAndActivate` now locks semaphore to prevent concurent fetch attempts
 - Added timer to auto fetch config when cache expires
 - Added `asConverted` on `Value` and `getAllConverted` on `RemoteConfig` which returns auto-converted values