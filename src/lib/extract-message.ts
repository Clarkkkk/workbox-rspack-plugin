export function extractMessage(message: string) {
    const match = message.replaceAll('\n  │ ', '').match(/⚠ Error: (.*?) {4}at/)?.[1]
    if (match) {
        return match
    } else {
        return undefined
    }
}
