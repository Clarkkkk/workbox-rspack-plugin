import type { Compilation } from '@rspack/core'
import { normalize, relative, resolve } from 'pathe'

/**
 * @param {Object} compilation The webpack compilation.
 * @param {string} swDest The original swDest value.
 *
 * @return {string} If swDest was not absolute, the returns swDest as-is.
 * Otherwise, returns swDest relative to the compilation's output path.
 *
 * @private
 */
export function relativeToOutputPath(compilation: Compilation, swDest: string): string {
    // See https://github.com/jantimon/html-webpack-plugin/pull/266/files#diff-168726dbe96b3ce427e7fedce31bb0bcR38
    if (resolve(swDest) === normalize(swDest)) {
        return relative(compilation.options.output.path!, swDest)
    }

    // Otherwise, return swDest as-is.
    return swDest
}
