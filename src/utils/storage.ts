export interface StorageInterface {
    get<T>(key: string): T
    set(key: string, value: any): this
}

export default class MemoryStorage<T = Record<string, any>> implements StorageInterface {
    private data: T

    get(key) {
        return this.data[key]
    }

    set(key, value) {
        this.data[key] = value
        return this
    }
}
