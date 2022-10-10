# Changelog
## 0.2.0
 - `fetchAndActivate` now locks semaphore to prevent concurent fetch attempts
 - Added timer to auto fetch config when cache expires
 - Added `asConverted` on `Value` and `getAllConverted` on `RemoteConfig` which returns auto-converted values