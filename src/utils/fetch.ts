import fetchRetry from 'fetch-retry'
import { abortableDelay } from './abort'

// fetch-retry ignores its own `retries` option whenever `retryOn` is a function (only used
// for the array form), so every bound here is applied by hand. See AGENTS.md "utils/fetch.ts
// retry policy" for the full rationale.
const HTTP_RETRIES = 3

// Backoff cap for the unbounded network-error retry below; see AGENTS.md.
const MAX_RETRY_DELAY_MS = 10 * 60 * 1000 // in ms

type RetryDelay = number | ((attempt: number, error: Error | null, response: Response | null) => number)

export type FetchWithRetryInit = RequestInit & {
    // Overrides the backoff below; tests use 0.
    retryDelay?: RetryDelay
}

function shouldRetry(attempt: number, error: Error | null, response: Response | null): boolean {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return false

    // Rejected requests (including a malformed request, which fetch also rejects with a
    // TypeError) retry unbounded so an offline machine recovers once connectivity returns. A
    // caller that cannot wait that long passes a `signal`.
    if (error !== null) return true

    // 429/5xx are bounded so the caller's own failure handling still gets to run.
    if (response && (response.status === 429 || response.status >= 500)) {
        return attempt < HTTP_RETRIES
    }

    return false
}

function defaultRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY_MS)
}

// The global fetch is looked up per call, and an aborted signal never reaches it.
const fetchWithPolicy = fetchRetry((input: string | URL | Request, init?: RequestInit): Promise<Response> => (
    init?.signal?.aborted ? Promise.reject(init.signal.reason) : fetch(input, init)
))

// fetch-retry's own delay is a bare setTimeout that an abort cannot cancel, so the backoff is
// waited out inside retryOn instead (fetch-retry awaits a returned promise and rejects with
// its rejection). An abort, `destroy()` or a timeout signal, then ends the loop at once, with
// the signal's reason, and leaves no timer behind.
export default function fetchWithRetry(input: string | URL, init: FetchWithRetryInit = {}): Promise<Response> {
    const { retryDelay, ...requestInit } = init
    const signal = requestInit.signal

    return fetchWithPolicy(input, {
        ...requestInit,
        retryDelay: 0,
        retryOn: async (attempt, error, response) => {
            if (signal?.aborted || !shouldRetry(attempt, error, response)) return false

            const delay = typeof retryDelay === 'function'
                ? retryDelay(attempt, error, response)
                : retryDelay ?? defaultRetryDelay(attempt)

            await abortableDelay(delay, signal)

            return true
        },
    })
}
