if (!self.define) {
    let e
    const s = {}
    const t = (t, n) => (
        (t = new URL(t + '.js', n).href),
        s[t] ||
            new Promise((s) => {
                if ('document' in self) {
                    const e = document.createElement('script')
                    ;(e.src = t), (e.onload = s), document.head.appendChild(e)
                } else (e = t), importScripts(t), s()
            }).then(() => {
                const e = s[t]
                if (!e) throw new Error(`Module ${t} didn’t register its module`)
                return e
            })
    )
    self.define = (n, o) => {
        const r = e || ('document' in self ? document.currentScript.src : '') || location.href
        if (s[r]) return
        const i = {}
        const l = (e) => t(e, r)
        const u = { module: { uri: r }, exports: i, require: l }
        s[r] = Promise.all(n.map((e) => u[e] || l(e))).then((e) => (o(...e), i))
    }
}
define(['./workbox-03270c55'], function (e) {
    'use strict'
    self.addEventListener('message', (e) => {
        e.data && e.data.type === 'SKIP_WAITING' && self.skipWaiting()
    }),
    e.precacheAndRoute(
        [
            { url: '00a11ef9fd26adeb6033.js', revision: null },
            { url: '4038541e8a9a4d213ec7.js', revision: null }
        ],
        {}
    )
})
