import { WorkspaceFolder } from '@aws/language-server-runtimes/server-interface/lsp'
import { CurrentWsFolders } from '../types'
import { createHash } from './cryptoUtilities'
import AdmZip = require('adm-zip')
import path = require('path')
import { sanitizeFilename } from './textUtils'
import { isCodeFile } from './filetypeUtilities'
import { hasCode } from './errorUtilities'
import { isInDirectory } from './pathUtils'
import { Workspace } from '@aws/language-server-runtimes/server-interface'

export const getSha256 = async (file: Buffer) => createHash('sha256', file, 'base64')

// Max allowed size for file collection
const maxRepoSizeBytes = 200 * 1024 * 1024

const workspaceFolderPrefixGuards = {
    /**
     * the maximum number of subfolders the method below takes into account when calculating a prefix
     */
    maximumFolderDepthConsidered: 500,
    /**
     * the maximum suffix that can be added to a folder prefix in case of full subfolder path matches
     */
    maximumFoldersWithMatchingSubfolders: 10_000,
}

export class ZipUtilities {
    constructor(private readonly workspace: Workspace) {}

    /**
     * given the root path of a repo, zips its files and generate a checksum for it.
     */
    async prepareRepoData(repoRootPaths: string[], workspaceFolders: CurrentWsFolders, zip: AdmZip = new AdmZip()) {
        try {
            const files = await this.collectFiles(repoRootPaths, workspaceFolders, true, maxRepoSizeBytes)

            let totalBytes = 0
            const ignoredExtensionMap = new Map<string, number>()

            for (const file of files) {
                let fileSize
                try {
                    fileSize = (await this.workspace.fs.getFileSize(file.fileUri)).size
                } catch (error) {
                    if (hasCode(error) && error.code === 'ENOENT') {
                        // No-op: Skip if file does not exist
                        continue
                    }
                    throw error
                }
                const isCodeFile_ = isCodeFile(file.relativeFilePath)

                if (fileSize >= maxRepoSizeBytes || !isCodeFile_) {
                    if (!isCodeFile_) {
                        const re = /(?:\.([^.]+))?$/
                        const extensionArray = re.exec(file.relativeFilePath)
                        const extension = extensionArray?.length ? extensionArray[1] : undefined
                        if (extension) {
                            const currentCount = ignoredExtensionMap.get(extension)

                            ignoredExtensionMap.set(extension, (currentCount ?? 0) + 1)
                        }
                    }
                    continue
                }
                totalBytes += fileSize

                const zipFolderPath = path.dirname(file.zipFilePath)

                try {
                    zip.addLocalFile(file.fileUri, zipFolderPath)
                } catch (error) {
                    if (error instanceof Error && error.message.includes('File not found')) {
                        // No-op: Skip if file was deleted or does not exist
                        // Reference: https://github.com/cthackers/adm-zip/blob/1cd32f7e0ad3c540142a76609bb538a5cda2292f/adm-zip.js#L296-L321
                        continue
                    }
                    throw error
                }
            }

            const zipFileBuffer = zip.toBuffer()
            return {
                zipFileBuffer,
                zipFileChecksum: await getSha256(zipFileBuffer),
            }
        } catch (error) {
            // TODO
            // getLogger().debug(`featureDev: Failed to prepare repo: ${error}`)
            // if (error instanceof ToolkitError && error.code === 'ContentLengthError') {
            //     throw new ContentLengthError()
            // }
            // throw new PrepareRepoFailedError()
            throw new Error('unknown')
        }
    }

    /**
     * gets the absolute path from a zip path
     * @param zipFilePath the path in the zip file
     * @param workspacesByPrefix the workspaces with generated prefixes
     * @param workspaceFolders all workspace folders
     * @returns all possible path info
     */
    getPathsFromZipFilePath(
        zipFilePath: string,
        workspacesByPrefix: { [prefix: string]: WorkspaceFolder } | undefined,
        workspaceFolders: CurrentWsFolders
    ): {
        absolutePath: string
        relativePath: string
        workspaceFolder: WorkspaceFolder
    } {
        // when there is just a single workspace folder, there is no prefixing
        if (workspacesByPrefix === undefined) {
            return {
                absolutePath: path.join(workspaceFolders[0].uri, zipFilePath),
                relativePath: zipFilePath,
                workspaceFolder: workspaceFolders[0],
            }
        }
        // otherwise the first part of the zipPath is the prefix
        const prefix = zipFilePath.substring(0, zipFilePath.indexOf(path.sep))

        // TODO this has been changed -- verify if this works
        const workspaceFolder = workspacesByPrefix[prefix] ?? workspaceFolders[0]
        if (workspaceFolder === undefined) {
            throw new Error(`Could not find workspace folder for prefix ${prefix}`)
        }
        return {
            absolutePath: path.join(workspaceFolder.uri, zipFilePath.substring(prefix.length + 1)),
            relativePath: zipFilePath.substring(prefix.length + 1),
            workspaceFolder,
        }
    }

    /**
     * Returns a path relative to the first workspace folder found that is a parent of the defined path, along with the workspaceFolder itself
     * Returns undefined if there are no applicable workspace folders.
     * @param childPath Path to derive relative path from
     */
    getWorkspaceRelativePath(
        childPath: string,
        override: {
            workspaceFolders?: readonly WorkspaceFolder[]
        }
    ): { relativePath: string; workspaceFolder: WorkspaceFolder } | undefined {
        if (!override.workspaceFolders) {
            return
        }
        for (const folder of override.workspaceFolders) {
            if (isInDirectory(folder.uri, childPath)) {
                return { relativePath: path.relative(folder.uri, childPath), workspaceFolder: folder }
            }
        }
    }

    /**
     * collects all files that are marked as source
     * @param sourcePaths the paths where collection starts
     * @param workspaceFolders the current workspace folders opened
     * @param respectGitIgnore whether to respect gitignore file
     * @returns all matched files
     */
    async collectFiles(
        sourcePaths: string[],
        workspaceFolders: CurrentWsFolders,
        respectGitIgnore: boolean = true,
        maxSize = 200 * 1024 * 1024 // 200 MB
    ): Promise<
        {
            workspaceFolder: WorkspaceFolder
            relativeFilePath: string
            fileUri: string
            fileContent: string
            zipFilePath: string
        }[]
    > {
        const storage: Awaited<ReturnType<typeof this.collectFiles>> = []

        const workspaceFoldersMapping = this.getWorkspaceFoldersByPrefixes(workspaceFolders)
        const workspaceToPrefix = new Map<WorkspaceFolder, string>(
            workspaceFoldersMapping === undefined
                ? [[workspaceFolders[0], '']]
                : Object.entries(workspaceFoldersMapping).map(value => [value[1], value[0]])
        )
        const prefixWithFolderPrefix = (folder: WorkspaceFolder, path: string) => {
            const prefix = workspaceToPrefix.get(folder)
            /**
             * collects all files that are marked as source
             * @param sourcePaths the paths where collection starts
             * @param workspaceFolders the current workspace folders opened
             * @param respectGitIgnore whether to respect gitignore file
             * @returns all matched files
             */
            if (prefix === undefined) {
                throw new Error(`Failed to find prefix for workspace folder ${folder.name}`)
            }
            return prefix === '' ? path : `${prefix}/${path}`
        }

        let totalSizeBytes = 0
        for (const rootPath of sourcePaths) {
            // TODO
            // const allFiles = await vscode.workspace.findFiles(new RelativePattern(rootPath, '**'), getExcludePattern())
            const allFiles = await this.findAllFiles(rootPath, [])

            // TODO
            // const files = respectGitIgnore ? await filterOutGitignoredFiles(rootPath, allFiles) : allFiles
            const files = allFiles

            for (const filePath of files) {
                const relativePath = this.getWorkspaceRelativePath(filePath, { workspaceFolders })
                if (!relativePath) {
                    continue
                }

                const fileStat = await this.workspace.fs.getFileSize(filePath)
                if (totalSizeBytes + fileStat.size > maxSize) {
                    // TODO
                    // throw new ToolkitError(
                    //     'The project you have selected for source code is too large to use as context. Please select a different folder to use',
                    //     { code: 'ContentLengthError' }
                    // )
                    throw new Error(
                        'The project you have selected for source code is too large to use as context. Please select a different folder to use'
                    )
                }

                const fileContent = await this.workspace.fs.readFile(filePath)

                if (fileContent === undefined) {
                    continue
                }

                // Now that we've read the file, increase our usage
                totalSizeBytes += fileStat.size
                storage.push({
                    workspaceFolder: relativePath.workspaceFolder,
                    relativeFilePath: relativePath.relativePath,
                    fileUri: filePath,
                    fileContent: fileContent,
                    zipFilePath: prefixWithFolderPrefix(relativePath.workspaceFolder, relativePath.relativePath),
                })
            }
        }
        return storage
    }

    /**
     * tries to determine the possible prefixes we will use for a given workspace folder in the zip file
     * We want to keep the folder names in the prefix, since they might convey useful information, for example
     * If both folders are just called cdk (no name specified for the ws folder), adding a prefix of cdk1 and cdk2 is much less context, than having app_cdk and canaries_cdk
     *
     * Input:
     * - packages/app/cdk
     * - packages/canaries/cdk
     * Output:
     * - {'app_cdk': packages/app/cdk, 'canaries_cdk': packages/canaries/cdk}
     *
     * @returns an object where workspace folders have a prefix, or undefined for single root workspace, as there is no mapping needed there
     */
    getWorkspaceFoldersByPrefixes(folders: CurrentWsFolders): { [prefix: string]: WorkspaceFolder } | undefined {
        if (folders.length <= 1) {
            return undefined
        }
        let remainingWorkspaceFoldersToMap = folders.map(f => ({
            folder: f,
            preferredPrefixQueue: f.uri
                .split(path.sep)
                .reverse()
                .slice(0, workspaceFolderPrefixGuards.maximumFolderDepthConsidered)
                .reduce(
                    (candidates, subDir) => {
                        candidates.push(sanitizeFilename(path.join(subDir, candidates[candidates.length - 1])))
                        return candidates
                    },
                    [f.name]
                )
                .reverse(),
        }))
        const results: ReturnType<typeof this.getWorkspaceFoldersByPrefixes> = {}

        for (
            let addParentFolderCount = 0;
            remainingWorkspaceFoldersToMap.length > 0 &&
            addParentFolderCount < workspaceFolderPrefixGuards.maximumFolderDepthConsidered;
            addParentFolderCount++
        ) {
            const workspacesByPrefixes = remainingWorkspaceFoldersToMap.reduce(
                (acc, wsFolder) => {
                    const prefix = wsFolder.preferredPrefixQueue.pop()
                    // this should never happen, as last candidates should be handled below, and the array starts non empty
                    if (prefix === undefined) {
                        throw new Error(
                            `Encountered a folder with invalid prefix candidates (workspace folder ${wsFolder.folder.name})`
                        )
                    }
                    acc[prefix] = acc[prefix] ?? []
                    acc[prefix].push(wsFolder)
                    return acc
                },
                {} as { [key: string]: (typeof remainingWorkspaceFoldersToMap)[0][] }
            )
            remainingWorkspaceFoldersToMap = []
            for (const [prefix, folders] of Object.entries(workspacesByPrefixes)) {
                // if a folder has a unique prefix
                if (folders.length === 1 && results[prefix] === undefined) {
                    results[prefix] = folders[0].folder
                    continue
                }

                // find the folders that do not have more parents
                const foldersToSuffix: typeof folders = []
                for (const folder of folders) {
                    if (folder.preferredPrefixQueue.length > 0) {
                        remainingWorkspaceFoldersToMap.push(folder)
                    } else {
                        foldersToSuffix.push(folder)
                    }
                }
                // for these last resort folders, suffix them with an increasing number until unique
                if (foldersToSuffix.length === 1 && results[prefix] === undefined) {
                    results[prefix] = foldersToSuffix[0].folder
                } else {
                    let suffix = 1
                    for (const folder of foldersToSuffix) {
                        let newPrefix: string
                        let safetyCounter = 0
                        do {
                            newPrefix = `${prefix}_${suffix}`
                            suffix++
                            safetyCounter++
                        } while (
                            results[newPrefix] !== undefined &&
                            safetyCounter < workspaceFolderPrefixGuards.maximumFoldersWithMatchingSubfolders
                        )
                        if (safetyCounter >= workspaceFolderPrefixGuards.maximumFoldersWithMatchingSubfolders) {
                            throw new Error(
                                `Could not find a unique prefix for workspace folder ${folder.folder.name} in zip file.`
                            )
                        }
                        results[newPrefix] = folder.folder
                    }
                }
            }
        }
        if (remainingWorkspaceFoldersToMap.length > 0) {
            throw new Error(
                `Could not find a unique prefix for workspace folder ${remainingWorkspaceFoldersToMap[0].folder.name} in zip file.`
            )
        }

        return results
    }

    // Remove me? Unless flare provides an implementation
    private async findAllFiles(directory: string, results: string[] = []): Promise<string[]> {
        // Get all entries in the current directory
        const entries = await this.workspace.fs.readdir(directory)

        // Process each entry
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.path)

            try {
                if (await this.workspace.fs.isFile(fullPath)) {
                    // Recursively process subdirectories
                    await this.findAllFiles(fullPath, results)
                } else {
                    // Add file to results
                    results.push(fullPath)
                }
            } catch (error) {
                console.error(`Error processing ${fullPath}:`, error)
            }
        }

        return results
    }
}
