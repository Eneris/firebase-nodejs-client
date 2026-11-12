# AGENTS.md

Guidance for an AI agent making changes in this repository. For user-facing docs see
[`README.md`](README.md); for per-class API reference see [`wiki/`](wiki). This file covers
what those don't: layout, conventions, and the design decisions that are expensive to
rediscover from the diff alone.

## What this is

A Firebase client meant to run in any JavaScript environment, not just a browser or
Node.js-as-admin. The constraint that shapes every module: there are no browser globals to
lean on. Storage, logging and crypto are all supplied by the consumer through `FirebaseApp`
(see [`wiki/FirebaseApp.md`](wiki/FirebaseApp.md)), and every module namespaces its own keys
inside that one storage instance so several modules — or several apps — can share it.

## Commands

- `yarn lint` — Oxlint over `src/` (config in `oxlint.config.mts`).
- `yarn build` — cleans `dist/` and `tsconfig.tsbuildinfo`, regenerates the protobuf JS/typings
  (`yarn protobuf`), then runs `tsc` and copies the protobuf output into `dist/protobuf`.
- `yarn protobuf` — regenerates `src/protobuf/protos.js` and `protos.d.ts` from the `.proto`
  files. Run this (via `yarn build`) after touching any `src/protobuf/*.proto` file.
- `yarn test` — **runs `yarn build` first**, then `node --test test/*.test.js`. The suite is
  plain `node:test`, one process per file. It requires against `../dist`, so it exercises
  compiled output, not `src/` directly — a source-only edit that isn't built is invisible to
  the tests. Every test file overrides `global.fetch` once at load time to call a swappable
  handler, so individual tests swap behaviour by replacing the handler, not by re-mocking
  `fetch`: `test/reliability.test.js` reassigns its own `fetchHandler` variable, the other files
  call `setFetchHandler()` from `test/helpers.js`.
  - `test/helpers.js` (not a test file itself) is the shared harness: `createApp()` with a
    level-recording logger, `pushFetchHandler()` answering every registration endpoint,
    `installFakeTls()` replacing `tls.connect` with a `FakeSocket` (`login()`, `drop()`,
    `destroyed`), MCS frame builders, `waitFor()`/`flush()` (setImmediate based) and `within()`
    (a real-time deadline for tests whose red state is a hang).
  - `test/pushReceiver.test.js` drives the MCS connection lifecycle over that fake socket with
    `t.mock.timers` mocking `setTimeout` and `Date` (never `setImmediate`, which `flush()`
    needs): retry/backoff, reset window, login error/timeout, `reconnect()`, listener isolation,
    log levels, token announcements.
  - `test/timeouts.test.js` covers the abort path of `utils/fetch.ts`, `requestTimeoutMs` and
    `RemoteConfig`'s `fetchTimeout`/background retry; `test/legacyImport.test.js` covers
    `importLegacyState()` and loads `dist/legacyImport` before anything else to prove it does
    not pull in `app.ts`.
- `yarn precommit` — `yarn lint && yarn test`. Run this before considering a change done.
- `yarn npm publish --tag experimental` — publishes the package. Yarn 4 ignores
  `publishConfig.tag` from `package.json` (verified: `yarn npm publish --dry-run` printed
  "with tag latest" despite `publishConfig.tag: "experimental"` being set), so the tag has to
  be passed explicitly on the command line. Run `yarn npm publish --dry-run` first to inspect
  the file list that will actually be published.

## Layout

- `src/app.ts` — `FirebaseApp`, the shared instance every other class takes as its first
  dependency. Holds `credentials`, `storage` (wrapped to prefix every key with `credentials.appId`),
  `logger` (defaults to `console`) and `crypto` (defaults to `globalThis.crypto`). Also
  exports `assertRequiredProperties()`, see Conventions.
- `src/installations.ts` — Firebase Installations (FID + auth token) and the heartbeat cache/
  header used by other requests. See Invariants below; this is the module with the most
  non-obvious behaviour in the codebase.
- `src/remoteConfig.ts` — Remote Config fetch/activate, cached in storage with an `etag`,
  refreshed on an interval, one in-flight fetch shared via a semaphore promise.
- `src/analytics.ts` — GA4 event logging through the same `g/collect` endpoint `gtag.js` uses.
- `src/pushReceiver.ts` — `PushReceiver`: composes `lib/gcm.ts` + `lib/fcm.ts` for registration,
  then owns the persistent MCS TLS connection (login, heartbeat, retry/backoff, message
  decryption via `utils/decrypt.ts`, persistent-id dedup) using `lib/parser.ts` to frame
  incoming bytes and `protobuf/` for the wire messages.
- `src/pushReceiverLegacy.ts` — `PushReceiver` (exported as `PushReceiverLegacy` from
  `index.ts`) wrapped with the flat config/credentials shape of `@eneris/push-receiver`. See
  Invariants below for the storage adapter it injects.
- `src/pushSender.ts` — sends via the FCM HTTP v1 API using a service account JWT; independent
  of every other module (no `FirebaseApp`, no Installations).
- `src/lib/gcm.ts` — GCM checkin + registration (`android.clients.google.com`). Produces the
  `androidId`/`securityToken`/`token` that MCS login and FCM registration both depend on.
- `src/lib/fcm.ts` — FCM web-push registration (create/update/delete against
  `fcmregistrations.googleapis.com`), keyed off a GCM registration and a Firebase Installation.
  See Invariants below for `installationFid` stamping.
- `src/lib/parser.ts` — turns raw MCS TLS bytes into tagged protobuf messages (`Parser`),
  mirroring Chromium's `WaitForData` state machine (see the comment at the top of the file for
  what deliberately differs).
- `src/legacyImport.ts` — `importLegacyState()`, the one-off import of 0.3.x Remote
  Config/Installations storage and `@eneris/push-receiver` credentials. See Invariants below.
- `src/utils/` — `fetch.ts` (retry policy for fetch-based calls, see Invariants), `request.ts`
  (an older, separate linear-retry helper used only by the GCM checkin/registration and
  `PushSender` paths, which still use plain `fetch` directly), `errors.ts` (`HttpRequestError`,
  `InstallationsRequestError`, `GcmRegisterError`, `isTransientError()`), `emit.ts`
  (`emitSafely()`, see Invariants), `abort.ts` (`abortableDelay()`, `raceAbort()`), `legacy.ts`
  (legacy-shape converters shared by `pushReceiverLegacy.ts` and `legacyImport.ts`; no runtime
  import of `app.ts`), `decrypt.ts` (web push aesgcm decryption), `base64.ts`, `value.ts`
  (`Value`, used by `RemoteConfig.getValue`/`getAll`), `constants.ts` (MCS/GCM protocol enums,
  `DEFAULT_*`), `defer.ts`, `timeout.ts`.
- `src/protobuf/` — `.proto` sources plus generated `protos.js`/`protos.d.ts` (regenerated by
  `yarn protobuf`, do not hand-edit) and `index.ts`, which wires up `Long` for protobufjs.

## Conventions

- Four-space indentation, no semicolons (see any `src/*.ts` file for the prevailing style).
- Private state uses real private `#` fields, not TypeScript's `private` keyword, except for
  a few pre-existing `private` methods left as-is.
- Every class that takes `FirebaseApp` (or another dependency object) calls
  `assertRequiredProperties()` (from `src/app.ts`) at construction, listing every
  `app.*`-rooted property path the class actually reads (e.g. `'credentials.apiKey'`,
  `'storage.get'`, `'logger.warn'`). Keep this list in sync when you add or remove a use of
  `app.*` inside the class — it's the only thing that turns a missing dependency into a clear
  constructor-time error instead of a runtime `undefined` crash deep in a request.
- Storage access is never ad hoc: each class builds a small local `#storage` object in its
  constructor that namespaces every key under its own prefix (`` `installations.${key}` ``,
  `` `fcm.${key}` ``, …) and delegates to `app.storage.get`/`set`. Add new persisted fields
  through that wrapper, not by calling `app.storage` directly.
- Defaults are applied once, in the constructor of the class that owns the concept (push
  config, for example, is owned by `PushReceiver`, not `FirebaseApp`), by spreading the
  matching `DEFAULT_*` constants from `utils/constants.ts` under the caller's options.
  Dependents (`GCM`, `FCM`) take the already-resolved object as a constructor parameter,
  assert it themselves, and read it with `!`. There is no `??` fallback at a read site.
- Comments explain *why*, not *what*. Keep it that way — see the next section for what "why"
  is worth knowing here that isn't in the diff.

## Design decisions and invariants

These are the parts of the design that cost real time to reconstruct from the code alone.
Read this section before touching `installations.ts`, `lib/fcm.ts`, `utils/fetch.ts` or
`pushReceiverLegacy.ts`.

### Firebase Installations failure policy (`src/installations.ts`)

`getInstallation()` has to decide, on every call, whether to serve the stored auth token,
refresh it, or throw — while never losing a working FID/refresh token to a request that
merely failed. The policy:

- **Refresh margin.** A stored token is treated as expired `INSTALLATION_REFRESH_MARGIN`
  (one hour) before it actually expires, so a refresh always has headroom before the real
  deadline.
- **Authoritative invalidity.** Only a `401` or `404` from the refresh (auth token generate)
  request means "FIS no longer knows this installation" (`isInstallationInvalid()` /
  `InstallationsRequestError.status`). Every other failure — network error, timeout, `429`,
  `5xx`, `400`, `403`, or a response body that fails `parseAuthTokenResponse()` — is treated
  as transient and must never discard stored credentials.
- **Self-heal without data loss.** On an authoritative 401/404, `#getInstallation()` requests
  a brand new installation (`#requestNewInstallation()`) and only overwrites storage
  (`#create({ replace: true })`) once that request succeeds. `#requestNewInstallation()`
  itself never reads or writes storage, so a failed replacement can never discard a working
  FID or refresh token — the old entry is still there to retry with next time.
- **Serve-stale-while-usable.** On a transient failure, the stored token is still returned as
  long as it is "genuinely usable" (`#isUsableNow()`, expiry margin
  `INSTALLATION_MIN_USABLE_MS`, one minute) — long enough to outlive the request about to use
  it. Only once the token is within a minute of (or past) its real expiry does the transient
  failure get rethrown to the caller.
- **Refresh cool-down.** A failed refresh starts a 60 second cool-down
  (`INSTALLATION_REFRESH_COOLDOWN_MS`, per `FirebaseApp` instance, in-memory only). While on
  cool-down *and* the stored token is still usable, `#getInstallation()` skips the network
  call entirely instead of paying the full `fetchWithRetry` backoff again.
- **Bounded requests.** Every FIS request (create, refresh, delete) carries
  `AbortSignal.timeout(app.requestTimeoutMs)` (`FirebaseApp` option, default 60 s, `0` = no
  signal = the old unbounded network retry). One signal spans the whole `fetchWithRetry` loop.
  A timeout is a transient failure like any other: it never discards stored credentials, and
  the callers' own schedules (PushReceiver backoff, RemoteConfig background retry) take over.
  Upstream fails fast instead (`APP_OFFLINE`), so bounded is the closer behaviour.
- **Backwards-clock guard.** `isInstallationExpired()` also treats an entry as expired if its
  remaining lifetime is *implausibly long* — more than `MAX_INSTALLATION_LIFETIME` (7 days,
  the real FIS token lifetime) past the refresh margin. FIS tokens can't legitimately outlive
  a fresh token by that much, so a value like that means the system clock moved backwards or
  the entry came from a restored backup; the fix is to refresh and let FIS overwrite
  `expiresAt` with a sane value, using the constant margin regardless of how the caller was
  invoked — a bogus entry is bogus at any margin.

### FCM registration is bound to an installation FID (`src/lib/fcm.ts`)

Every `FcmData` created or renewed by `#register()`/`#refreshRegistration()` is stamped with
`installationFid`, the FID it was created under. On every subsequent `getRegistration()` call,
`#refreshRegistration()` compares that stamp against `installations.storedFid` *before* doing
anything else:

- A **mismatch** — including a stored installation that no longer exists at all — means FIS
  replaced or deleted the installation this registration belongs to (self-heal on a
  rejected FID, or an explicit `deleteInstallation()`). The old registration is dead
  server-side, so `#refreshRegistration()` re-registers from scratch rather than trying to
  patch or delete the stale one. A missing stored FID counts as a mismatch too — otherwise a
  deleted installation would keep being served from the zero-I/O steady-state path until the
  7 day renewal check finally caught it.
- A **missing stamp** on the stored registration (only possible via
  `pushReceiverLegacy.ts`'s `LegacyStorageAdapter#getCurrentFcmRegistration()`, which has no
  FID to supply) means "adopt the current FID without re-registering" — so a consumer
  upgrading from `@eneris/push-receiver` doesn't have every existing FCM token rotate on
  upgrade.

Before that compare, `#refreshRegistration()` awaits `installations.whenSettled()`: a FIS
request already in flight for this app (typically `RemoteConfig` replacing a rejected
installation) is waited out, so its replacement FID is seen on this attempt rather than the
next one. `whenSettled()` never starts a request. A replacement that starts *after* the
compare is still only seen on the next attempt; closing that would need an Installations
"replaced" event, which was judged not worth it.

The 7 day renewal (`PATCH`) deviates from upstream `updateToken()` (which rethrows and keeps
the cached token) in two ways: an `HttpRequestError` 404 means the registration is gone, so a
new one is registered in the same call; a transient failure (`isTransientError`) keeps serving
the current registration, unchanged `createTime` included, so the next attempt renews again.
Any other failure still rethrows.

`#refreshRegistration()` fetches the installation (`this.#app.installations.getInstallation()`)
**only inside the branches that actually issue a request** (the subscription-options-changed
branch and the token-renewal branch) — deliberately not once up front. This means a cached,
already-valid registration lets `PushReceiver.connect()` succeed even while Firebase
Installations itself is down. Do not hoist that call back to the top of the function.

### GCM checkin self-heal (`src/lib/gcm.ts`)

Every attempt checks in with the stored `androidId`/`securityToken`. A checkin answered with
`HttpRequestError` 400 or 401 means the server no longer accepts those credentials: the stored
`gcm.registration` is cleared (written `undefined`) and a fresh checkin + register runs in the
same call (Chromium resets its whole GCM store here). The new GCM token changes the FCM
subscription endpoint, so `lib/fcm.ts` deletes the old FCM registration (same FID, works) and
registers a new token, which `PushReceiver` announces through `ON_TOKEN_CHANGE`. Any other
checkin failure keeps the stored credentials and rethrows. A checkin answer without a non-zero
android id and security token is rejected, never stored. A *login* error never clears
anything: Chromium only resets the connection there, and stale credentials surface as a
checkin 401 on the next attempt anyway, because every attempt checks in.

### `PushReceiver` connection lifecycle (`src/pushReceiver.ts`)

The attempt-token design (`Connection`, `#isCurrent(connection)`) predates this list: every
await, timer and socket/parser listener is bound to its `Connection` and does nothing once that
is not the current one. Keep every new timer and await behind that check.

- **Listener isolation.** Every event goes out through `#emit()` → `utils/emit.ts`
  `emitSafely()`: one try/catch around the whole `emit`, a throw is logged at `error`. Never
  call `this.emit` directly: the parser's `message` handler has a try/catch that closes the
  connection, and a listener throw would land there. Per-listener isolation was rejected:
  iterating `listeners()` breaks eventemitter3's `once()` removal and `context`.
- **Retry count and the reset window.** A successful `LoginResponse` saves the retry count on
  its `Connection` (`retryCountBeforeLogin`, with `loggedInAt`) and resets the receiver's count
  to 0. `#handleSocketClose()` puts the saved count back when the connection dies within
  `CONNECTION_RESET_WINDOW_MS` (10 s) of that login, before `#scheduleRetry()` increments it.
  The saved count lives on the `Connection`, never on the receiver, so `destroy()` +
  `connect()` cannot pick up a stale one.
- **Login errors.** A `LoginResponse` with a non-zero `error.code` is logged at `warn` and
  handled as a socket close (no `ON_READY`, `whenReady` stays pending, count not reset).
- **Login timeout.** `#openSocket()` starts `LOGIN_TIMEOUT_MS` (30 s); a successful login and
  `#closeConnection()` clear it; firing closes the attempt like a socket close. It spans TCP +
  TLS + login, unlike Chromium's read timeout, which starts after the login write.
- **`retryInitialConnect`** (default `false`) only decides `Connection.retry` for the attempt a
  `connect()` on an idle receiver starts.
- **`reconnect()`** keeps the retry count. Idle → `connect()`; backoff → timer cleared, attempt
  now; logged in → close, new attempt, then `ON_DISCONNECT`; an attempt before its login is
  joined, not restarted (the login timeout bounds it).
- **Token announcement.** `#openConnection()` compares the new FCM token with the in-process
  one, else with the persisted `push_receiver.announced_token`, emits
  `ON_TOKEN_CHANGE(new, old)` on a difference and only then persists the new token, so a
  listener that destroys the receiver gets the announcement again on the next start.
- **Log levels.** `#logFailure()`: `isTransientError()` → `warn`, else `error`. The retry limit,
  parser errors and listener throws stay `error`.

### `src/utils/fetch.ts` retry policy

`fetch-retry`'s own `retries` option is silently ignored whenever `retryOn` is a function
(only the array form of `retryOn` enforces it) — this library always passes a function, so
every bound has to be applied by hand inside that function:

- A **rejected** request (network error, or a malformed request, which `fetch` also rejects
  with a `TypeError` and which is indistinguishable from a real network failure here) retries
  with exponential backoff capped at `MAX_RETRY_DELAY_MS` (10 minutes), for as long as the
  caller's `signal` allows: unbounded without one. Installations always passes one (see
  `requestTimeoutMs`), RemoteConfig passes its abort + `fetchTimeout` signal.
- **Abort path.** The backoff delay is waited out inside `retryOn` with `abortableDelay()`
  (fetch-retry's own `retryDelay` is forced to 0, its bare `setTimeout` cannot be cancelled).
  An abort during the delay rejects at once with the signal's reason and clears the timer; an
  already aborted signal never reaches `fetch`. A caller's `retryDelay` still overrides the
  backoff (tests pass 0).
- A **429 or 5xx** response stops retrying after `HTTP_RETRIES` (3) attempts, so the caller
  actually gets an answer and its own failure handling (see the Installations policy above)
  runs instead of hanging forever behind an unbounded retry.

`src/utils/request.ts` is a separate, older, linear-retry helper (fixed step, fixed max
retries) used only by the GCM checkin/registration path (`lib/gcm.ts`) and `PushSender`. It
was not folded into `fetchWithRetry`; don't assume the two share behaviour.

### `src/legacyImport.ts` and `src/utils/legacy.ts` must not load `app.ts`

`importLegacyState()` is meant to run from a consumer's storage migration, including under
Jest, which cannot load `dot-prop` (ESM only) and so cannot load `app.ts`. Both modules may
only import `utils/legacy.ts`, `utils/constants.ts`, `utils/base64.ts` at runtime, plus types.
`test/legacyImport.test.js` asserts this. Mapping rules (never overwrite, Remote Config triple
all or nothing, FCM registration imported without `createTime` so it is re-created under the
imported FID, `expiresAt: 0` for the installation) are documented in
[`wiki/LegacyImport.md`](wiki/LegacyImport.md).

### `src/pushReceiverLegacy.ts` is a compatibility shim

It exists to let `@eneris/push-receiver` consumers switch without migrating their stored
credentials shape. Its `LegacyStorageAdapter` implements the current `StorageInterface` but
backs it with the old flat `Credentials` object: every read/write of
`installations.installation` and `fcm.registration` is intercepted and translated field by
field into/out of the legacy shape (`legacyInstallationToCurrent`/`currentInstallationToLegacy`,
`LegacyStorageAdapter#getCurrentFcmRegistration()`/`currentFcmToLegacy`). Two consequences
that are easy to miss:

- Any **new optional field** added to `FcmData` (`src/lib/fcm.ts`) is silently dropped when it
  passes through this adapter, because the translation is done field by field, not by passing
  the object through. If a new field's absence changes behaviour (the way a missing
  `installationFid` does, see above), that behaviour has to hold up under this shim too.
- Anything written to `installations.installation`, `fcm.registration` or `gcm.registration`
  must tolerate being cleared (`undefined`): `deleteInstallation()` in `installations.ts` writes
  `undefined` to clear the entry, `lib/gcm.ts` does on a rejected checkin, and
  `#setInstallation()`/`#setGcmRegistration()` here have to accept that.
- Keys it does not map (for example `push_receiver.announced_token`) live in its in-memory map
  only, so `ON_TOKEN_CHANGE` is in-process only for legacy consumers.

### MCS delivery does not depend on Firebase Installations

`PushReceiver`'s persistent MCS connection (`connect()`, login, heartbeat) depends only on GCM
checkin/registration (`lib/gcm.ts`, `androidId`/`securityToken`), never on Firebase
Installations. FIS only comes into play through `lib/fcm.ts`'s registration flow. A FIS outage
can therefore still allow a message-receiving connection to work (see the `refreshRegistration`
short-circuit above) — don't introduce a dependency from the MCS/login path back onto
`installations.getInstallation()`.

One narrow exception: `lib/fcm.ts` awaits `installations.whenSettled()` before its FID compare.
It never starts a request, so with no FIS request in flight it costs nothing; while one is in
flight (started by RemoteConfig, say) the attempt waits for it, at most `requestTimeoutMs`
(unbounded with `requestTimeoutMs: 0`). Its rejection is swallowed and the compare goes on.

## Vendor parity

Large parts of `installations.ts` and `utils/fetch.ts` intentionally mirror
[`firebase-js-sdk`](https://github.com/firebase/firebase-js-sdk). Where the mirroring is close
enough to matter, the code carries a `Source:` URL at the point of use; this table collects
them along with the one thing worth knowing about each: what's mirrored, and where this
library deliberately deviates.

| Area | Upstream source | Mirrors | Deviates |
|---|---|---|---|
| Heartbeat limits, payload version (`BUILD_TARGET`, `MAX_HEADER_BYTES`, `MAX_NUM_STORED_HEARTBEATS`, `HEARTBEAT_VERSION`) | [`packages/app/src/heartbeatService.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/heartbeatService.ts) | Constants and cache/header algorithm (`trigger`, `getHeader`, `extractHeartbeatsForHeader`, `countBytes`, `getEarliestHeartbeatIdx`, UTC date key) | Backed by this library's `storage` abstraction instead of IndexedDB |
| Platform logger string (`HEARTBEAT_AGENT`) | [`registerCoreComponents.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/registerCoreComponents.ts), [`platformLoggerService.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/platformLoggerService.ts) | The `fire-*/version` token format | Hand-built Node/CommonJS approximation, **not** a verbatim upstream literal |
| Heartbeat cache shape (`HeartbeatCacheEntry`) | [`packages/app/src/types.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/app/src/types.ts) | Persisted shape (`lastSentHeartbeatDate`, `heartbeats`) | Stored via `app.storage`, not IndexedDB |
| Authoritative-invalidity signal (`InstallationsRequestError`, `isInstallationInvalid`) | [`functions/common.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/functions/common.ts), [`helpers/refresh-auth-token.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/helpers/refresh-auth-token.ts) | 401/404 → installation gone, everything else transient | Self-heal (create the replacement) happens inline in the same `getInstallation()` call instead of being deferred to the next call |
| `x-firebase-client` heartbeat header attachment | [`create-installation-request.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/functions/create-installation-request.ts), [`generate-auth-token-request.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/functions/generate-auth-token-request.ts) | Attached on create + refresh, not on delete | — |
| Empty/omitted `fid` handling on create | [`create-installation-request.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/functions/create-installation-request.ts) | Server allocates a FID when the request's is omitted/empty; the requested FID is kept if the response doesn't echo one | This library additionally validates the response (`expiresIn` parsing, non-empty `fid`/`refreshToken`/token) and rejects an unusable body instead of storing it |
| MCS reset window (`CONNECTION_RESET_WINDOW_MS`) | [`google_apis/gcm/engine/connection_factory_impl.cc`](https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/connection_factory_impl.cc) `kConnectionResetWindowSecs` :44, `ShouldRestorePreviousBackoff` :48-52, restore :249-254, save at login :486-491 | 10 s window; a reset inside it restores the backoff saved at login and counts one more failure | Saved count kept per attempt (`Connection`), not per receiver |
| Login failure (`LoginResponse.error`) | [`google_apis/gcm/engine/mcs_client.cc`](https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/mcs_client.cc) :616-623 | Non-zero `error.code` = `LOGIN_FAILURE` reset, backoff keeps growing, no store reset | — |
| Login timeout (`LOGIN_TIMEOUT_MS`) | `connection_factory_impl.cc` `kReadTimeoutMs` :39 (passed :116); [`connection_handler_impl.cc`](https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/connection_handler_impl.cc) timer :57-59, reset after login write :150, `OnTimeout` :472-476 | 30 s, a timeout is a socket failure | One timer spans TCP + TLS + login; Chromium's starts after the login write |
| `reconnect()` | `connection_factory_impl.cc` network change canary :231-239, `OnConnectionChanged` :275-290; [`heartbeat_manager.cc`](https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/heartbeat_manager.cc) `OnResume` :130-142 | Bypasses the backoff without resetting it | Triggered by the consumer, not by the library; a failed `reconnect()` attempt counts towards the backoff (a Chromium canary does not); resume = new connection, not a forced heartbeat |
| GCM checkin rejection | [`components/gcm_driver/gcm_client_impl.cc`](https://chromium.googlesource.com/chromium/src/+/main/components/gcm_driver/gcm_client_impl.cc) `OnCheckinCompleted` :486-490; [`google_apis/gcm/engine/checkin_request.cc`](https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/checkin_request.cc) :248-258 | 400/401 final, stored GCM state reset | Registers again in the same call instead of after a store reset |
| GCM checkin answer validation | `checkin_request.cc` :271-275 (`kZeroIdOrToken`) | Zero/missing android id or security token = failed checkin | Thrown to the attempt (retried by PushReceiver's backoff) instead of an internal retry |
| GCM register error code (`GcmRegisterError.code`) | [`google_apis/gcm/engine/registration_request.cc`](https://chromium.googlesource.com/chromium/src/+/main/google_apis/gcm/engine/registration_request.cc) `kErrorPrefix` :46, `ParseResponse` :270-292 | Code read after `Error=` | — |
| FCM registration renewal | [`packages/messaging/src/internals/token-manager.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/messaging/src/internals/token-manager.ts) `updateToken` :157-178 | Weekly `PATCH` | Upstream rethrows every failure and keeps the cache. Here a 404 re-registers in the same call and a transient failure serves the current registration |
| FIS request bound (`requestTimeoutMs`) | [`helpers/refresh-auth-token.ts`](https://github.com/firebase/firebase-js-sdk/blob/main/packages/installations/src/helpers/refresh-auth-token.ts) :62-65 (`APP_OFFLINE`) | Upstream never retries an offline request unbounded | Retries with backoff until the timeout (default 60 s) instead of failing fast |
| `fetch-retry`'s `retryOn`-as-function bypasses its own `retries` option | [`fetch-retry` source](https://github.com/JustinBeckwith/fetch-retry), `node_modules/fetch-retry/index.js` | — (this is a `fetch-retry` behaviour note, not a firebase-js-sdk one) | Bounds applied by hand: unbounded retry on network error, 3 retries on 429/5xx (upstream `firebase-js-sdk`'s own retry logic is not mirrored here at all) |

The general deviations worth remembering across all of the above: this library validates
`expiresIn` and response bodies more strictly than upstream, self-heals inside the same call
rather than waiting for the next one, and lets network-error retries run until the caller's
signal ends them rather than capping them by count like the HTTP-status retries. The
`RemoteConfig` background retry (1 min doubling, capped at `cacheMaxAge`) is library-own
policy: firebase-js-sdk has no background fetch loop.

## Known traps

- **Tests run against `dist/`.** `test/reliability.test.js` does `require('../dist')`; a
  source change with no rebuild is invisible to `yarn test` (this is why `yarn test` runs
  `yarn build` first — don't try to skip that when iterating).
- **`deleteInstallation()` writes `undefined`.** It clears the stored key by setting it to
  `undefined`, not by removing it — any consumer-supplied storage `set()` implementation must
  tolerate being called with an `undefined` value.
- **`utils/fetch.ts` only stops for a `signal`.** Without one (for example
  `requestTimeoutMs: 0`), a request made offline still retries until it succeeds and its timer
  keeps the event loop alive. Pass a signal from any new caller that has a `destroy()` or a
  deadline.
- **`gcm.registration` can be `undefined` too**, not only `installations.installation`: a
  rejected checkin clears it (see "GCM checkin self-heal").
- **Emit through `#emit()`/`emitSafely()`.** A bare `this.emit(...)` inside `PushReceiver` or
  `RemoteConfig` reintroduces "a listener throw closes the connection / fails the fetch".
- **`src/index.ts` re-exports matter for `instanceof`.** Anything a consumer needs to run an
  `instanceof` check against (e.g. `InstallationsRequestError`) must be re-exported from
  `src/index.ts`, not just from the module that defines it.
