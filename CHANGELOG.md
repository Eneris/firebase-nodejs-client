# Changelog
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
 - Exported `Value` from the package root

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