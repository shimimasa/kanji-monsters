// Pure selection: viewing the hub never changes learning or play records.
export function hubRecommendations({ gameIds, progress = {}, reviewCount = 0, timedReviewCount = 0, sentenceReviewCount = 0 }) {
  const suggestions = [], activity = progress.hubActivity;
  const known = id => typeof id === 'string' && gameIds.includes(id);
  if (reviewCount > 0 && known('englishChoice')) {
    suggestions.push({ kind: 'review', gameId: 'englishChoice', review: true,
      label: `英単語${reviewCount}語を復習しよう`, reason: 'まちがえた語を、もう一度たしかめよう。', action: '相棒と復習する' });
  }
  if (timedReviewCount > 0 && known('timedChoice')) {
    suggestions.push({ kind: 'review', gameId: 'timedChoice', review: true,
      label: `タイムことば${timedReviewCount}語を復習しよう`, reason: '時間を気にせず、よみをたしかめよう。', action: '時間なしで復習する' });
  }
  if (sentenceReviewCount > 0 && known('sentenceOrder')) {
    suggestions.push({ kind: 'review', gameId: 'sentenceOrder', review: true,
      label: `文ならべ${sentenceReviewCount}文を復習しよう`, reason: 'まちがえた文を、解説といっしょにたしかめよう。', action: '文を復習する' });
  }
  if (known(activity?.lastGameId) && !suggestions.some(item => item.gameId === activity.lastGameId)) {
    suggestions.push({ kind: 'recent', gameId: activity.lastGameId,
      label: '最近あそんだゲーム', reason: 'はじめから、もう一度あそぼう。', action: 'もう一度あそぶ' });
  }
  const started = Array.isArray(activity?.startedGames) ? activity.startedGames : [];
  const unplayed = gameIds.find(id => !started.includes(id) && !(progress.games?.[id]?.plays > 0) &&
    !suggestions.some(item => item.gameId === id));
  if (unplayed) suggestions.push({ kind: 'new', gameId: unplayed,
    label: 'はじめての挑戦', reason: 'まだあそんでいないゲームを試そう。', action: 'このゲームを試す' });
  return suggestions.slice(0, 3);
}
