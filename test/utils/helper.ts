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
