import { createRequire } from 'module'

if (!('require' in globalThis)) {
    globalThis.require = createRequire(import.meta.url)
}

export const { Compilation, sources, ModuleFilenameHelpers, EntryPlugin } =
    // eslint-disable-next-line
    require('@rspack/core') as typeof import('@rspack/core')
export const { RawSource } = sources
