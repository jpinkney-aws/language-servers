import { ChatPrompt, MynahUI } from '@aws/mynah-ui'

export interface Connector {
    mynahUI?: MynahUI
    createIdeConnector(mynahUIRef: { mynahUI: MynahUI | undefined }, connectorClientApi: (msg: any) => void): any // TODO: return type
    isSupportedTab(tabId: string): boolean
    handleMessageReceive(message: MessageEvent): void
    handleQuickAction(prompt: ChatPrompt, tabId: string, eventId: string | undefined): void
}
