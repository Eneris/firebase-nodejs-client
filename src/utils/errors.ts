// Error types that carry what callers need to decide between "retry later" and "this will
// never work", plus the one classifier every log-level and self-heal decision goes through.
// Re-exported from src/index.ts so consumers can run `instanceof` against them.

// A non-ok HTTP response. The message keeps the `Request failed: <status> <text>` shape the
// plain Error it replaces had, so existing message matching still works.
export class HttpRequestError extends Error {
    readonly status: number
    readonly statusText: string

    constructor(status: number, statusText: string, message = `Request failed: ${status} ${statusText}`) {
        super(message)
        this.name = 'HttpRequestError'
        this.status = status
        this.statusText = statusText
    }
}

// Carries a machine-readable status so callers can tell an authoritative FIS rejection apart
// from a transient one; see AGENTS.md "Firebase Installations failure policy".
export class InstallationsRequestError extends Error {
    readonly status: number

    constructor(context: string, response: Response) {
        super(`${context} failed with status ${response.status} '${response.statusText}'`)
        this.name = 'InstallationsRequestError'
        this.status = response.status
    }
}

// GCM register3 answers 200 with an `Error=<CODE>` body; `code` is that CODE.
export class GcmRegisterError extends Error {
    readonly code: string

    constructor(message: string, code: string) {
        super(message)
        this.name = 'GcmRegisterError'
        this.code = code
    }
}

// Node system error codes for a network that is down, flaky or not there yet.
const TRANSIENT_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETDOWN',
    'ENETUNREACH',
    'ENOTFOUND',
    'EPIPE',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_SOCKET',
])

function hasTransientCode(value: unknown): boolean {
    const code = (value as { code?: unknown } | null | undefined)?.code

    return typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code)
}

function isTransientStatus(status: number): boolean {
    return status === 429 || status >= 500
}

// True for a failure that says nothing about the request itself and is expected to go away on
// its own: no network, a timeout or abort, a 429 or a 5xx. Such failures are logged at warn
// and never discard stored state. Everything else (a 4xx, a protocol or programming error) is
// treated as permanent.
export function isTransientError(error: unknown): boolean {
    // DOMException (AbortSignal's AbortError/TimeoutError) is an Error in Node.
    if (!(error instanceof Error)) {
        return false
    }

    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return true
    }

    if (error instanceof HttpRequestError || error instanceof InstallationsRequestError) {
        return isTransientStatus(error.status)
    }

    if (hasTransientCode(error) || hasTransientCode(error.cause)) {
        return true
    }

    // undici rejects every network-level failure with this TypeError; the system error, when
    // there is one, sits in `cause` (handled above). utils/request.ts rethrows it as is.
    return error instanceof TypeError && error.message === 'fetch failed'
}
