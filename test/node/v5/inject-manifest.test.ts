import { rspack } from '@rspack/core'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import fse from 'fs-extra'
import { globby } from 'globby'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { join, resolve } from 'pathe'
import { temporaryDirectory } from 'tempy'
import { describe, expect, it } from 'vitest'
import type webpack from 'webpack'
import { InjectManifest } from '../../../src/inject-manifest'
import {
    isStringMatched,
    runWithCallback,
    validateServiceWorkerRuntime,
    webpackBuildCheck
} from '../../utils'
import CreateWebpackAssetPlugin from './lib/create-webpack-asset-plugin'

// workbox-webpack-plugin needs to do require('webpack'), and in order to test
// against multiple webpack versions, we need that to resolve to whatever the
// correct webpack is for this test.
// See https://jeffy.info/2020/10/01/testing-multiple-webpack-versions.html
try {
    delete require.cache[require.resolve('html-webpack-plugin')]
    delete require.cache[require.resolve('webpack')]
} catch (error) {
    // Ignore if require.resolve() fails.
}

describe(`[workbox-webpack-plugin] InjectManifest with webpack v5`, function () {
    const WEBPACK_ENTRY_FILENAME = 'webpackEntry.js'
    const SRC_DIR = join(__dirname, '..', '..', 'static', 'example-project-1')
    const SW_SRC = join(__dirname, '..', '..', 'static', 'sw-src.js')
    expect.addEqualityTesters([isStringMatched])

    describe(`[workbox-webpack-plugin] Runtime errors`, function () {
        it(`should lead to a webpack compilation error when passed invalid config`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        // @ts-expect-error invalid config
                        invalid: 'invalid'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.warnings?.length).toBeFalsy()
            expect(statsJson.errors[0].message).include(
                `  × Error: Please check your InjectManifest plugin configuration:\n  │ [WebpackInjectManifest] 'invalid' property is not expected to be here. Did you mean property 'include'?`
            )
        })

        it(`should lead to a webpack compilation error when the swSrc contains multiple injection points`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: join(__dirname, '..', '..', 'static', 'bad-multiple-injection.js')
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.warnings?.length).toBeFalsy()
            expect(statsJson.errors[0].message).include(
                `Multiple instances of self.__WB_MANIFEST were found in your SW source. Include it only once. For more info, see https://github.com/GoogleChrome/workbox/issues/2681`
            )
        })
    })

    describe(`[workbox-webpack-plugin] Multiple chunks`, function () {
        it(`should work when called without any parameters`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry2: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: null,
                                    url: /^entry2-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should honor the 'chunks' allowlist config`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry2: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry3: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        chunks: ['entry1', 'entry2']
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: null,
                                    url: /^entry2-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        // rspack bug with splitChunks
        it.skip(`should honor the 'chunks' allowlist config, including children created via SplitChunksPlugin`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    main: join(SRC_DIR, 'splitChunksEntry.js')
                },
                output: {
                    filename: '[chunkhash].js',
                    path: outputDir
                },
                optimization: {
                    minimize: false,
                    splitChunks: {
                        chunks: 'all'
                    }
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        chunks: ['main']
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: null,
                                    url: /^[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should honor the 'excludeChunks' denylist config`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry2: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry3: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        excludeChunks: ['entry3']
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: null,
                                    url: /^entry2-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should honor setting both the 'chunks' and 'excludeChunks', with the denylist taking precedence`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry2: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry3: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        chunks: ['entry1', 'entry2'],
                        excludeChunks: ['entry2', 'entry3']
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] html-webpack-plugin and a single chunk`, function () {
        // rspack bug
        it.skip(`should work when called without any parameters`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    entry2: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new rspack.HtmlRspackPlugin(),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: null,
                                    url: /^entry2-[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'index.html'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] copy-webpack-plugin and a single chunk`, function () {
        // a bug from rspack.CopyRspackPlugin
        it.skip(`should work when called without any parameters`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                plugins: [
                    new rspack.CopyRspackPlugin({
                        patterns: [
                            {
                                from: SRC_DIR,
                                to: outputDir
                            }
                        ]
                    }),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(10)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'images/example-jpeg.jpg'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'images/web-fundamentals-icon192x192.png'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'index.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-1.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-2.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'splitChunksEntry.js'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'styles/stylesheet-1.css'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'styles/stylesheet-2.css'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Sourcemap manipulation`, function () {
        it(`should update the sourcemap to account for manifest injection`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                devtool: 'source-map',
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            const expectedSourcemap = await fse.readJSON(
                join(__dirname, 'static', 'expected-service-worker.js.map')
            )
            const actualSourcemap = await fse.readJSON(join(outputDir, 'service-worker.js.map'))

            // The mappings will vary depending on the webpack version.
            delete expectedSourcemap.mappings
            delete actualSourcemap.mappings

            expect(actualSourcemap).to.eql(expectedSourcemap)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should handle a custom output.sourceMapFilename`, async function () {
            const outputDir = temporaryDirectory()

            const sourceMapFilename = join('subdir', '[file].map')
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    sourceMapFilename,
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                devtool: 'source-map',
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            const expectedSourcemap = await fse.readJSON(
                join(__dirname, 'static', 'expected-service-worker.js.map')
            )
            const actualSourcemap = await fse.readJSON(
                join(outputDir, 'subdir', 'service-worker.js.map')
            )

            // The mappings will vary depending on the webpack version.
            delete expectedSourcemap.mappings
            delete actualSourcemap.mappings

            expect(actualSourcemap).to.eql(expectedSourcemap)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should not fail if the sourcemap is missing from the assets`, async function () {
            const outputDir = temporaryDirectory()
            const swSrc = join(__dirname, '..', '..', 'static', 'sw-src-missing-sourcemap.js')

            const config = {
                mode: 'development',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                devtool: false,
                plugins: [
                    new InjectManifest({
                        swSrc,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        // See https://github.com/GoogleChrome/workbox/issues/2729
        // needs investigation for `extractComments`
        it.skip(`should produce valid JavaScript when eval-cheap-source-map and minimization are used`, async function () {
            const outputDir = resolve('./dist') // temporaryDirectory()

            const config = {
                mode: 'development',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                devtool: 'eval-cheap-source-map',
                optimization: {
                    minimize: true
                },
                plugins: [
                    new rspack.SwcJsMinimizerRspackPlugin({
                        extractComments: true
                    }),
                    new InjectManifest({
                        swSrc: join(__dirname, '..', '..', 'static', 'module-import-sw.js'),
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest'
                // We can't verify expectedMethodCalls here, since we're using
                // a compiled ES module import, not the workbox-sw interfaces.
                // This test just confirms that the compilation produces valid JS.
            })
        })

        // See https://github.com/GoogleChrome/workbox/issues/2729
        it(`should produce valid JavaScript when eval-cheap-source-map is used without minimization`, async function () {
            const outputDir = temporaryDirectory()

            const config = {
                mode: 'development',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                devtool: 'eval-cheap-source-map',
                optimization: {
                    minimize: false
                },
                plugins: [
                    new InjectManifest({
                        swSrc: join(__dirname, '..', '..', 'static', 'module-import-sw.js'),
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest'
                // We can't verify expectedMethodCalls here, since we're using
                // a compiled ES module import, not the workbox-sw interfaces.
                // This test just confirms that the compilation produces valid JS.
            })
        })
    })

    describe(`[workbox-webpack-plugin] Filtering via include/exclude`, function () {
        it(`should exclude .map and manifest.js files by default`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                devtool: 'source-map',
                plugins: [
                    new CreateWebpackAssetPlugin('manifest.js'),
                    new CreateWebpackAssetPlugin('manifest.json'),
                    new CreateWebpackAssetPlugin('not-ignored.js'),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(7)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'manifest.json'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'not-ignored.js'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should allow developers to override the default exclude filter`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: 'manifest-normally-ignored.js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        exclude: []
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'manifest-normally-ignored.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        // a bug from rspack.CopyRspackPlugin
        it.skip(`should allow developers to allowlist via include`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                plugins: [
                    new rspack.CopyRspackPlugin({
                        patterns: [
                            {
                                from: SRC_DIR,
                                to: outputDir
                            }
                        ]
                    }),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        include: [/.html$/]
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(10)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'index.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-1.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-2.html'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        // rspack.CopyRspackPlugin bug
        it.skip(`should allow developers to combine the include and exclude filters`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                plugins: [
                    new rspack.CopyRspackPlugin({
                        patterns: [
                            {
                                from: SRC_DIR,
                                to: outputDir
                            }
                        ]
                    }),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        include: [/.html$/],
                        exclude: [/index/]
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(10)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-1.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-2.html'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] swDest variations`, function () {
        it(`should work when swDest is an absolute path`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: WEBPACK_ENTRY_FILENAME,
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: resolve(join(outputDir, 'service-worker.js'))
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Reporting webpack warnings`, function () {
        it(`should warn when when passed a non-existent chunk`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        chunks: ['entry1', 'doesNotExist']
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.errors?.length).toBeFalsy()
            expect(statsJson.warnings[0].message).include(
                `The chunk 'doesNotExist' was provided in your Workbox chunks config, but was not found in the compilation.`
            )

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        // a bug from rspack.CopyRspackPlugin
        it.skip(`should add maximumFileSizeToCacheInBytes warnings to compilation.warnings`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new rspack.CopyRspackPlugin({
                        patterns: [
                            {
                                from: SRC_DIR,
                                to: outputDir
                            }
                        ]
                    }),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        // Make this large enough to cache some, but not all, files.
                        maximumFileSizeToCacheInBytes: 14 * 1024
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson('verbose')
            expect(statsJson.warnings[0].message).include(
                `images/example-jpeg.jpg is 15.3 kB, and won't be precached. Configure maximumFileSizeToCacheInBytes to change this limit.`
            )

            const swFile = join(outputDir, 'service-worker.js')

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(11)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^entry1-[0-9a-f]{20}\.js$/
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'images/web-fundamentals-icon192x192.png'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'index.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-1.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'page-2.html'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'splitChunksEntry.js'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'styles/stylesheet-1.css'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'styles/stylesheet-2.css'
                                },
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'webpackEntry.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Customizing output paths and names`, function () {
        it(`should honor publicPath`, async function () {
            const outputDir = temporaryDirectory()
            const publicPath = '/testing/'
            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    publicPath,
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^\/testing\/entry1-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Manifest transformations`, function () {
        it(`should use dontCacheBustURLsMatching`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        dontCacheBustURLsMatching: /\.[0-9a-f]{20}\./
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    url: /^main\.[0-9a-f]{20}\.js$/,
                                    revision: null
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should use modifyURLPrefix`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir,
                    publicPath: '/public/'
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        modifyURLPrefix: {
                            '/public/': 'https://example.org/'
                        }
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^https:\/\/example\.org\/main\.[0-9a-f]{20}\.js/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should use webpackCompilationPlugins with DefinePlugin`, async function () {
            const prefix = 'replaced-by-define-plugin'
            const swSrc = join(__dirname, '..', '..', 'static', 'sw-src-define-plugin.js')
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc,
                        swDest: 'service-worker.js',
                        webpackCompilationPlugins: [
                            new rspack.DefinePlugin({
                                __PREFIX__: JSON.stringify(prefix)
                            })
                        ]
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)
            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    setCacheNameDetails: [[{ prefix }]],
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main\.[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should use manifestTransforms`, async function () {
            const outputDir = temporaryDirectory()
            const warningMessage = 'test warning'
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js',
                        manifestTransforms: [
                            (manifest, compilation) => {
                                expect(manifest).to.have.lengthOf(1)
                                expect(manifest[0].size).to.eql(1420)
                                expect(manifest[0].url.startsWith('main.')).toBeTruthy()
                                expect(manifest[0].revision).toBe(null)
                                expect(compilation).toBeTruthy()

                                manifest = manifest.map((entry) => {
                                    entry.url += '-suffix'
                                    entry.revision = null
                                    return entry
                                })

                                return {
                                    manifest,
                                    warnings: [warningMessage]
                                }
                            }
                        ]
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.errors?.length).toBeFalsy()
            expect(statsJson.warnings[0].message).include(warningMessage)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main.[0-9a-f]{20}\.js-suffix$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] TypeScript compilation`, function () {
        it(`should rename a swSrc with a .ts extension to .js`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:6].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: join(__dirname, '..', '..', 'static', 'sw.ts')
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            const files = await globby('*', { cwd: outputDir })
            expect(files).to.contain('sw.js')
        })
    })

    describe(`[workbox-webpack-plugin] Multiple invocation scenarios`, function () {
        // See https://github.com/GoogleChrome/workbox/issues/2158
        it(`should support multiple compilations using the same plugin instance`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:6].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            for (const i of [1, 2, 3]) {
                const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
                try {
                    if (webpackError) {
                        throw new Error(webpackError.message)
                    }

                    const statsJson = stats!.toJson('verbose')
                    expect(statsJson.errors).to.have.length(0)

                    // There should be a warning logged after the first compilation.
                    // See https://github.com/GoogleChrome/workbox/issues/1790
                    if (i > 1) {
                        expect(statsJson.warnings).to.have.length(1)
                    } else {
                        expect(statsJson.warnings).to.have.length(0)
                    }

                    const files = await globby('**', { cwd: outputDir })
                    expect(files).to.have.length(2)

                    resolve()
                } catch (error) {
                    throw new Error(`Failure during compilation ${i}: ${error}`)
                }
            }
        })

        it(`should only log once per invocation when using multiple plugin instances`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:6].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker1.js'
                    }),
                    new InjectManifest({
                        swSrc: SW_SRC,
                        swDest: 'service-worker2.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            for (const i of [1, 2, 3]) {
                const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
                try {
                    if (webpackError) {
                        throw new Error(webpackError.message)
                    }

                    const statsJson = stats!.toJson('verbose')
                    expect(statsJson.errors).to.have.length(0)

                    // There should be a single warning logged after the first compilation.
                    // See https://github.com/GoogleChrome/workbox/issues/1790#issuecomment-640132556
                    if (i > 1) {
                        expect(statsJson.warnings).to.have.length(1)
                    } else {
                        expect(statsJson.warnings).to.have.length(0)
                    }

                    const files = await globby('**', { cwd: outputDir })
                    expect(files).to.have.length(3)

                    resolve()
                } catch (error) {
                    throw new Error(`Failure during compilation ${i}: ${error}`)
                }
            }
        })
    })

    describe(`[workbox-webpack-plugin] Multiple plugin instances`, function () {
        // See https://github.com/GoogleChrome/workbox/issues/2181
        it(`should not list the swDest from one plugin in the other's manifest`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        exclude: [/sw\d.js/],
                        swSrc: join(__dirname, '..', '..', 'static', 'sw.ts'),
                        swDest: 'sw1.js'
                    }),
                    new InjectManifest({
                        exclude: [/sw\d.js/],
                        swSrc: join(__dirname, '..', '..', 'static', 'sw.ts'),
                        swDest: 'sw2.js'
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const sw1File = join(outputDir, 'sw1.js')
            const sw2File = join(outputDir, 'sw2.js')

            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile: sw1File,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main\.[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })

            await validateServiceWorkerRuntime({
                swFile: sw2File,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main\.[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Manifest injection in development mode`, function () {
        it(`should produce valid, parsable JavaScript`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'development',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        exclude: [/sw\d.js/],
                        swDest: 'sw.js',
                        swSrc: join(__dirname, '..', '..', 'static', 'sw-src.js')
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'sw.js')

            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            await validateServiceWorkerRuntime({
                swFile,
                entryPoint: 'injectManifest',
                expectedMethodCalls: {
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main\.[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Non-compilation scenarios`, function () {
        it(`should error when compileSrc is false and webpackCompilationPlugins is used`, async function () {
            const outputDir = temporaryDirectory()

            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        compileSrc: false,
                        swDest: 'injected-manifest.json',
                        swSrc: join(__dirname, '..', '..', 'static', 'injected-manifest.json'),
                        webpackCompilationPlugins: [{}]
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.errors?.length).toBeFalsy()
            expect(statsJson.warnings[0].message).include(
                'compileSrc is false, so the webpackCompilationPlugins option will be ignored.'
            )
        })

        it(`should support injecting a manifest into a JSON file`, async function () {
            const outputDir = temporaryDirectory()

            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        compileSrc: false,
                        swDest: 'injected-manifest.json',
                        swSrc: join(__dirname, '..', '..', 'static', 'injected-manifest.json')
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            const manifest = await fse.readJSON(join(outputDir, 'injected-manifest.json'))
            expect(manifest).toEqual([
                {
                    revision: null,
                    url: /^main\.[0-9a-f]{20}\.js$/
                }
            ])
        })

        it(`should support injecting a manifest into a CJS module`, async function () {
            const outputDir = temporaryDirectory()

            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:20].js',
                    path: outputDir
                },
                plugins: [
                    new InjectManifest({
                        compileSrc: false,
                        swDest: 'injected-manifest.js',
                        swSrc: join(__dirname, '..', '..', 'static', 'injected-manifest.js')
                    })
                ]
            } satisfies webpack.Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)

            const manifest = (await import(join(outputDir, 'injected-manifest.js'))).default
            expect(manifest).toEqual([
                {
                    revision: null,
                    url: /^main\.[0-9a-f]{20}\.js$/
                }
            ])
        })
    })
})
