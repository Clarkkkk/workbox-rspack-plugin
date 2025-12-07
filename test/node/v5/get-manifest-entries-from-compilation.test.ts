import { describe, it, expect } from 'vitest'
import { getManifestEntriesFromCompilation } from '../../../src/lib/get-manifest-entries-from-compilation'

describe('getManifestEntriesFromCompilation size fallback', () => {
    it('uses 0 when asset.source is undefined', async () => {
        const asset = {
            name: 'file.js',
            info: {}
        } as any

        const compilation = {
            getAssets: () => [asset],
            options: { output: { publicPath: '' } },
            warnings: [],
            entrypoints: new Map()
        } as any

        const { size, sortedEntries } = await getManifestEntriesFromCompilation(compilation, {} as any)

        expect(size).toEqual(0)
        expect(sortedEntries).toHaveLength(1)
        expect(sortedEntries[0].url).toEqual('file.js')
    })
})
