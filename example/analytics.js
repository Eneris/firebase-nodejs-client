const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Analytics, FirebaseApp, Installations } = require('../dist/index')

const storageFileName = path.join(__dirname, 'storage.json')

let store = fs.existsSync(storageFileName)
    ? JSON.parse(fs.readFileSync(storageFileName, 'utf8'))
    : {}

const app = new FirebaseApp({
    credentials: {
        // Insert Firebase config here
    },
    storage: {
        get: (key) => store[key],
        set: (key, value) => {
            store[key] = value

            fs.writeFileSync(storageFileName, JSON.stringify(store, null, 2))
        }
    },
    crypto: crypto.webcrypto,
})

const installations = new Installations(app)

const analytics = new Analytics({
    app,
    installations,
    debug: true,
})

analytics.logEvent('TEST').then(() => {
    console.log('Event sent')
}).catch((err) => {
    console.error('Failed to send event:', err)
})
