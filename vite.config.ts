/// <reference types="vitest" />
import path from 'path'
import { nodeExternals } from 'rollup-plugin-node-externals'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
    base: './',
    assetsInclude: ['**/*.node'],
    build: {
        lib: {
            entry: {
                index: path.resolve(__dirname, 'src/index.ts')
            },
            formats: ['cjs', 'es']
        }
    },
    plugins: [
        dts(),
        {
            ...nodeExternals({
                deps: false
            }),
            enforce: 'pre'
        }
    ],
    test: {}
})
