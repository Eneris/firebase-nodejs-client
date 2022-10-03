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
const { FirebaseApp, RemoteConfig } = require('../dist')

const store = {}

const app = new FirebaseApp({
    credentials: {
        apiKey: '',
        authDomain: '',
        databaseURL: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: '',
    },
    storage: {
        get: (key) => {
            console.log('get', key)
            store[key]
        },
        set: (key, value) => {
            console.log('set', key)
            store[key] = value
        }
    }
})

const remoteConfig = new RemoteConfig(app, {
    defaultConfig: {
        test: 'true'
    }
})

console.log('test', remoteConfig.getValue('test').asBoolean())

```

### Wiki
- [`InstallationsWeb`](wiki/InstallationsWeb.md)
- [`RemoteConfig`](wiki/RemoteConfig.md)

## Credits
 - Big thanks to authors of https://github.com/firebase/firebase-js-sdk . Most of the logic/types/infromation comes from there