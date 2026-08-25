import delay from './timeout'

// In seconds
const MAX_RETRY_TIMEOUT = 15

// Step in seconds
const RETRY_STEP = 5

export default function requestWithRety(url: string, options?: globalThis.RequestInit, maxRetries = 3): Promise<Response> {
    return retry(0, url, options, maxRetries)
}

async function retry(retryCount = 0, url: string, options?: globalThis.RequestInit, maxRetries = 3): Promise<Response> {
    let response: Response

    try {
        response = await fetch(url, options)
    } catch (error) {
        if (retryCount >= maxRetries) {
            throw error
        }

        await delay(10_000)
        return retry(retryCount + 1, url, options, maxRetries)
    }

    if (response.ok) {
        return response
    }

    const isRetryable = response.status === 429 || response.status >= 500

    if (!isRetryable || retryCount >= maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }

    const timeout = Math.min(retryCount * RETRY_STEP, MAX_RETRY_TIMEOUT)
    await delay(timeout * 1000)

    return retry(retryCount + 1, url, options, maxRetries)
}

export const getEndpoint = (projectId: string, baseUrl: string, path = '') => (
    `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}projects/${projectId}/${path}`
)
