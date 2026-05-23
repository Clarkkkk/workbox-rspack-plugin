import { createRequire } from 'module'

const requireSource = typeof __filename === 'string' ? __filename : import.meta.url

if (!('require' in globalThis)) {
    globalThis.require = createRequire(requireSource)
}

export const { Compilation, sources, ModuleFilenameHelpers, EntryPlugin } =
    // eslint-disable-next-line
    require('@rspack/core') as typeof import('@rspack/core')
export const { RawSource } = sources
