# Changelog
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