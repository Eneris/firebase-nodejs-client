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
