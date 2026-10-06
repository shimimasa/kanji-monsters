(function () {
  'use strict';
  const slug = location.pathname.split('/').pop().replace(/\.html$/, '');
  function send(kind, count, total) {
    if (window.parent === window || !['kururu', 'hitotsubu'].includes(slug)) return;
    window.parent.postMessage({ type: 'yomitabi.lesson', kind, slug, count, total }, location.origin);
  }
  window.recordBadge = function (count, total) {
    if (Number.isInteger(count) && total === 5 && count >= 0 && count <= total) send('progress', count, total);
  };
  window.yomitabiLessonComplete = function (count, total) {
    if (count === 5 && total === 5) send('complete', count, total);
  };
})();
