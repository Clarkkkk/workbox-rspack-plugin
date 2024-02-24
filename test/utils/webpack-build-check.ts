function joinMessages(errorsOrWarnings) {
    if (errorsOrWarnings[0].message) {
        return errorsOrWarnings.map((item) => item.message).join('\n')
    } else {
        return errorsOrWarnings.join('\n')
    }
}

export const webpackBuildCheck = (webpackError, stats) => {
    if (webpackError) {
        throw new Error(webpackError.message)
    }

    const statsJson = stats.toJson('verbose')

    if (statsJson.errors.length > 0) {
        throw new Error(joinMessages(statsJson.errors))
    }

    if (statsJson.warnings.length > 0) {
        throw new Error(joinMessages(statsJson.warnings))
    }
}
