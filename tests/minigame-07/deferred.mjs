export function createDeferred() {
  let resolve, reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return Object.freeze({ promise, resolve, reject });
}

export const flushAsync = () => new Promise(resolve => setImmediate(resolve));
