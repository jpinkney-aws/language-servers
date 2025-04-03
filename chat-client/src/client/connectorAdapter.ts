import { CodeSelectionType, MynahUI, MynahUIProps, ReferenceTrackerInformation } from '@aws/mynah-ui'
import { Connector } from './connector'

export const connectorAdapter = (
    mynahUiProps: MynahUIProps,
    mynahUIRef: { mynahUI: MynahUI | undefined },
    connector: Connector,
    ideApiPostMessage: (msg: any) => void
): MynahUIProps => {
    const ideConnector = connector.createIdeConnector(mynahUIRef, ideApiPostMessage)

    const connectorMynahUiProps: MynahUIProps = {
        ...mynahUiProps,
        onReady() {
            // both flare and vscode set uiReady states that are required
            mynahUiProps.onReady?.()
            ideConnector.mynahUIProps.onReady()
        },
        onTabAdd(tabId, eventId) {
            /**
             * We require all tabs to be in tabs storage, since vscode extension chat doesn't
             * handle the chat add event
             */
            mynahUiProps.onTabAdd?.(tabId, eventId)
            ideConnector.mynahUIProps.onTabAdd(tabId, eventId)
        },
        onTabRemove(tabId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.onTabRemove(tabId)
                return
            }

            mynahUiProps.onTabRemove?.(tabId)
        },
        onTabChange(tabId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.onTabChange(tabId)
                return
            }

            mynahUiProps.onTabChange?.(tabId)
        },
        onStopChatResponse(tabId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.onStopChatResponse(tabId)
                return
            }

            mynahUiProps.onStopChatResponse?.(tabId)
        },
        onChatPrompt(tabId, prompt, eventId) {
            if (
                ['/dev', '/review', '/transform', '/test', '/doc'].includes(prompt.command?.trim() ?? '') ||
                connector.isSupportedTab(tabId)
            ) {
                ideConnector.mynahUIProps.onChatPrompt(tabId, prompt, eventId)
                return
            }

            mynahUiProps.onChatPrompt?.(tabId, prompt, eventId)
        },
        onQuickCommandGroupActionClick(tabId, action, eventId) {
            if (connector.isSupportedTab(tabId)) {
                return ideConnector.mynahUIProps.onQuickCommandGroupActionClick(tabId, action, eventId)
            }

            return mynahUiProps.onQuickCommandGroupActionClick?.(tabId, action, eventId)
        },
        onContextSelected(contextItem, tabId, eventId) {
            if (connector.isSupportedTab(tabId)) {
                return ideConnector.mynahUIProps.onContextSelected(contextItem, tabId, eventId)
            }

            return mynahUiProps.onContextSelected?.(contextItem, tabId, eventId)
        },
        onVote(tabId, messageId, vote, eventId) {
            if (connector.isSupportedTab(tabId)) {
                return ideConnector.mynahUIProps.onVote(tabId, messageId, vote, eventId)
            }

            return mynahUiProps.onVote?.(tabId, messageId, vote, eventId)
        },
        onInBodyButtonClicked(tabId, messageId, action, eventId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onCustomFormAction(tabId, messageId, action, eventId)
                return
            }

            mynahUiProps.onInBodyButtonClicked?.(tabId, messageId, action, eventId)
        },
        onCustomFormAction(tabId, action, eventId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onCustomFormAction(tabId, undefined, action, eventId)
                return
            }

            mynahUiProps.onCustomFormAction?.(tabId, action, eventId)
        },
        onFormTextualItemKeyPress: (
            event: KeyboardEvent,
            formData: Record<string, string>,
            itemId: string,
            tabId: string,
            eventId?: string
        ) => {
            if (connector.isSupportedTab(tabId)) {
                return ideConnector.mynahUIProps.onFormTextualItemKeyPress(event, formData, itemId, tabId, eventId)
            }
            return mynahUiProps.onFormTextualItemKeyPress?.(event, formData, itemId, tabId, eventId)
        },
        onChatPromptProgressActionButtonClicked: (tabID, action) => {
            if (connector.isSupportedTab(tabID)) {
                ideConnector.mynahUIProps.onCustomFormAction(tabID, undefined, action)
            }

            mynahUiProps.onChatPromptProgressActionButtonClicked?.(tabID, action)
        },
        onSendFeedback: (tabId, feedbackPayload) => {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onSendFeedback(tabId, feedbackPayload)
                return
            }

            mynahUiProps.onSendFeedback?.(tabId, feedbackPayload)
        },
        onCodeInsertToCursorPosition: (
            tabId,
            messageId,
            code,
            type,
            referenceTrackerInfo,
            eventId,
            codeBlockIndex,
            totalCodeBlocks
        ) => {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onCodeInsertToCursorPosition(
                    tabId,
                    messageId,
                    code,
                    type,
                    referenceTrackerInfo,
                    eventId,
                    codeBlockIndex,
                    totalCodeBlocks
                )
                return
            }

            mynahUiProps.onCodeInsertToCursorPosition?.(
                tabId,
                messageId,
                code,
                type,
                referenceTrackerInfo,
                eventId,
                codeBlockIndex,
                totalCodeBlocks
            )
        },
        onCodeBlockActionClicked: (
            tabId: string,
            messageId: string,
            actionId: string,
            data?: string,
            code?: string,
            type?: CodeSelectionType,
            referenceTrackerInformation?: ReferenceTrackerInformation[],
            eventId?: string,
            codeBlockIndex?: number,
            totalCodeBlocks?: number
        ) => {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onCodeBlockActionClicked(
                    tabId,
                    messageId,
                    actionId,
                    data,
                    code,
                    type,
                    referenceTrackerInformation,
                    eventId,
                    codeBlockIndex,
                    totalCodeBlocks
                )
                return
            }
            mynahUiProps.onCodeBlockActionClicked?.(
                tabId,
                messageId,
                actionId,
                data,
                code,
                type,
                referenceTrackerInformation,
                eventId,
                codeBlockIndex,
                totalCodeBlocks
            )
        },
        onCopyCodeToClipboard: (
            tabId,
            messageId,
            code,
            type,
            referenceTrackerInfo,
            eventId,
            codeBlockIndex,
            totalCodeBlocks
        ) => {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onCopyCodeToClipboard(
                    tabId,
                    messageId,
                    code,
                    type,
                    referenceTrackerInfo,
                    eventId,
                    codeBlockIndex,
                    totalCodeBlocks
                )
                return
            }

            mynahUiProps.onCopyCodeToClipboard?.(
                tabId,
                messageId,
                code,
                type,
                referenceTrackerInfo,
                eventId,
                codeBlockIndex,
                totalCodeBlocks
            )
        },
        onChatItemEngagement(tabId, messageId, engagement) {
            if (connector.isSupportedTab(tabId)) {
                return ideConnector.mynahUIProps.onChatItemEngagement(tabId, messageId, engagement)
            }

            return mynahUiProps.onChatItemEngagement?.(tabId, messageId, engagement)
        },
        onSourceLinkClick(tabId, messageId, link, mouseEvent, eventId) {
            if (connector.isSupportedTab(tabId)) {
                mouseEvent?.preventDefault()
                mouseEvent?.stopPropagation()
                mouseEvent?.stopImmediatePropagation()
                ideConnector.mynahUIProps.onSourceLinkClick(tabId, messageId, link, eventId)
                return
            }

            mynahUiProps.onSourceLinkClick?.(tabId, messageId, link, mouseEvent, eventId)
        },
        onLinkClick(tabId, messageId, link, mouseEvent) {
            if (connector.isSupportedTab(tabId)) {
                mouseEvent?.preventDefault()
                mouseEvent?.stopPropagation()
                mouseEvent?.stopImmediatePropagation()
                ideConnector.mynahUIProps.onResponseBodyLinkClick(tabId, messageId, link)
                return
            }

            mynahUiProps.onLinkClick?.(tabId, messageId, link, mouseEvent)
        },
        onFormLinkClick(link, mouseEvent) {
            /**
             * this doesn't expose a tab so we can't differentiate between flare/vscode calls.
             * However, flare doesn't implement this right now so if its called we just assume
             * its by vscode
             */
            mouseEvent?.preventDefault()
            mouseEvent?.stopPropagation()
            mouseEvent?.stopImmediatePropagation()
            ideConnector.mynahUIProps.onLinkClick(link)
        },
        onFollowUpClicked(tabId, messageId, followUp, eventId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onFollowUpClicked(tabId, messageId, followUp, eventId)
                return
            }
            mynahUiProps.onFollowUpClicked?.(tabId, messageId, followUp, eventId)
        },
        onFileActionClick(tabId, messageId, filePath, actionName, eventId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onFileActionClick(tabId, messageId, filePath, actionName, eventId)
                return
            }
            mynahUiProps.onFileActionClick?.(tabId, messageId, filePath, actionName, eventId)
        },
        onFileClick(tabId, filePath, deleted, messageId, eventId) {
            if (connector.isSupportedTab(tabId)) {
                ideConnector.mynahUIProps.onFileClick(tabId, filePath, deleted, messageId, eventId)
                return
            }

            mynahUiProps.onFileClick?.(tabId, filePath, deleted, messageId, eventId)
        },
    }

    return connectorMynahUiProps
}
