import crypto from 'crypto'

const VALID_FID_PATTERN = /^[cdef][\w-]{21}$/
const INVALID_FID = ''

function bufferToBase64UrlSafe(array) {
    // function bufferToBase64UrlSafe(array: Uint8Array): string {
    const b64 = Buffer.from(array).toString('base64')
    return b64.replace(/\+/g, '-').replace(/\//g, '_')
}

function encode(fidByteArray) {
// function encode(fidByteArray: Uint8Array): string {
    const b64String = bufferToBase64UrlSafe(fidByteArray)

    // Remove the 23rd character that was added because of the extra 4 bits at the
    // end of our 17 byte array, and the '=' padding.
    return b64String.substring(0, 22)
}

export default function generateFid() {
// function generateFid(): string {
    try {
        // A valid FID has exactly 22 base64 characters, which is 132 bits, or 16.5
        // bytes. our implementation generates a 17 byte array instead.
        const fidByteArray = new Uint8Array(17)
        crypto.getRandomValues(fidByteArray)

        // Replace the first 4 random bits with the constant FID header of 0b0111.
        fidByteArray[0] = 0b01110000 + (fidByteArray[0] % 0b00010000)

        const fid = encode(fidByteArray)

        return VALID_FID_PATTERN.test(fid) ? fid : INVALID_FID
    } catch(err) {
        console.error(err)
        // FID generation errored
        return INVALID_FID
    }
}
