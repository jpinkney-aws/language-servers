import { CodeGenerationStatus } from '../types'
import { uploadCode } from '../../../utilities/requestUtilities'
import { v4 as uuid } from 'uuid'
import { CodeWhispererServiceToken } from '../../../codeWhispererService'
import { ZipUtilities } from '../../../utilities/zipUtilities'
import { CurrentWsFolders } from '../../../types'
import { Workspace } from '@aws/language-server-runtimes/server-interface/workspace'
import { ChatResult } from '@aws/language-server-runtimes/protocol'
import { text } from '../text'

interface SessionContext {
    conversationId: string
    client: CodeWhispererServiceToken
    workspaceRoots: string[]
    workspaceFolders: CurrentWsFolders
    message: string
    messenger: (chatItem: ChatResult) => void
    logger: (...messages: string[]) => void
}

export class CodeGenerationAction {
    private pollCount = 360
    private requestDelay = 5000

    constructor(
        private readonly workspace: Workspace,
        private readonly context: SessionContext,
        private readonly currentCodeGenerationId: number
    ) {}

    async createCodeAssist() {
        const { zipFileBuffer, zipFileChecksum } = await new ZipUtilities(this.workspace).prepareRepoData(
            this.context.workspaceRoots,
            this.context.workspaceFolders
        )
        const uploadId = await this.upload(zipFileBuffer, zipFileChecksum)
        this.context.logger('Starting code generation...')
        await this.startCodeGeneration(uploadId)
    }

    private async upload(buffer: Buffer<ArrayBufferLike>, checksum: string) {
        const uploadId = uuid()
        const { uploadUrl, kmsKeyArn } = await this.context.client.createUploadUrl({
            uploadContext: {
                taskAssistPlanningUploadContext: {
                    conversationId: this.context.conversationId,
                },
            },
            uploadId,
            contentChecksum: checksum,
            contentChecksumType: 'SHA_256',
            artifactType: 'SourceCode',
            uploadIntent: 'TASK_ASSIST_PLANNING',
            contentLength: buffer.length,
        })

        await uploadCode(uploadUrl, buffer, checksum, kmsKeyArn)
        return uploadId
    }

    private async startCodeGeneration(uploadId: string) {
        this.context.logger(
            'Starting code generation with: ' +
                this.context.message +
                ' conversation id: ' +
                this.context.conversationId
        )
        const codeGenerationId = uuid()
        await this.context.client.client
            .startTaskAssistCodeGeneration({
                codeGenerationId,
                ...(this.currentCodeGenerationId > 0 && {
                    currentCodeGenerationId: this.currentCodeGenerationId.toString(),
                }),
                conversationState: {
                    conversationId: this.context.conversationId,
                    currentMessage: {
                        userInputMessage: { content: this.context.message },
                    },
                    chatTriggerType: 'MANUAL',
                },
                workspaceState: {
                    uploadId,
                    programmingLanguage: { languageName: 'javascript' },
                },
                intent: 'DEV',
            })
            .promise()

        this.context.logger('Polling code generation...')

        // TODO this should return the files to an API that can be used to register the files in a virtual file system
        await this.pollCodegen()
    }

    private async pollCodegen() {
        let codeGenerationRemainingIterationCount = undefined
        let codeGenerationTotalIterationCount = undefined
        for (
            let pollingIteration = 0;
            pollingIteration < this.pollCount; // TODO && !this.isCancellationRequested;
            ++pollingIteration
        ) {
            const codegenResult = await this.context.client.client
                .getTaskAssistCodeGeneration({
                    codeGenerationId: this.currentCodeGenerationId.toString(),
                    conversationId: this.context.conversationId,
                })
                .promise()
            this.context.logger(codegenResult.conversationId)
            this.context.logger(codegenResult.codeGenerationStatus.status)
            codeGenerationRemainingIterationCount = codegenResult.codeGenerationRemainingIterationCount
            codeGenerationTotalIterationCount = codegenResult.codeGenerationTotalIterationCount

            switch (codegenResult.codeGenerationStatus.status as CodeGenerationStatus) {
                case CodeGenerationStatus.COMPLETE: {
                    // const { newFileContents, deletedFiles, references } =
                    //     await this.config.proxyClient.exportResultArchive(this.conversationId)
                    // const newFileInfo = registerNewFiles(
                    //     fs,
                    //     newFileContents,
                    //     this.uploadId,
                    //     workspaceFolders,
                    //     this.conversationId,
                    //     featureDevScheme
                    // )

                    return {
                        newFiles: [],
                        deletedFiles: [],
                        references: [],
                        codeGenerationRemainingIterationCount: codeGenerationRemainingIterationCount,
                        codeGenerationTotalIterationCount: codeGenerationTotalIterationCount,
                    }
                }
                case CodeGenerationStatus.PREDICT_READY:
                case CodeGenerationStatus.IN_PROGRESS: {
                    this.context.logger('ip')
                    this.context.logger(JSON.stringify(codegenResult.$response.data))
                    if (codegenResult.codeGenerationStatusDetail) {
                        this.context.messenger({
                            body:
                                text['AWS.amazonq.featureDev.pillText.generatingCode'] +
                                `\n\n${codegenResult.codeGenerationStatusDetail}`,
                        })
                    }
                    await new Promise(f => setTimeout(f, this.requestDelay))
                    break
                }
                case CodeGenerationStatus.PREDICT_FAILED:
                case CodeGenerationStatus.DEBATE_FAILED:
                case CodeGenerationStatus.FAILED: {
                    this.context.logger('Code generation failed')
                    this.context.logger(codegenResult.codeGenerationStatusDetail ?? 'unknown error')
                    switch (true) {
                        // case codegenResult.codeGenerationStatusDetail?.includes('Guardrails'): {
                        //     throw new FeatureDevServiceError(
                        //         i18n('AWS.amazonq.featureDev.error.codeGen.default'),
                        //         'GuardrailsException'
                        //     )
                        // }
                        // case codegenResult.codeGenerationStatusDetail?.includes('PromptRefusal'): {
                        //     throw new PromptRefusalException()
                        // }
                        // case codegenResult.codeGenerationStatusDetail?.includes('EmptyPatch'): {
                        //     if (codegenResult.codeGenerationStatusDetail?.includes('NO_CHANGE_REQUIRED')) {
                        //         throw new NoChangeRequiredException()
                        //     }
                        //     throw new FeatureDevServiceError(
                        //         i18n('AWS.amazonq.featureDev.error.codeGen.default'),
                        //         'EmptyPatchException'
                        //     )
                        // }
                        // case codegenResult.codeGenerationStatusDetail?.includes('Throttling'): {
                        //     throw new FeatureDevServiceError(
                        //         i18n('AWS.amazonq.featureDev.error.throttling'),
                        //         'ThrottlingException'
                        //     )
                        // }
                        default: {
                            throw new Error('Unknown code generation failure')
                            // throw new ToolkitError(i18n('AWS.amazonq.featureDev.error.codeGen.default'), {
                            //     code: 'CodeGenFailed',
                            // })
                        }
                    }
                }
                default: {
                    // const errorMessage = `Unknown status: ${codegenResult.codeGenerationStatus.status}\n`
                    // throw new ToolkitError(errorMessage, { code: 'UnknownCodeGenError' })
                }
            }
        }
        // if (!this.isCancellationRequested) {
        //     // still in progress
        //     const errorMessage = i18n('AWS.amazonq.featureDev.error.codeGen.timeout')
        //     throw new ToolkitError(errorMessage, { code: 'CodeGenTimeout' })
        // }
        return {
            newFiles: [],
            deletedFiles: [],
            references: [],
            codeGenerationRemainingIterationCount: codeGenerationRemainingIterationCount,
            codeGenerationTotalIterationCount: codeGenerationTotalIterationCount,
        }
    }
}
