import axios, { AxiosError, AxiosInstance } from '../utils/axios'
import { StorageInterface } from '../utils/storage'
import FirebaseApp from '../lib/app'

const AUTH_VERSION = 'FIS_v2'
const SDK_VERSION = 'w:0.5.12'
const VALID_FID_PATTERN = /^[cdef][\w-]{21}$/
const INVALID_FID = ''

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

    private generateFid(): string {
        try {
            // A valid FID has exactly 22 base64 characters, which is 132 bits, or 16.5
            // bytes. our implementation generates a 17 byte array instead.
            const fidByteArray = new Uint8Array(17)
            crypto.getRandomValues(fidByteArray)
    
            // Replace the first 4 random bits with the constant FID header of 0b0111.
            fidByteArray[0] = 0b01110000 + (fidByteArray[0] % 0b00010000)

            const b64 = Buffer.from(fidByteArray).toString('base64')
            const b64String = b64.replace(/\+/g, '-').replace(/\//g, '_')

            // Remove the 23rd character that was added because of the extra 4 bits at the
            // end of our 17 byte array, and the '=' padding.
            const fid = b64String.substring(0, 22)

            return VALID_FID_PATTERN.test(fid) ? fid : INVALID_FID
        } catch(err) {
            this.app.logger.error(err)
            // FID generation errored
            return INVALID_FID
        }
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
            fid: this.generateFid(),
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
                this.app.logger.debug(err)
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
                this.app.logger.debug(err)
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
