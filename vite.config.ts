/// <reference types="vitest" />
import path from 'path'
import { nodeExternals } from 'rollup-plugin-node-externals'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => {
    return {
        base: './',
        build: {
            lib: {
                entry: {
                    index: path.resolve(__dirname, 'src/index.ts')
                },
                formats: ['cjs', 'es']
            }
        },
        plugins:
            mode === 'test'
                ? []
                : [
                      dts(),
                      {
                          ...nodeExternals({
                              deps: true,
                              devDeps: true
                          }),
                          enforce: 'pre'
                      }
                  ]
    }
})
