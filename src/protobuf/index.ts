import Long from 'long'
import * as $protobuf from 'protobufjs/minimal'
import * as Protos from './protos.js'

$protobuf.util.Long = Long as any
$protobuf.configure()

export default Protos
