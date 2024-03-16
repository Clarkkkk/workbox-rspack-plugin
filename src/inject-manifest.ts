/*
  Copyright 2018 Google LLC

  Use of this source code is governed by an MIT-style
  license that can be found in the LICENSE file or at
  https://opensource.org/licenses/MIT.
*/

import type { Compilation, Compiler } from '@rspack/core'
import { EntryPlugin, sources } from '@rspack/core'
import stringify from 'fast-json-stable-stringify'
import { parse, resolve } from 'pathe'
import prettyBytes from 'pretty-bytes'
import type { WebpackInjectManifestOptions } from 'workbox-build'
import { escapeRegExp } from 'workbox-build/build/lib/escape-regexp'
import { replaceAndUpdateSourceMap } from 'workbox-build/build/lib/replace-and-update-source-map'
import { validateWebpackInjectManifestOptions } from 'workbox-build/build/lib/validate-options'
import { extractMessage } from './lib/extract-message'
import { getManifestEntriesFromCompilation } from './lib/get-manifest-entries-from-compilation'
import { getSourcemapAssetName } from './lib/get-sourcemap-asset-name'
import { relativeToOutputPath } from './lib/relative-to-output-path'
// Used to keep track of swDest files written by *any* instance of this plugin.
// See https://github.com/GoogleChrome/workbox/issues/2181
const _generatedAssetNames = new Set<string>()

const { RawSource } = sources

/**
 * This class supports compiling a service worker file provided via `swSrc`,
 * and injecting into that service worker a list of URLs and revision
 * information for precaching based on the webpack asset pipeline.
 *
 * Use an instance of `InjectManifest` in the
 * [`plugins` array](https://webpack.js.org/concepts/plugins/#usage) of a
 * webpack config.
 *
 * In addition to injecting the manifest, this plugin will perform a compilation
 * of the `swSrc` file, using the options from the main webpack configuration.
 *
 * ```
 * // The following lists some common options; see the rest of the documentation
 * // for the full set of options and defaults.
 * new InjectManifest({
 *   exclude: [/.../, '...'],
 *   maximumFileSizeToCacheInBytes: ...,
 *   swSrc: '...',
 * });
 * ```
 *
 * @memberof module:workbox-webpack-plugin
 */
class InjectManifest {
    protected config: WebpackInjectManifestOptions
    private alreadyCalled: boolean

    /**
     * Creates an instance of InjectManifest.
     */
    constructor(config: WebpackInjectManifestOptions) {
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
                // Use swSrc with a hardcoded .js extension, in case swSrc is a .ts file.
                swDest: parse(this.config.swSrc).name + '.js'
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

        compiler.hooks.make.tapPromise(this.constructor.name, (compilation) =>
            this.handleMake(compilation, compiler).catch((error: Error) => {
                compilation.errors.push(error)
            })
        )

        // const { PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER } = webpack.Compilation
        // Specifically hook into thisCompilation, as per
        // https://github.com/webpack/webpack/issues/11425#issuecomment-690547848
        compiler.hooks.thisCompilation.tap(this.constructor.name, (compilation) => {
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
        })
    }

    /**
     * @param {Object} compilation The webpack compilation.
     * @param {Object} parentCompiler The webpack parent compiler.
     *
     * @private
     */
    async performChildCompilation(
        compilation: Compilation,
        parentCompiler: Compiler
    ): Promise<void> {
        const outputOptions = {
            path: parentCompiler.options.output.path,
            filename: this.config.swDest
        }

        const childCompiler = compilation.createChildCompiler(
            this.constructor.name,
            outputOptions,
            []
        )

        childCompiler.context = parentCompiler.context
        childCompiler.inputFileSystem = parentCompiler.inputFileSystem
        childCompiler.outputFileSystem = parentCompiler.outputFileSystem

        if (Array.isArray(this.config.webpackCompilationPlugins)) {
            for (const plugin of this.config.webpackCompilationPlugins) {
                // plugin has a generic type, eslint complains for an unsafe
                // assign and unsafe use
                // eslint-disable-next-line
                plugin.apply(childCompiler)
            }
        }

        new EntryPlugin(parentCompiler.context, this.config.swSrc, this.constructor.name).apply(
            childCompiler
        )

        await new Promise<void>((resolve, reject) => {
            childCompiler.runAsChild((error: any, _entries: any, childCompilation: any) => {
                if (error) {
                    reject(error)
                } else {
                    for (const item of childCompilation?.warnings ?? []) {
                        compilation.warnings.push(item)
                    }
                    for (const item of childCompilation?.errors ?? []) {
                        compilation.errors.push(item)
                    }
                    resolve()
                }
            })
        })
    }

    /**
     * @param {Object} compilation The webpack compilation.
     * @param {Object} parentCompiler The webpack parent compiler.
     *
     * @private
     */
    addSrcToAssets(compilation: Compilation, parentCompiler: Compiler): void {
        // eslint-disable-next-line
        const source = (parentCompiler.inputFileSystem as any).readFileSync(this.config.swSrc)
        compilation.emitAsset(this.config.swDest!, new RawSource(source))
    }

    /**
     * @param {Object} compilation The webpack compilation.
     * @param {Object} parentCompiler The webpack parent compiler.
     *
     * @private
     */
    async handleMake(compilation: Compilation, parentCompiler: Compiler): Promise<void> {
        try {
            this.config = validateWebpackInjectManifestOptions(this.config)
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(
                    `Please check your ${this.constructor.name} plugin ` +
                        `configuration:\n${error.message}`
                )
            }
        }

        this.config.swDest = relativeToOutputPath(compilation, this.config.swDest!)
        _generatedAssetNames.add(this.config.swDest)

        if (this.config.compileSrc) {
            await this.performChildCompilation(compilation, parentCompiler)
        } else {
            this.addSrcToAssets(compilation, parentCompiler)
            // This used to be a fatal error, but just warn at runtime because we
            // can't validate it easily.
            if (
                Array.isArray(this.config.webpackCompilationPlugins) &&
                this.config.webpackCompilationPlugins.length > 0
            ) {
                compilation.warnings.push(
                    new Error(
                        'compileSrc is false, so the ' +
                            'webpackCompilationPlugins option will be ignored.'
                    )
                )
            }
        }
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
            // warning is not an Error object
            if (
                ![...compilation.warnings].flat().some((warning) => {
                    return (
                        typeof warning?.message === 'string' &&
                        extractMessage(warning.message) === warningMessage
                    )
                })
            ) {
                compilation.warnings.push(new Error(warningMessage))
            }
        } else {
            this.alreadyCalled = true
        }

        const config = Object.assign({}, this.config)

        // Ensure that we don't precache any of the assets generated by *any*
        // instance of this plugin.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        config.exclude!.push(({ asset }) => _generatedAssetNames.has(asset.name))

        // See https://webpack.js.org/contribute/plugin-patterns/#monitoring-the-watch-graph
        const absoluteSwSrc = resolve(this.config.swSrc)
        compilation.fileDependencies.add(absoluteSwSrc)

        const swAsset = compilation.getAsset(config.swDest!)
        const swAssetString = swAsset!.source.source().toString()

        const globalRegexp = new RegExp(escapeRegExp(config.injectionPoint!), 'g')
        const injectionResults = swAssetString.match(globalRegexp)

        if (!injectionResults) {
            throw new Error(`Can't find ${config.injectionPoint ?? ''} in your SW source.`)
        }
        if (injectionResults.length !== 1) {
            throw new Error(
                `Multiple instances of ${config.injectionPoint ?? ''} were ` +
                    `found in your SW source. Include it only once. For more info, see ` +
                    `https://github.com/GoogleChrome/workbox/issues/2681`
            )
        }

        const { size, sortedEntries } = await getManifestEntriesFromCompilation(compilation, config)

        let manifestString = stringify(sortedEntries)
        if (
            this.config.compileSrc &&
            // See https://github.com/GoogleChrome/workbox/issues/2729
            !(
                compilation.options?.devtool === 'eval-cheap-source-map' &&
                compilation.options.optimization?.minimize
            )
        ) {
            // See https://github.com/GoogleChrome/workbox/issues/2263
            manifestString = manifestString.replace(/"/g, `'`)
        }

        const sourcemapAssetName = getSourcemapAssetName(compilation, swAssetString, config.swDest!)

        if (sourcemapAssetName) {
            _generatedAssetNames.add(sourcemapAssetName)
            const sourcemapAsset = compilation.getAsset(sourcemapAssetName)
            const { source, map } = await replaceAndUpdateSourceMap({
                jsFilename: config.swDest!,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                originalMap: JSON.parse(sourcemapAsset!.source.source().toString()),
                originalSource: swAssetString,
                replaceString: manifestString,
                searchString: config.injectionPoint!
            })

            compilation.updateAsset(sourcemapAssetName, new RawSource(map), {})
            compilation.updateAsset(config.swDest!, new RawSource(source), {})
        } else {
            // If there's no sourcemap associated with swDest, a simple string
            // replacement will suffice.
            compilation.updateAsset(
                config.swDest!,
                new RawSource(swAssetString.replace(config.injectionPoint!, manifestString)),
                {}
            )
        }

        if (compilation.getLogger) {
            const logger = compilation.getLogger(this.constructor.name)
            logger.info(`The service worker at ${config.swDest ?? ''} will precache
        ${sortedEntries.length} URLs, totaling ${prettyBytes(size)}.`)
        }
    }
}

export { InjectManifest }
