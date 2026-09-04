// src/utils/logger.js
// ログ方針: debug/info は開発時のみ、warn/error は常時出力する。
// console.log の直接使用（447箇所）は今後これに段階的に置き換える（refactoring-plan Phase 2-4）。

const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export const log = {
  debug: (...args) => { if (DEV) console.debug(...args); },
  info:  (...args) => { if (DEV) console.info(...args); },
  warn:  (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export default log;
