import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const distIndexCjs = join(repoRoot, 'dist', 'index.cjs')
const rspackCli = join(repoRoot, 'node_modules', '@rspack', 'cli', 'bin', 'rspack.js')

const projectDir = await mkdtemp(join(tmpdir(), 'workbox-rspack-plugin-cjs-'))

try {
    const distSource = await readFile(distIndexCjs, 'utf8')
    if (distSource.includes('createRequire({}.url)')) {
        throw new Error(`dist/index.cjs contains an invalid createRequire() fallback.`)
    }

    await mkdir(join(projectDir, 'node_modules', '@aaroon'), { recursive: true })
    await mkdir(join(projectDir, 'src'), { recursive: true })
    await writeFile(join(projectDir, 'src', 'index.js'), `console.log('ok')\n`)
    await writeFile(
        join(projectDir, 'rspack.config.cjs'),
        `const { InjectManifest } = require('@aaroon/workbox-rspack-plugin')

module.exports = {
    entry: './src/index.js',
}
`
    )
    await symlink(
        repoRoot,
        join(projectDir, 'node_modules', '@aaroon', 'workbox-rspack-plugin'),
        process.platform === 'win32' ? 'junction' : 'dir'
    )

    await execFileAsync(process.execPath, [rspackCli, 'build'], {
        cwd: projectDir,
        env: {
            ...process.env,
            CI: '1'
        }
    })
} finally {
    await rm(projectDir, { recursive: true, force: true })
}
