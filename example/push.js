const {
    FirebaseApp,
    PushReceiver,
    PushSender,
} = require('../dist');

const crypto = require('crypto')
const { default: Conf } = require('@eneris/conf')

const main = async () => {
    const storage = new Conf({
        cwd: __dirname,
        configName: 'storage',
        fileExtension: 'json',
        serialize: (data) => JSON.stringify(data, null, 2),
        deserialize: JSON.parse,
    })

    const app = new FirebaseApp({
        credentials: {
            // Insert Firebase config here
        },
        config: {
            bundleId: 'receiver.push.com',
            vapidKey: '',
        },
        storage,
        crypto,
    });

    const client = new PushReceiver(app)

    await client.connect();

    if (!client.fcmToken) {
        throw new Error('FCM token was not generated')
    }

    console.log('FCM token:', client.fcmToken)

    client.onNotification((data) => {
        console.log('onNotification', data);
    });

    const sender = new PushSender({
        // Insert Firebase service account JSON here
    });

    await new Promise((res) => setTimeout(res, 2000))

    await sender.testMessage(client.fcmToken);

    await new Promise((res) => setTimeout(res, 2000))

    await sender.testMessage(client.fcmToken);

    await new Promise((res) => setTimeout(res, 2000))
}

main().catch((err) => {
    console.error('Error in main:', err);
    process.exit(1);
})
