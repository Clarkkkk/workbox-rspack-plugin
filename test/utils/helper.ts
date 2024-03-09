export async function runWithCallback<T = any, S = any>(
    func: (cb: (arg1: T, arg2: S) => void) => void
) {
    return new Promise<[T, S]>((resolve, reject) => {
        try {
            func((arg1, arg2) => {
                resolve([arg1, arg2])
            })
        } catch (error) {
            reject(error)
        }
    })
}

export function isStringMatched(str: unknown, regex: unknown) {
    if (typeof str === 'string' && regex instanceof RegExp) {
        return regex.test(str)
    } else {
        return undefined
    }
}
