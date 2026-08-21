# class `PushSender`

Sends messages through the FCM HTTP v1 API. It signs a JWT from your service account and caches the resulting OAuth access token until it expires.

Takes the service account JSON as its only constructor argument - `project_id`, `private_key` and `client_email` are the fields actually used.

## Methods
### `send`
- Sends `{ title, body }` as a notification to a single FCM token
- Throws when the API responds with a failure

### `testMessage`
- Sends a predefined test notification, useful for verifying a [`PushReceiver`](PushReceiver.md) setup

## Example
```js
const { PushSender } = require('@eneris/firebase-nodejs-client')

const sender = new PushSender({ /* SERVICE ACCOUNT JSON HERE */ })

await sender.send({ title: 'Hello', body: 'World' }, fcmToken)
await sender.testMessage(fcmToken)
```

See also [`example/push.js`](../example/push.js).
