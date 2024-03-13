import type { Configuration } from '@rspack/core'
import { rspack } from '@rspack/core'
import { globby } from 'globby'
import { fs } from 'memfs'
import { join, resolve } from 'pathe'
import { temporaryDirectory } from 'tempy'
import { describe, expect, it } from 'vitest'
import { GenerateSW } from '../../../src/generate-sw'
import { runWithCallback, validateServiceWorkerRuntime, webpackBuildCheck } from '../../utils'
import CreateWebpackAssetPlugin from './lib/create-webpack-asset-plugin'

try {
    delete require.cache[require.resolve('html-webpack-plugin')]
    delete require.cache[require.resolve('webpack')]
} catch (error) {
    // Ignore if require.resolve() fails.
}

describe(`[workbox-webpack-plugin] GenerateSW with webpack v5`, function () {
    const WEBPACK_ENTRY_FILENAME = 'webpackEntry.js'
    const SRC_DIR = join(__dirname, '..', '..', 'static', 'example-project-1')

    describe(`[workbox-webpack-plugin] Runtime errors`, async function () {
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
                    new GenerateSW({
                        /** @ts-expect-error test invalid config */
                        invalid: 'invalid'
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)

            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.warnings?.length).toBeFalsy()
            expect(statsJson.errors).to.have.length(1)
            expect(statsJson.errors![0].message).to.include(
                `  × Error: Please check your GenerateSW plugin configuration:\n  │ [WebpackGenerateSW] 'invalid' property is not expected to be here. Did you mean property 'include'?`
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
                plugins: [new GenerateSW()]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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

        it(`should work when called with importScriptsViaChunks`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                devtool: 'source-map',
                entry: {
                    main: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                    imported: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash:20].js',
                    path: outputDir
                },
                plugins: [
                    new GenerateSW({
                        importScriptsViaChunks: ['imported', 'INVALID_CHUNK_NAME']
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))

            const swFile = join(outputDir, 'service-worker.js')
            const statsJson = stats.toJson('verbose')
            expect(webpackError).toBeFalsy()
            expect(statsJson.errors?.length).toBeFalsy()
            // There should be a warning logged, due to INVALID_CHUNK_NAME.
            expect(statsJson.warnings).to.have.length(1)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(8)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    // imported-[chunkhash].js.map should *not* be included.
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/], [/^imported-[0-9a-f]{20}\.js$/]],
                    // imported-[chunkhash].js should *not* be included.
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main-[0-9a-f]{20}\.js$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })

        it(`should work when called with additionalManifestEntries`, async function () {
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
                    new GenerateSW({
                        additionalManifestEntries: [
                            { url: 'one', revision: null },
                            { url: 'two', revision: null },
                            { url: 'three', revision: '333' }
                        ]
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            const statsJson = stats!.toJson()
            expect(webpackError).toBeFalsy()
            expect(statsJson.errors?.length).toBeFalsy()
            expect(statsJson.warnings).to.have.length(0)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                                    revision: null,
                                    url: 'one'
                                },
                                {
                                    revision: '333',
                                    url: 'three'
                                },
                                {
                                    revision: null,
                                    url: 'two'
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
                    new GenerateSW({
                        chunks: ['entry1', 'entry2']
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(5)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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

        it(`should honor the 'chunks' allowlist config, including children created via SplitChunksPlugin`, async function () {
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
                    new GenerateSW({
                        chunks: ['main']
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(5)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        excludeChunks: ['entry3']
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(5)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        chunks: ['entry1', 'entry2'],
                        excludeChunks: ['entry2', 'entry3']
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(5)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                plugins: [new rspack.HtmlRspackPlugin(), new GenerateSW()]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(5)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW()
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(11)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW()
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(9)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        exclude: []
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        include: [/.html$/]
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(11)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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

        // a bug from new rspack.CopyRspackPlugin
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
                    new GenerateSW({
                        include: [/.html$/],
                        exclude: [/index/]
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(11)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        // resolve() will always return an absolute
                        swDest: resolve(join(outputDir, 'service-worker.js'))
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        chunks: ['entry1', 'doesNotExist']
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.errors?.length).toBeFalsy()
            expect(statsJson.warnings[0].message).to.include(
                `The chunk 'doesNotExist' was provided in your Workbox chunks config, but was not found in the compilation.`
            )

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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

        // a bug from new rspack.CopyRspackPlugin
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
                    new GenerateSW({
                        // Make this large enough to cache some, but not all, files.
                        maximumFileSizeToCacheInBytes: 14 * 1024
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            if (webpackError) {
                throw new Error(webpackError)
            }

            const statsJson = stats.toJson('verbose')
            expect(statsJson.warnings[0].message).to.eql(
                `images/example-jpeg.jpg is 15.3 kB, and won't be precached. Configure maximumFileSizeToCacheInBytes to change this limit.`
            )

            const swFile = join(outputDir, 'service-worker.js')

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(12)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                plugins: [new GenerateSW()]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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

    describe(`[workbox-webpack-plugin] Filesystem options`, function () {
        it(`should support using MemoryFS as the outputFileSystem`, async function () {
            const outputDir = '/output/dir'
            fs.mkdirSync('/output')
            fs.mkdirSync(outputDir)

            const config = {
                mode: 'production',
                entry: {
                    entry1: join(SRC_DIR, WEBPACK_ENTRY_FILENAME)
                },
                output: {
                    filename: '[name]-[chunkhash].js',
                    path: outputDir
                },
                plugins: [new GenerateSW()]
            } satisfies Configuration

            const compiler = rspack(config)
            // @ts-expect-error Type 'IFs' is missing the following properties from type 'typeof import("fs")': StatsFs, Dir
            compiler.outputFileSystem = fs

            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            const files = fs.readdirSync(outputDir)
            expect(files).to.have.length(3)

            const swString = fs.readFileSync(`${outputDir}/service-worker.js`, 'utf-8') as string

            await validateServiceWorkerRuntime({
                swString,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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

    describe(`[workbox-webpack-plugin] Multiple invocation scenarios`, function () {
        // See https://github.com/GoogleChrome/workbox/issues/2158
        it(`should support multiple compilations using the same plugin instance`, async function () {
            const outputDir = temporaryDirectory()
            const srcDir = join(__dirname, '..', '..', 'static', 'example-project-1')
            const config = {
                mode: 'production',
                entry: {
                    index: join(srcDir, 'webpackEntry.js')
                },
                output: {
                    filename: '[name].js',
                    path: outputDir
                },
                plugins: [new GenerateSW()]
            } satisfies Configuration

            const compiler = rspack(config)
            for (const i of [1, 2, 3]) {
                const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
                try {
                    if (webpackError) {
                        throw new Error(webpackError.message)
                    }

                    const statsJson = stats.toJson('verbose')
                    expect(statsJson.errors).to.have.length(0)

                    // There should be a warning logged after the first compilation.
                    // See https://github.com/GoogleChrome/workbox/issues/1790
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

        it(`should not list the swDest from one plugin in the other's manifest`, async function () {
            const outputDir = temporaryDirectory()
            const srcDir = join(__dirname, '..', '..', 'static', 'example-project-1')
            const config = {
                mode: 'production',
                entry: {
                    index: join(srcDir, 'webpackEntry.js')
                },
                output: {
                    filename: '[name].js',
                    path: outputDir
                },
                plugins: [
                    new GenerateSW({
                        swDest: 'sw1.js'
                    }),
                    new GenerateSW({
                        swDest: 'sw2.js'
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const sw1File = join(outputDir, 'sw1.js')
            const sw2File = join(outputDir, 'sw2.js')

            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(4)

            await validateServiceWorkerRuntime({
                swFile: sw1File,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'index.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })

            await validateServiceWorkerRuntime({
                swFile: sw2File,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: /^[0-9a-f]{32}$/,
                                    url: 'index.js'
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })

    describe(`[workbox-webpack-plugin] Rollup plugin configuration options`, function () {
        it(`should support inlining the Workbox runtime`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:6].js',
                    path: outputDir,
                    publicPath: '/public/'
                },
                plugins: [
                    new GenerateSW({
                        inlineWorkboxRuntime: true
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            // We can't really mock evaluation of the service worker script when
            // the Workbox runtime is inlined, so just check to make sure the
            // correct files are output.
            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(2)
        })

        it(`should support inlining the Workbox runtime and generating sourcemaps`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    filename: '[name].[contenthash:6].js',
                    path: outputDir,
                    publicPath: '/public/'
                },
                plugins: [
                    new GenerateSW({
                        inlineWorkboxRuntime: true,
                        sourcemap: true
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            // We can't really mock evaluation of the service worker script when
            // the Workbox runtime is inlined, so just check to make sure the
            // correct files are output.
            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)
        })

        it(`should support using a swDest that includes a subdirectory`, async function () {
            const outputDir = temporaryDirectory()
            const config = {
                mode: 'production',
                entry: join(SRC_DIR, WEBPACK_ENTRY_FILENAME),
                output: {
                    path: outputDir
                },
                plugins: [
                    new GenerateSW({
                        swDest: join('sub', 'directory', 'service-worker.js')
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            webpackBuildCheck(webpackError, stats)

            // Make sure that the expected generated service worker files are
            // output into the subdirectory.
            const files = await globby('**/*', {
                cwd: join(outputDir, 'sub', 'directory')
            })
            expect(files).to.have.length(2)
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
                    new GenerateSW({
                        dontCacheBustURLsMatching: /\.[0-9a-f]{20}\./
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        modifyURLPrefix: {
                            '/public/': 'https://example.org/'
                        }
                    })
                ]
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            webpackBuildCheck(webpackError, stats)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
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
                    new GenerateSW({
                        manifestTransforms: [
                            (manifest, compilation) => {
                                expect(manifest).to.have.lengthOf(1)
                                expect(manifest[0].size).to.eql(398)
                                expect(manifest[0].url.startsWith('main.')).toBe(true)
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
            } satisfies Configuration

            const compiler = rspack(config)
            const [webpackError, stats] = await runWithCallback(compiler.run.bind(compiler))
            const swFile = join(outputDir, 'service-worker.js')
            expect(webpackError).toBeFalsy()
            const statsJson = stats!.toJson()
            expect(statsJson.errors?.length).toBeFalsy()
            expect(statsJson.warnings[0].message).to.include(warningMessage)

            const files = await globby('**', { cwd: outputDir })
            expect(files).to.have.length(3)

            await validateServiceWorkerRuntime({
                swFile,
                expectedMethodCalls: {
                    importScripts: [[/^\.\/workbox-[0-9a-f]{8}$/]],
                    precacheAndRoute: [
                        [
                            [
                                {
                                    revision: null,
                                    url: /^main\.[0-9a-f]{20}\.js-suffix$/
                                }
                            ],
                            {}
                        ]
                    ]
                }
            })
        })
    })
})
