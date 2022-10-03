import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'

const injectRetry = (context) => {
    axiosRetry(context, {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
    })
}

injectRetry(axios)

const orgCreate = axios.create

axios.create = function (config): AxiosInstance {
    const result = orgCreate.call(this, config) as AxiosInstance

    injectRetry(result)

    return result
}

export * from 'axios'

export default axios
