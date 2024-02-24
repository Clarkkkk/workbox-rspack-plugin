import assert from 'assert'
import { readFile } from 'fs/promises'
import makeServiceWorkerEnv from 'service-worker-mock'
import { expect, vi } from 'vitest'
import vm from 'vm'

// See https://github.com/chaijs/chai/issues/697
function stringifyFunctionsInArray(arr) {
    return arr.map((item) => (typeof item === 'function' ? item.toString() : item))
}

function setupSpiesAndContextForInjectManifest() {
    const cacheableResponsePluginSpy = vi.fn()
    class CacheableResponsePlugin {
        constructor(...args) {
            cacheableResponsePluginSpy(...args)
        }
    }

    const cacheExpirationPluginSpy = vi.fn()
    class CacheExpirationPlugin {
        constructor(...args) {
            cacheExpirationPluginSpy(...args)
        }
    }

    const importScripts = vi.fn()

    const addEventListener = vi.fn()

    const workbox = {
        cacheableResponse: {
            CacheableResponsePlugin
        },
        expiration: {
            CacheExpirationPlugin
        },
        googleAnalytics: {
            initialize: vi.fn()
        },
        precaching: {
            // To make testing easier, hardcode this fake URL return value.
            getCacheKeyForURL: vi.fn(() => '/urlWithCacheKey'),
            precacheAndRoute: vi.fn(),
            cleanupOutdatedCaches: vi.fn()
        },
        navigationPreload: {
            enable: vi.fn()
        },
        routing: {
            registerNavigationRoute: vi.fn(),
            registerRoute: vi.fn()
        },
        core: {
            clientsClaim: vi.fn(),
            setCacheNameDetails: vi.fn()
        },
        setConfig: vi.fn(),
        // To make testing easier, return the name of the strategy.
        strategies: {
            CacheFirst: vi.fn(() => ({ name: 'CacheFirst' })),
            NetworkFirst: vi.fn(() => ({ name: 'NetworkFirst' }))
        }
    }

    const context = Object.assign(
        {
            importScripts,
            workbox
        },
        makeServiceWorkerEnv()
    )
    context.self.addEventListener = addEventListener
    context.self.skipWaiting = vi.fn()

    const methodsToSpies = {
        importScripts,
        cacheableResponsePlugin: cacheableResponsePluginSpy,
        cleanupOutdatedCaches: workbox.precaching.cleanupOutdatedCaches,
        cacheExpirationPlugin: cacheExpirationPluginSpy,
        CacheFirst: workbox.strategies.CacheFirst,
        clientsClaim: workbox.core.clientsClaim,
        getCacheKeyForURL: workbox.precaching.getCacheKeyForURL,
        googleAnalyticsInitialize: workbox.googleAnalytics.initialize,
        NetworkFirst: workbox.strategies.NetworkFirst,
        navigationPreloadEnable: workbox.navigationPreload.enable,
        precacheAndRoute: workbox.precaching.precacheAndRoute,
        registerNavigationRoute: workbox.routing.registerNavigationRoute,
        registerRoute: workbox.routing.registerRoute,
        setCacheNameDetails: workbox.core.setCacheNameDetails,
        setConfig: workbox.setConfig,
        skipWaiting: context.self.skipWaiting
    }

    return { addEventListener, context, methodsToSpies }
}

function setupSpiesAndContextForGenerateSW() {
    const addEventListener = vi.fn()
    const importScripts = vi.fn()

    const workboxContext = {
        importScripts,
        CacheFirst: vi.fn(() => ({ name: 'CacheFirst' })),
        clientsClaim: vi.fn(),
        createHandlerBoundToURL: vi.fn(() => '/urlWithCacheKey'),
        enable: vi.fn(),
        initialize: vi.fn(),
        NavigationRoute: vi.fn(() => ({ name: 'NavigationRoute' })),
        NetworkFirst: vi.fn(() => ({ name: 'NetworkFirst' })),
        BroadcastUpdatePlugin: vi.fn(),
        CacheableResponsePlugin: vi.fn(),
        ExpirationPlugin: vi.fn(),
        PrecacheFallbackPlugin: vi.fn(),
        precacheAndRoute: vi.fn(),
        registerRoute: vi.fn(),
        setCacheNameDetails: vi.fn(),
        skipWaiting: vi.fn()
    }

    const context = Object.assign(makeServiceWorkerEnv(), {
        importScripts,
        define: (scripts, callback) => {
            importScripts(...scripts)
            callback(workboxContext)
        }
    })
    context.self.addEventListener = addEventListener
    context.self.skipWaiting = workboxContext.skipWaiting

    return { addEventListener, context, methodsToSpies: workboxContext }
}

function isStringMatched(str: unknown, regex: unknown) {
    if (typeof str === 'string' && regex instanceof RegExp) {
        return regex.test(str)
    } else {
        return undefined
    }
}

function validateMethodCalls({ methodsToSpies, expectedMethodCalls, context }) {
    expect.addEqualityTesters([isStringMatched])
    for (const [method, spy] of Object.entries(methodsToSpies)) {
        if (!expectedMethodCalls[method]) {
            expect(spy).not.toBeCalled()
        } else {
            expectedMethodCalls[method].forEach((args, index) => {
                if (Array.isArray(args)) {
                    expect(spy).toHaveBeenNthCalledWith(index + 1, ...args)
                } else {
                    expect(spy).toBeCalledWith(args)
                }
            })
        }
    }

    // Special validation for __WB_DISABLE_DEV_LOGS, which is a boolean
    // assignment, so we can't stub it out.
    if ('__WB_DISABLE_DEV_LOGS' in expectedMethodCalls) {
        expect(context.self.__WB_DISABLE_DEV_LOGS).to.eql(
            expectedMethodCalls.__WB_DISABLE_DEV_LOGS,
            `__WB_DISABLE_DEV_LOGS`
        )
    }
}

/**
 * This is used in the service worker generation tests to validate core
 * service worker functionality. While we don't fully emulate a real service
 * worker runtime, we set up spies/stubs to listen for certain method calls,
 * run the code in a VM sandbox, and then verify that the service worker
 * made the expected method calls.
 *
 * If any of the expected method calls + parameter combinations were not made,
 * this method will reject with a description of what failed.
 *
 * @param {string} [swFile]
 * @param {string} [swString]
 * @param {Object} expectedMethodCalls
 * @return {Promise} Resolves if all of the expected method calls were made.
 */
export const validateServiceWorkerRuntime = async ({
    addEventListenerValidation,
    entryPoint,
    expectedMethodCalls,
    swFile,
    swString
}: {
    addEventListenerValidation?: (...args: any) => any
    entryPoint?: unknown
    expectedMethodCalls: unknown
    swFile?: string
    swString?: string
}) => {
    assert((swFile || swString) && !(swFile && swString), `Set swFile or swString, but not both.`)

    if (swFile) {
        swString = await readFile(swFile, 'utf8')
    }

    const { addEventListener, context, methodsToSpies } =
        entryPoint === 'injectManifest'
            ? setupSpiesAndContextForInjectManifest()
            : setupSpiesAndContextForGenerateSW()

    vm.runInNewContext(swString!, context)

    if (expectedMethodCalls) {
        validateMethodCalls({ methodsToSpies, expectedMethodCalls, context })
    }

    // Optionally check the usage of addEventListener().
    if (addEventListenerValidation) {
        addEventListenerValidation(addEventListener)
    }
}
