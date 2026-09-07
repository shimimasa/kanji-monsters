/** Bound external work, including a response body that never settles. */
export function withDeadline(work, ms = 10000, onTimeout = () => {}) {
  let timer;
  return Promise.race([
    Promise.resolve().then(work),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new Error('読み込みが時間内に終わりませんでした。もう一度ためしてください。'));
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function fetchJsonResponse(url) {
  const controller = new AbortController();
  return withDeadline(async () => {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`教材を読み込めませんでした: ${url}`);
    const data = await response.json();
    return { ok: true, json: async () => data };
  }, 10000, () => controller.abort());
}
