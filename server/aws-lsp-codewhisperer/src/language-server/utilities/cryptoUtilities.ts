export async function createHash(algorithm: string, contents: Buffer, digest: string): Promise<string> {
    // browser
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(contents.toString('utf-8'))
        const hashBuffer = await crypto.subtle.digest(algorithm, msgBuffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
    // node
    else {
        // eslint-disable-next-line import/no-nodejs-modules -- only used on node
        const crypto = require('crypto')
        return crypto.createHash(algorithm).update(contents).digest(digest)
    }
}
