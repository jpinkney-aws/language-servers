/**
 * uses a presigned url and files checksum to transfer data to s3 through http.
 */
export async function uploadCode(url: string, buffer: Buffer, checksumSha256: string, kmsKeyArn?: string) {
    try {
        const response = await fetch(url, {
            method: 'PUT',
            body: buffer,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Length': String(buffer.length),
                'x-amz-checksum-sha256': checksumSha256,
                ...(kmsKeyArn && {
                    'x-amz-server-side-encryption-aws-kms-key-id': kmsKeyArn,
                    'x-amz-server-side-encryption': 'aws:kms',
                }),
            },
        })

        if (!response.ok) {
            // throw new UploadCodeError(`${response.status}: ${response.statusText}`)
        }
    } catch (e: any) {
        // if (e instanceof RequestError) {
        //     switch (e.response.status) {
        //         case 403:
        //             throw new UploadURLExpired()
        //         default:
        //             throw new UploadCodeError(
        //                 e instanceof RequestError ? `${e.response.status}: ${e.response.statusText}` : 'Unknown'
        //             )
        //     }
        // }
        // throw ToolkitError.chain(e, i18n('AWS.amazonq.featureDev.error.codeGen.default'))
    }
}
