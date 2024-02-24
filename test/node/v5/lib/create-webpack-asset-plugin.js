import { sources } from 'webpack'

class CreateWebpackAssetPlugin {
    constructor(name) {
        if (typeof name !== 'string') {
            throw new Error('Please pass in a string.')
        }
        this.name = name
    }

    apply(compiler) {
        compiler.hooks.thisCompilation.tap(this.constructor.name, (compilation) =>
            compilation.emitAsset(this.name, new sources.RawSource(this.name))
        )
    }
}

export default CreateWebpackAssetPlugin
