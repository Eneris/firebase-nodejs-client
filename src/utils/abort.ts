// Waits that end early, with the signal's reason, once the signal aborts. Nothing is left
// running afterwards: the timer is cleared and the listener removed either way.

export function abortableDelay(ms: number, signal?: AbortSignal | null): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason)
            return
        }

        const onAbort = () => {
            clearTimeout(timer)
            reject(signal!.reason)
        }

        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort)
            resolve()
        }, ms)

        signal?.addEventListener('abort', onAbort, { once: true })
    })
}

// Settles with `promise`, or rejects once `signal` aborts, whichever comes first. The promise
// itself is not cancelled, so one that other callers share (a deduplicated request) carries on
// for them.
export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) {
        return Promise.reject(signal.reason)
    }

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason)

        signal.addEventListener('abort', onAbort, { once: true })

        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
    })
}
