import { type Compiler } from '@rspack/core'
import { Compilation, sources } from '@rspack/core'
import type { ManifestEntry, WebpackGenerateSWOptions } from 'workbox-build'
import { bundle } from 'workbox-build/build/lib/bundle.js'
import { populateSWTemplate } from 'workbox-build/build/lib/populate-sw-template.js'
import { validateWebpackGenerateSWOptions } from 'workbox-build/build/lib/validate-options.js'
import { getManifestEntriesFromCompilation } from './lib/get-manifest-entries-from-compilation'
import { getScriptFilesForChunks } from './lib/get-script-files-for-chunks'
import { relativeToOutputPath } from './lib/relative-to-output-path'

const { RawSource } = sources

// Used to keep track of swDest files written by *any* instance of this plugin.
// See https://github.com/GoogleChrome/workbox/issues/2181
const _generatedAssetNames = new Set<string>()

export interface GenerateSWConfig extends WebpackGenerateSWOptions {
    manifestEntries?: Array<ManifestEntry>
}

class GenerateSW {
    protected config: GenerateSWConfig
    private alreadyCalled: boolean

    /**
     * Creates an instance of GenerateSW.
     */
    constructor(config: GenerateSWConfig = {}) {
        this.config = config
        this.alreadyCalled = false
    }

    /**
     * @param {Object} [compiler] default compiler object passed from webpack
     *
     * @private
     */
    propagateWebpackConfig(compiler: Compiler): void {
        // Because this.config is listed last, properties that are already set
        // there take precedence over derived properties from the compiler.
        this.config = Object.assign(
            {
                mode: compiler.options.mode,
                sourcemap: Boolean(compiler.options.devtool)
            },
            this.config
        )
    }

    /**
     * @param {Object} [compiler] default compiler object passed from webpack
     *
     * @private
     */
    apply(compiler: Compiler): void {
        this.propagateWebpackConfig(compiler)

        // webpack v4/v5 compatibility:
        // https://github.com/webpack/webpack/issues/11425#issuecomment-690387207
        const { PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER } = Compilation
        // Specifically hook into thisCompilation, as per
        // https://github.com/webpack/webpack/issues/11425#issuecomment-690547848
        compiler.hooks.thisCompilation.tap(this.constructor.name, (compilation) => {
            // https://github.com/Clarkkkk/workbox-rspack-plugin/issues/2
            if ('stageOptimizeHash' in compilation.hooks.processAssets) {
                // https://github.com/web-infra-dev/rspack/issues/5399
                compilation.hooks.processAssets.stageOptimizeHash.tapPromise(
                    {
                        name: this.constructor.name
                        // TODO(jeffposnick): This may need to change eventually.
                        // See https://github.com/webpack/webpack/issues/11822#issuecomment-726184972
                        // stage: PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER - 10
                    },
                    () =>
                        this.addAssets(compilation).catch((error: Error) => {
                            compilation.errors.push(error)
                        })
                )
            } else {
                // @ts-expect-error: when @rspack/core => 0.5.7, will be the same as webpack
                compilation.hooks.processAssets.tapPromise(
                    {
                        name: this.constructor.name,
                        // TODO(jeffposnick): This may need to change eventually.
                        // See https://github.com/webpack/webpack/issues/11822#issuecomment-726184972
                        stage: PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER - 10
                    },
                    () =>
                        this.addAssets(compilation).catch((error: Error) => {
                            compilation.errors.push(error)
                        })
                )
            }
        })
    }

    /**
     * @param {Object} compilation The webpack compilation.
     *
     * @private
     */
    async addAssets(compilation: Compilation): Promise<void> {
        // See https://github.com/GoogleChrome/workbox/issues/1790
        if (this.alreadyCalled) {
            const warningMessage =
                `${this.constructor.name} has been called ` +
                `multiple times, perhaps due to running webpack in --watch mode. The ` +
                `precache manifest generated after the first call may be inaccurate! ` +
                `Please see https://github.com/GoogleChrome/workbox/issues/1790 for ` +
                `more information.`

            // compilation.warnings is an iterable, not an array
            if (
                ![...compilation.warnings].some(
                    (warning) => warning instanceof Error && warning.message === warningMessage
                )
            ) {
                compilation.warnings.push(new Error(warningMessage))
            }
        } else {
            this.alreadyCalled = true
        }

        let config: GenerateSWConfig = {}
        try {
            // emit might be called multiple times; instead of modifying this.config,
            // use a validated copy.
            // See https://github.com/GoogleChrome/workbox/issues/2158
            config = validateWebpackGenerateSWOptions(this.config)
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(
                    `Please check your ${this.constructor.name} plugin ` +
                        `configuration:\n${error.message}`
                )
            }
        }

        // Ensure that we don't precache any of the assets generated by *any*
        // instance of this plugin.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        config.exclude!.push(({ asset }) => _generatedAssetNames.has(asset.name))

        if (config.importScriptsViaChunks) {
            // Anything loaded via importScripts() is implicitly cached by the service
            // worker, and should not be added to the precache manifest.
            config.excludeChunks = (config.excludeChunks || []).concat(
                config.importScriptsViaChunks
            )

            const scripts = getScriptFilesForChunks(compilation, config.importScriptsViaChunks)

            config.importScripts = (config.importScripts || []).concat(scripts)
        }

        const { size, sortedEntries } = await getManifestEntriesFromCompilation(compilation, config)
        config.manifestEntries = sortedEntries

        const unbundledCode = populateSWTemplate(config)

        const files = await bundle({
            babelPresetEnvTargets: config.babelPresetEnvTargets,
            inlineWorkboxRuntime: config.inlineWorkboxRuntime,
            mode: config.mode,
            sourcemap: config.sourcemap,
            swDest: relativeToOutputPath(compilation, config.swDest!),
            unbundledCode
        })

        for (const file of files) {
            compilation.emitAsset(file.name, new RawSource(Buffer.from(file.contents)), {
                // See https://github.com/webpack-contrib/compression-webpack-plugin/issues/218#issuecomment-726196160
                minimized: config.mode === 'production'
            })

            _generatedAssetNames.add(file.name)
        }

        if (compilation.getLogger) {
            const prettyBytes = (await import('pretty-bytes')).default
            const logger = compilation.getLogger(this.constructor.name)
            logger.info(`The service worker at ${config.swDest ?? ''} will precache
        ${config.manifestEntries.length} URLs, totaling ${prettyBytes(size)}.`)
        }
    }
}

export { GenerateSW }
