# workbox-rspack-plugin

[![NPM version][npm-image]][npm-url] [![NPM Downloads][npm-download]][npm-url] [![License][license]][license-url] [![Minified Size][minified-size]][npm-url] [![Build Status][build-status]][github-actions]

An rspack plugin to use [workbox](https://developer.chrome.com/docs/workbox) in rspack. Both `GenerateSW` and `InjectManifest` are supported. And all the options are the same as the official [`workbox-webpack-plugin`](https://developer.chrome.com/docs/workbox/modules/workbox-webpack-plugin). Currently, it passes all the tests from the official `workbox-webpack-plugin`, and should be stable for general uses. If you find anything wrong, feel free to [open an issue](https://github.com/Clarkkkk/workbox-rspack-plugin/issues).

## Requirement
```sh
@rspack/core@^0.5.6
```

Or

```sh
@rsbuild/core@^0.4.11
```

## Install

```sh
npm i -D @aaroon/workbox-rspack-plugin
```

Or

```sh
pnpm i -D @aaroon/workbox-rspack-plugin
```

```sh
yarn add -D @aaroon/workbox-rspack-plugin
```

## Usage

```js
import { GenerateSW, InjectManifest } from '@aaroon/workbox-rspack-plugin'
/**
 * @type import('@rspack/cli').Configuration}
 */
export default {
    plugins: [
        new GenerateSW({
            // options
        }),
        // or
        new InjectManifest({
            // options
        })
    ]
}
```

If you're using Rsbuild, use it in `tools.rspack.plugins`:

```js
import { defineConfig } from '@rsbuild/core'
import { GenerateSW, InjectManifest } from '@aaroon/workbox-rspack-plugin'

export default defineConfig({
    tools: {
        rspack: {
            plugins: [
                new GenerateSW({
                    // options
                }),
                // or
                new InjectManifest({
                    // options
                })
            ]
        }
    }
})
```

## Options

Same as [workbox-webpack-plugin](https://developer.chrome.com/docs/workbox/modules/workbox-webpack-plugin).

## Changelog

Changelog can be found [here](https://github.com/Clarkkkk/workbox-rspack-plugin/blob/main/CHANGELOG.md).

## Credits

Most of the code comes from Google's workbox [repo](https://github.com/GoogleChrome/workbox), I just make it compatible with Rspack.

## Acknowledgment

If you found it useful somehow, I would be grateful if you could leave a star in the project's GitHub repository.

Thank you.

[npm-url]: https://www.npmjs.com/package/@aaroon/workbox-rspack-plugin
[npm-image]: https://badge.fury.io/js/@aaroon%2Fworkbox-rspack-plugin.svg
[npm-download]: https://img.shields.io/npm/dw/@aaroon/workbox-rspack-plugin
[license]: https://img.shields.io/github/license/Clarkkkk/workbox-rspack-plugin
[license-url]: https://github.com/Clarkkkk/workbox-rspack-plugin/blob/main/LICENSE.md
[minified-size]: https://img.shields.io/npm/unpacked-size/%40aaroon%2Fworkbox-rspack-plugin
[build-status]: https://img.shields.io/github/actions/workflow/status/Clarkkkk/workbox-rspack-plugin/.github%2Fworkflows%2Fpublish.yml
[github-actions]: https://github.com/Clarkkkk/workbox-rspack-plugin/actions
