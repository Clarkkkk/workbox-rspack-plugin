/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
    base: './',
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/index.ts'),
            formats: ['cjs', 'es']
        }
    },
    plugins: [dts()],
    test: {}
})
