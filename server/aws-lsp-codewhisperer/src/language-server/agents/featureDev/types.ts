/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatResult } from '@aws/language-server-runtimes/server-interface/lsp'
import * as vscode from 'vscode'

export enum CodeGenerationStatus {
    COMPLETE = 'Complete',
    PREDICT_READY = 'predict-ready',
    IN_PROGRESS = 'InProgress',
    PREDICT_FAILED = 'predict-failed',
    DEBATE_FAILED = 'debate-failed',
    FAILED = 'Failed',
}

// export type NewFileZipContents = { zipFilePath: string; fileContent: string }
// export type NewFileInfo = DiffTreeFileInfo &
//     NewFileZipContents & {
//         virtualMemoryUri: vscode.Uri
//         workspaceFolder: vscode.WorkspaceFolder
//     }

// export type DeletedFileInfo = DiffTreeFileInfo & {
//     workspaceFolder: vscode.WorkspaceFolder
// }

// export interface SessionInfo {
//     // TODO, if it had a summarized name that was better for the UI
//     name?: string
//     history: string[]w
// }

// export interface SessionStorage {
//     [key: string]: SessionInfo
// }

// export type LLMResponseType = 'EMPTY' | 'INVALID_STATE' | 'VALID'

// export interface UpdateFilesPathsParams {
//     tabID: string
//     filePaths: NewFileInfo[]
//     deletedFiles: DeletedFileInfo[]
//     messageId: string
//     disableFileActions?: boolean
// }

// export enum MetricDataOperationName {
//     StartCodeGeneration = 'StartCodeGeneration',
//     EndCodeGeneration = 'EndCodeGeneration',
// }

// export enum MetricDataResult {
//     Success = 'Success',
//     Fault = 'Fault',
//     Error = 'Error',
//     LlmFailure = 'LLMFailure',
// }
