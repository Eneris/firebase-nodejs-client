export interface StorageInterface<T = Record<string, any>> {
    get<K extends keyof T>(key: K): T[K]
    set<K extends keyof T>(key: K, value: T[K]): void
}

export default class MemoryStorage<T = Record<string, any>> implements StorageInterface<T> {
    private data: T

    get(key) {
        return this.data[key]
    }

    set(key, value) {
        this.data[key] = value
    }
}
