import fetchRetry from 'fetch-retry'

export default fetchRetry(fetch, {
    retries: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000),
    retryOn: (attempt, error, response) => {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return false

        // Retry on network errors
        if (error !== null) return true
        
        // Retry on rate limit or server errors
        if (response && (response.status === 429 || response.status >= 500)) {
            return true
        }
        
        return false
    },
})
