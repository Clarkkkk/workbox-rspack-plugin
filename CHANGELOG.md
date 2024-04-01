# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

# 0.3.0    (2024-04-01)

## **Features**

* support rspack 0.5.7 and rsbuild 0.4.15, close [#2](https://github.com/Clarkkkk/workbox-rspack-plugin/issues/2)


## **Bug Fixes**

* add @rsbuild/core as peerDependencies and make all peerDependencies optional ([5d5c448f](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/5d5c448f4dde65f07f34396c759868512787c0aa))
* stageOptimizeHash is undefined ([5cdbc29f](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/5cdbc29f48e3ec29e3f061e8922f9e781e1695e8))
    
    ### **Description**
    
    https://github.com/Clarkkkk/workbox-rspack-plugin/issues/2
    

## **Documentation**

* update README ([7925f2d2](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/7925f2d2fc5623c0e7de38495fcdd9a6839d6012))

## **Test**

* fix a failed test due to an irrelevant difference of the output files between rspack and webpack ([60201639](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/60201639ac2876ba1ecd6c6f28d8f1b85371210d))
* fix failed tests caused by `rspack.CopyRspackPlugin` ([7b867adb](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/7b867adb4601c808a5266e3a0d5e19b5cd6b8739))

## **Chores**

* update README ([227f5760](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/227f57602de31493c6debf8d834dbbb3a224018e))
* update github actions to node 20 ([a70dfa54](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/a70dfa54b21ea735ccae785d50157818f120981c))
* remove irrelevant comments ([ab52d7fc](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/ab52d7fc8f60b7aeb10a2ed99a0373a3ca3af68f))



# 0.2.2    (2024-03-13)


## **Bug Fixes**

* should use `entrypoints` to get the chunkGroup of an entrypoint in rspack ([628f89cf](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/628f89cfb49c557f9c5ee38bafff0e0e51196b7a))

## **Documentation**

* update README ([51faa538](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/51faa538cf748e60e83bc0c44beedbaea69751e6))



# 0.2.1    (2024-03-10)


## **Bug Fixes**

* dependencies should be externalized ([6d502e6d](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/6d502e6d1171b3ae7f07bef229102ce37d58b163))



# 0.2.0    (2024-03-10)


## **Bug Fixes**

* stages are properies of processAssets in rspack ([afea6aab](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/afea6aab3b04f4ed6be335c395d2e616bfff1641))
* externalize dev dependencies to reduce the package size ([8151c28f](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/8151c28f0a300aff6d1cf71f77d616c2d6170a47))
* fix test errors caused by `rollup-plugin-node-externals` ([b63b5e84](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/b63b5e849c45ac321dc131ac06c7669e5639398c))

## **Documentation**

* update README ([61e8334a](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/61e8334a8a063d51c0e841fac68aef9e954256fd))

## **Chores**

* update keywords and homepage ([11119eff](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/11119eff3269d5eee12d1f76ecf5ee8329ccddcf))
* publish with public access ([c5375374](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/c537537484d823867c0f08458b8c47f8d7113524))



# 0.1.0    (2024-03-10)


## **Bug Fixes**

* fix build errors ([27128673](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/27128673c4ac06472e038f1c517190ca19ffefd5))
* remove all webpack imports ([1a349755](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/1a349755e139efea39f70687f02e9ea756c25fec))
* fix type errors ([2be3c866](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/2be3c8661182761e4a4068bc4f351cb091f1e3d7))
* fix some of the failed tests of `InjectManifest`, and skip the ones that are not fixable currently ([d8966fdd](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/d8966fddc53ef43513aa1833d1d146392a5c564d))
* `compilation.errors` and `compilation.warnings` are not arrays ([dfd7f146](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/dfd7f146cf78af6cd0c4c0d05d24a7dc9fdbe747))
* replace webpack.EntryPlugin with rspack.EntryPlugin ([40477ca7](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/40477ca73527812391aa4723c86de7bdfcd2cc12))
* fix the problems of `inject-manifest.test.ts` ([9070e56f](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/9070e56f2bc6fa92ed89c1d7060fa41e72e14ac7))
* fix errors caused by the difference of rspack and webpack ([48cbe779](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/48cbe779436fb8f7b0c9c1e7c3e07118eb43b2ec))

## **Documentation**

* update README ([86a19145](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/86a19145fe3403d13a57d840d9736ed658cb362c))

## **Test**

* use rspack in the tests and fix some failed tests ([bd39497f](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/bd39497f9cd30c30c5e4810be6acd7ee2fcad8f9))

## **Chores**

* update github actions ([90cb7533](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/90cb7533fcf9a77ab17df473a4d226795f1700bb))
* update package.json and README ([de3ed315](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/de3ed315ec7291182ab0af37f72d776491da210e))
* cleanup files ([c690b006](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/c690b006f4cf8ce658b85ee327e5e8fa292f5c51))
* update rspack ([bdd63a61](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/bdd63a6127cfecc5bad1df1dbf1442daa29a0812))
* port all the tests from workbox-webpack-plugin and migrate them to vitest ([b87b96ed](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/b87b96eda77cadf9a1ada5ef1f49b54a504141b6))
* port all the code from workbox-webpack-plugin ([ab4befb9](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/ab4befb9355da05ec3d0b1c810ffc81c295fb5cf))
* change changelog preset and cleanup ([d4030d25](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/d4030d2572586a9246c5e67118904780f0bb6f5d))
* update deps and license ([cca12d31](https://github.com/Clarkkkk/workbox-rspack-plugin/commit/cca12d3141a26e6940d8b0d1d1b101747dbb9069))
