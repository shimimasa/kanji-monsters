const GOALS = Object.freeze([
  { id: 'arc', name: '左の星座を完成', deadline: 4, route: 0,
    rule: '4問目までに左の星座を完成させよう。', hint: '左に光を集めよう。部分正解でも少しずつ進めるよ。' },
  { id: 'spread', name: '3つにライン', deadline: 6, route: 1,
    rule: '6問目までに3つの星座すべてでラインを1本つなごう。', hint: '星3つでライン1本。つながったら別の星座へ光を送ろう。' },
  { id: 'crown', name: '右から完成', deadline: 4, route: 2,
    rule: '4問目までに右の星座を、3つの中で最初に完成させよう。', hint: '右は全部正解で大きく進むよ。光を集めて先に完成させよう。' },
]);
const RESERVE_GOAL = Object.freeze({ id: 'reserve', name: '光を2回届ける', deadline: 8, route: 1,
  rule: '2回続けて正解し、蓄えた光を星座へ2回流そう。', hint: '行き先の星座を選んでから光を流せる。' });

export function createConstellationChallenge(special = false) {
  const goals = special ? [RESERVE_GOAL, ...GOALS] : GOALS;
  let selected = special ? RESERVE_GOAL : GOALS[1], answered = 0, status = 'active', progress = '', achievedAt = null;
  return {
    choose(id) {
      const goal = goals.find(goal => goal.id === id);
      if (answered || !goal) return null;
      selected = goal; return goal.route;
    },
    observe({ routes, lines, firstFinished, count, released = 0 }) {
      answered = count;
      const met = selected.id === 'reserve' ? released >= 2 : selected.id === 'spread' ? lines.every(value => value >= 1) :
        selected.id === 'arc' ? routes[0] >= 6 : routes[2] >= 6 && firstFinished === 2;
      progress = selected.id === 'reserve' ? `${Math.min(2,released)}/2回` : selected.id === 'spread' ? `${lines.filter(value => value >= 1).length}/3つにライン` :
        `${Math.min(6, routes[selected.route]).toFixed(1)}/6つの星`;
      if (status !== 'active') return;
      if (met && count <= selected.deadline) { status = 'achieved'; achievedAt = count; }
      else if (count >= selected.deadline || (selected.id === 'crown' && firstFinished !== null && firstFinished !== 2)) status = 'missed';
    },
    snapshot() {
      return { id: selected.id, name: selected.name, rule: selected.rule, hint: selected.hint,
        status, progress, achievedAt, remaining: Math.max(0, selected.deadline - answered), canChoose: answered === 0,
        choices: goals.map(goal => ({ id: `star-goal-${goal.id}`, label: goal.name, hint: goal.rule,
          selected: goal.id === selected.id, enabled: answered === 0 })),
        message: status === 'achieved' ? `目標達成！ ${achievedAt}問目で「${selected.name}」` :
          status === 'missed' ? `「${selected.name}」は次の挑戦へ。残りの問題で星空を広げよう。` : `${selected.rule} あと${selected.deadline - answered}問。`,
        next: status === 'achieved' ? '次は別の目標を選んで、光の送り方を変えてみよう。' : selected.hint };
    },
  };
}
