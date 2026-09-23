import FirebaseApp from './app'
import Installations, { InstallationsRequestError } from './installations'
import RemoteConfig from './remoteConfig'
import Analytics from './analytics'
import PushReceiver from './pushReceiver'
import PushReceiverLegacy from './pushReceiverLegacy'

export default RemoteConfig;

export {
    FirebaseApp,
    Installations,
    InstallationsRequestError,
    RemoteConfig,
    Analytics,
    PushReceiver,
    PushReceiverLegacy,
}
