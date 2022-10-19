const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { FirebaseApp, Installations, RemoteConfig } = require('../dist')

const storageFileName = path.join(__dirname, 'storage.json')

let store = {}

if (fs.existsSync(storageFileName)) {
    store = JSON.parse(fs.readFileSync(storageFileName).toString())
}

const app = new FirebaseApp({
    credentials: { /* CREDENTIALS HERE */ },
    storage: {
        get: (key) => store[key],
        set: (key, value) => {
            store[key] = value

            fs.writeFileSync(storageFileName, JSON.stringify(store, null, 2))
        }
    },
    crypto: crypto.webcrypto,
})

const remoteConfig = new RemoteConfig(app, {
    defaultConfig: {
        test: 'true'
    }
})

remoteConfig.on('fetch', () => {
    console.log('fetch')
})

remoteConfig.on('activate', () => {
    console.log('activate')
})

remoteConfig.fetchAndActivate().then(() => {
    console.log(remoteConfig.getAll())
})