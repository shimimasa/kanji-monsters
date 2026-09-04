// public/sw.js
//
// 自分自身を消すためだけの Service Worker。
//
// 経緯:
//   PWA は撤退したが、その前に配られた壊れた sw.js が端末に残り続けている。
//   sw.js をリポジトリから消しても、SPA の rewrite により /sw.js は 404 ではなく
//   index.html を 200 で返す。ブラウザは更新チェックで「スクリプトとして読めない
//   もの」を受け取るだけで、登録は消えない。
//   その結果、古い SW が cache-first で index.html を返し続け、
//   新しい版が永遠に届かない端末ができる（教室の「直したのに反映されない」）。
//   実際に、キャッシュから古い main.js が配られている状態を確認した。
//
// この SW は fetch を一切横取りしない。有効化された瞬間に、
// キャッシュを全部消し、自分の登録を解除し、開いているページを読み直させる。
// 一度これが行き渡れば、端末は素の（Service Worker のいない）状態に戻る。

self.addEventListener('install', () => {
  // 待機せずすぐ次の段階へ
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
    } catch {}

    try {
      await self.registration.unregister();
    } catch {}

    // 開いているページを、今度はネットワークから読み直させる
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => client.navigate(client.url));
    } catch {}
  })());
});
