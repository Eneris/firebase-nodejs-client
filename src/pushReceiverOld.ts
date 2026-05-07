import FirebaseApp from './app'
import PushReceiverRaw from './pushReceiver'
import type { ClientConfig } from './lib/types'

interface PushReceiverConfig extends Omit<ClientConfig, 'credentials'> {}

class PushReceiver extends PushReceiverRaw {
    constructor(app: FirebaseApp, config: PushReceiverConfig) {
        super(app, config)
    }
}

export default PushReceiver;