import { Features } from '../../types'
import { ChatSessionManagementService } from '../../chat/chatSessionManagementService'
import { TelemetryService } from '../../telemetryService'
import { BaseController } from '../baseController'
import {
    ChatParams,
    CancellationToken,
    ChatResult,
    ResponseError,
    ErrorCodes,
    chatRequestType,
    WorkspaceFolder,
} from '@aws/language-server-runtimes/protocol'
import { isNullish } from '../../utils'
import { CodeWhispererServiceToken } from '../../codeWhispererService'
import { ChatSessionService } from '../../chat/chatSessionService'
import { CodeGenerationAction } from './session/sessionState'

export interface SessionContext {
    currentCodeGeneration: number
}

export class FeatureDevController extends BaseController<SessionContext> {
    #client: CodeWhispererServiceToken

    constructor(
        codewhispererServiceToken: CodeWhispererServiceToken,
        chatSessionManagementService: ChatSessionManagementService<SessionContext>,
        features: Features,
        telemetryService: TelemetryService
    ) {
        super(chatSessionManagementService, features, telemetryService)
        this.#client = codewhispererServiceToken
    }

    async onChatPrompt(params: ChatParams, token: CancellationToken) {
        const sessionResult = this.chatSessionManagementService.getSession(params.tabId)

        const { data: session, success } = sessionResult
        if (!success) {
            return new ResponseError<ChatResult>(ErrorCodes.InternalError, sessionResult.error)
        }

        token.onCancellationRequested(() => {
            this.log('cancellation requested')
            session.abortRequest()
        })

        const resultToken = params.partialResultToken
        if (isNullish(resultToken)) {
            throw new Error('pls no null')
        }

        this.log('generating conversation id')

        const conversationId = sessionResult.data.conversationId ?? (await this.#createConversationId(session))
        session.conversationId = conversationId

        this.log('finishing getting the conversation id')

        await this.#onCodeGeneration(params.prompt.command ?? '', resultToken, session)

        const chatResult: ChatResult = {}
        return chatResult
    }

    async #createConversationId(session: ChatSessionService<SessionContext>) {
        const { conversationId } = await this.#client.client.createTaskAssistConversation().promise()

        session.state = { currentCodeGeneration: 0 }

        // TODO
        // await this.#client.sendTelemetryEvent(conversationId) // send the event only once per conversation.
        // do the uploading etc here
        return conversationId
    }

    async #onCodeGeneration(message: string, token: string | number, session: ChatSessionService<SessionContext>) {
        if (!session.conversationId) {
            throw new Error('Things are not set')
        }

        const messenger = (chatItem: ChatResult) => {
            this.features.lsp.sendProgress(chatRequestType, token, chatItem)
        }
        messenger({
            body: undefined,
        })

        const currentGeneration = session.state.currentCodeGeneration
        const workspaceFolder = await this.getWorkspaceFolder()
        this.log(`workspace folder: ${workspaceFolder.uri}`)
        await new CodeGenerationAction(
            this.features.workspace,
            {
                client: this.#client,
                conversationId: session.conversationId,
                message,
                // TODO figure out how to get workspace folder properly
                workspaceFolders: [workspaceFolder],
                workspaceRoots: [workspaceFolder.uri],
                messenger: messenger,
                logger: this.log.bind(this),
            },
            currentGeneration
        ).createCodeAssist()

        session.state.currentCodeGeneration = currentGeneration + 1
    }

    // hack to find all workspace folders
    private async getWorkspaceFolder() {
        const foo = await this.features.workspace.getAllTextDocuments()
        const folder = this.features.workspace.getWorkspaceFolder(foo[0].uri)
        if (isNullish(folder)) {
            throw new Error('no workspace folder')
        }
        return folder
    }
}
