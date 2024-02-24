import { extname } from 'pathe'
import type { Compilation, WebpackError } from 'webpack'
import { resolveWebpackURL } from './resolve-webpack-url'

export function getScriptFilesForChunks(
    compilation: Compilation,
    chunkNames: Array<string>
): Array<string> {
    const { chunks } = compilation.getStats().toJson({ chunks: true })
    const { publicPath } = compilation.options.output
    const scriptFiles = new Set<string>()

    for (const chunkName of chunkNames) {
        const chunk = chunks!.find((chunk) => chunk.names?.includes(chunkName))
        if (chunk) {
            for (const file of chunk?.files ?? []) {
                // See https://github.com/GoogleChrome/workbox/issues/2161
                if (extname(file) === '.js') {
                    scriptFiles.add(resolveWebpackURL(publicPath as string, file))
                }
            }
        } else {
            compilation.warnings.push(
                new Error(
                    `${chunkName} was provided to ` +
                        `importScriptsViaChunks, but didn't match any named chunks.`
                ) as WebpackError
            )
        }
    }

    if (scriptFiles.size === 0) {
        compilation.warnings.push(
            new Error(
                `There were no assets matching ` +
                    `importScriptsViaChunks: [${chunkNames.join(' ')}].`
            ) as WebpackError
        )
    }

    return Array.from(scriptFiles)
}
