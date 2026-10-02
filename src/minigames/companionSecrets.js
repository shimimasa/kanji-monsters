// ひみつノート (2026-10-02): as なかよし grows, a companion tells more about itself, from the data
// every Gotomon already has. Opened by なかよし, which only grows, so a secret never closes again.
// A tier whose text is missing in the data is skipped (a few Gotomon lack one field).
export const SECRET_TIERS = Object.freeze([
  Object.freeze({ key: 'home', label: 'ふるさと', at: 0, text: m => m?.prefecture }),
  Object.freeze({ key: 'catchphrase', label: 'くちぐせ', at: 5, text: m => m?.catchphrase }),
  Object.freeze({ key: 'habitat', label: 'すみか・なかま', at: 12, text: m => [m?.habitat, m?.category].filter(Boolean).join(' · ') }),
  Object.freeze({ key: 'desc', label: 'しょうかい', at: 25, text: m => m?.desc }),
  Object.freeze({ key: 'trivia', label: 'まめちしき', at: 40, text: m => m?.trivia }),
]);

const friendshipOf = friend => (Number.isSafeInteger(friend?.friendship) && friend.friendship > 0 ? friend.friendship : 0);

// The notebook of one companion: every tier with its text, open or not yet.
export function secretsFor(monster, friend) {
  const friendship = friendshipOf(friend);
  return SECRET_TIERS.map(tier => ({ tier, text: String(tier.text(monster) ?? '').trim() }))
    .filter(({ text }) => text)
    .map(({ tier, text }) => Object.freeze({ key: tier.key, label: tier.label, at: tier.at, open: friendship >= tier.at, text, friendship }));
}

// The tiers a change of なかよし opened (for the result screen).
export function openedSecrets(monster, before, after) {
  const was = friendshipOf(before), now = friendshipOf(after);
  return secretsFor(monster, after).filter(secret => secret.at > was && secret.at <= now).map(secret => secret.label);
}
