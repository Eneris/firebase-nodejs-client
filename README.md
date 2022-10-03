# Firebase NodeJS Client
Compact firebase client implementation for NodeJS environment

## Why do we need another module

Current official modules support only
 - Node.JS as Admin with low to none client capabilities
 - Browser only env (hard linked to `window`, `IndexedDB` and `WebWorkers`)

I needed module that I can use in any JavaScript environment. The main difference is, that you can to provide your own storage with simple get/set methods for data persistency.

Putting this public, so it can help some other projects too.
Will add more parts based on my project needs or uppon request.

## What is done / planned
 - ✅ Web Installartions
 - ⬜️ Mobile Installations
 - ✅ Remote config
 - ⬜️ Cloud Messaging
 - ⬜️ HeartBeat
 - ⬜️ TESTS - probably jest/mocha

## How to use it
```js
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
    }
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
```

### Wiki
- [`InstallationsWeb`](wiki/InstallationsWeb.md)
- [`RemoteConfig`](wiki/RemoteConfig.md)
- [`Value`](wiki/Value.md)

## Credits
 - Big thanks to authors of https://github.com/firebase/firebase-js-sdk . Most of the logic/types/infromation comes from there