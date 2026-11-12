import type EventEmitter from 'eventemitter3'
import type { Logger } from '../app'

// Emits on behalf of the library, so a listener that throws cannot reach the library's own
// control flow (closing the MCS socket, failing a fetch, skipping a write). The throw is
// logged instead.
//
// The whole emit sits in one try/catch, the Node EventEmitter semantics: a throwing listener
// still stops the listeners after it for that one emit. Calling each listener separately would
// need eventemitter3's private `_events` to keep `once()` removal and `context` working.
// A listener's returned promise is not awaited: listeners own their async rejections.
export function emitSafely<
    EventTypes extends EventEmitter.ValidEventTypes,
    T extends EventEmitter.EventNames<EventTypes>,
>(
    emitter: EventEmitter<EventTypes>,
    logger: Pick<Logger, 'error'>,
    event: T,
    ...args: EventEmitter.EventArgs<EventTypes, T>
): void {
    try {
        emitter.emit(event, ...args)
    } catch (error) {
        logger.error(new Error(`${String(event)} listener threw`, { cause: error }))
    }
}
