import axios, { AxiosError, AxiosInstance } from '../utils/axios'
import generateFid from '../functions/generateFid'
import { StorageInterface } from '../utils/storage'
import FirebaseApp from '../lib/app'

const AUTH_VERSION = 'FIS_v2'
const SDK_VERSION = 'w:0.5.12'

export interface AuthToken {
    readonly token: string
    readonly creationTime: number
    readonly expiresIn: number
}

export interface InstallationEntry {
    readonly fid: string
    readonly refreshToken: string
    readonly authToken: AuthToken
}

export interface InstallationStorageInterface {
    installation: InstallationEntry
}

export default class WebInstallations {
    private readonly app: FirebaseApp
    private readonly request: AxiosInstance
    private readonly storage: StorageInterface<InstallationStorageInterface>

    constructor(app: FirebaseApp) {
        this.app = app
        this.request = axios.create({
            baseURL: `https://firebaseinstallations.googleapis.com/v1/projects/${this.app.credentials.projectId}/installations`,
            headers: {
                'Content-Type': 'application/json',
                'Accept-Charset': 'application/json',
                'x-goog-api-key': this.app.credentials.apiKey,
            },
        })

        const storagePrefix = `installations.${this.app.credentials.projectId}.${this.app.credentials.appId}.`

        this.storage = {
            get: (key) => this.app.storage.get(storagePrefix + key),
            set: (key, value) => this.app.storage.set(storagePrefix + key, value),
        } as StorageInterface<InstallationStorageInterface>
    }

    static convertExpire(value: string) {
        return Number(value.replace('s', '000'))
    }

    static isInstallationExpired(installation: InstallationEntry) {
        return installation.authToken.creationTime + installation.authToken.expiresIn <= Date.now()
    }

    /**
     * API
     */

    private getHeaders(options: { auth?: InstallationEntry, heartbeat?: boolean }): Record<string, string> {
        const headers: Record<string, string> = {}

        if (options.auth) {
            headers.Authorization = `${AUTH_VERSION} ${options.auth.refreshToken}`
        }

        if (options.heartbeat) {
            // TODO: implement heartbeat
        }

        return headers
    }

    private async create(): Promise<InstallationEntry> {
        // TODO: HeartBeat
        const data = await this.request.post('', {
            fid: generateFid(),
            authVersion: AUTH_VERSION,
            appId: this.app.credentials.appId,
            sdkVersion: SDK_VERSION,
        }, {
            headers: this.getHeaders({ heartbeat: true }),
        }).then(({ data }) => data)

        const newInstallation: InstallationEntry = {
            ...data,
            authToken: {
                ...data.authToken,
                token: data.authToken.token,
                expiresIn: WebInstallations.convertExpire(data.authToken.expiresIn),
            },
        }

        this.storage.set('installation', newInstallation)

        return newInstallation
    }

    private async refresh(fid: string): Promise<InstallationEntry> {
        const installation = this.storage.get('installation')

        if (!installation) {
            throw new Error(`Installation with fid '${fid}' not found`)
        }

        // TODO: HeartBeat
        const newToken = await this.request.post<{ token: string, expiresIn: string }>(`/${installation.fid}/authTokens:generate`, {
            installation: {
                sdkVersion: SDK_VERSION,
                appId: this.app.credentials.appId,
            },
        }, {
            headers: this.getHeaders({ auth: installation, heartbeat: true }),
        })
            .then(({ data }) => data)
            .catch((err: AxiosError) => {
                console.debug(err)
                throw new Error(`Installation refresh failed with status ${err.response.status} '${err.response.statusText}'`)
            })

        const newInstallation: InstallationEntry = {
            ...installation,
            authToken: {
                ...installation.authToken,
                token: newToken.token,
                expiresIn: WebInstallations.convertExpire(newToken.expiresIn),
            },
        }

        this.storage.set('installation', newInstallation)

        return newInstallation
    }

    private async delete(fid: string): Promise<void> {
        const installation = this.storage.get('installation')

        if (!installation) {
            throw new Error(`Installation with fid '${fid}' not found`)
        }

        await this.request.delete(`/${installation.fid}`, {
            headers: this.getHeaders({ auth: installation }),
        })
            .then(() => Promise.resolve())
            .catch((err: AxiosError) => {
                console.debug(err)
                throw new Error(`Installation refresh failed with status ${err.response.status} '${err.response.statusText}'`)
            })
    }

    /**
     * Methods
     */

    async getInstallation(): Promise<InstallationEntry> {
        let installation: InstallationEntry = this.storage.get('installation')

        // Does not exist
        if (!installation) {
            installation = await this.create()
        }

        // Expired
        if (WebInstallations.isInstallationExpired(installation)) {
            installation = await this.refresh(installation.fid)
        }

        return installation
    }

    async deleteInstalation(): Promise<void> {
        const installation: InstallationEntry = this.storage.get('installation')

        if (installation) {
            return this.delete(installation.fid)
        }
    }
}
