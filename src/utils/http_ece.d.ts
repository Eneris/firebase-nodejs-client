declare module 'http_ece' {
    interface Options {
        version?: string
        authSecret?: string
        dh?: string
        privateKey?: unknown
        salt?: string
        [key: string]: unknown
    }
    function decrypt(buffer: Buffer, options: Options): Buffer
    function encrypt(buffer: Buffer, options: Options): Buffer
    const _exports: { decrypt: typeof decrypt; encrypt: typeof encrypt }
    export = _exports
}
