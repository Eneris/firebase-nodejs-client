import fetchRetry from 'fetch-retry'

// fetch-retry ignores its own `retries` option whenever `retryOn` is a function (only used
// for the array form), so every bound here is applied by hand. See AGENTS.md "utils/fetch.ts
// retry policy" for the full rationale.
const HTTP_RETRIES = 3

// Backoff cap for the unbounded network-error retry below; see AGENTS.md.
const MAX_RETRY_DELAY_MS = 10 * 60 * 1000 // in ms

export default fetchRetry(fetch, {
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY_MS),
    retryOn: (attempt, error, response) => {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return false

        // Rejected requests (including a malformed request, which fetch also rejects with a
        // TypeError) retry unbounded so an offline machine recovers once connectivity returns.
        if (error !== null) return true

        // 429/5xx are bounded so the caller's own failure handling still gets to run.
        if (response && (response.status === 429 || response.status >= 500)) {
            return attempt < HTTP_RETRIES
        }

        return false
    },
})
