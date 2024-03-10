# workbox-rspack-plugin

An rspack plugin to use [workbox](https://developer.chrome.com/docs/workbox) in rspack. Both `GenerateSW` and `InjectManifest` are supported. And all the options are the same as the official [`workbox-webpack-plugin`](https://developer.chrome.com/docs/workbox/modules/workbox-webpack-plugin). Note, although it should work in general, there are still problems in some use cases due to rspack's limitation. Check the [tracking issue]() for details.

# Install

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
import { GenerateSW, InjectManifest } from 'workbox-rspack-plugin'

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

Check [workbox-webpack-plugin](https://developer.chrome.com/docs/workbox/modules/workbox-webpack-plugin).

## Credits

Most of the code comes from Google's workbox [repo](https://github.com/GoogleChrome/workbox), I just make it compatible with Rspack.

## Acknowledgment

If you found it useful somehow, I would be grateful if you could leave a star in the project's GitHub repository.

Thank you.
