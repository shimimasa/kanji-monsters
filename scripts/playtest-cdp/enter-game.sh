# usage: bash scripts/playtest-cdp/enter-game.sh <gameId> [<select aria-label> <value>]
# Opens the site, goes to the mini-game hub, opens the game's card, optionally sets one of
# its start options (e.g. "とびらのもんだい" math, "けいさんのもんだい" times), and presses スタート.
# Needs the preview on :4173 and headless Chrome on :9333 (see README.md).
cd "$(dirname "$0")"
node cdp.mjs nav http://127.0.0.1:4173/ >/dev/null
for i in 1 2 3 4 5 6; do r=$(node cdp.mjs eval "!![...document.querySelectorAll('button')].find(b=>b.textContent.includes('ミニゲーム広場へ'))" | tr -d '"'); [ "$r" = true ] && break; sleep 0.5; done
node cdp.mjs eval "document.querySelectorAll('button').forEach(b=>{if(b.textContent.includes('スキップ'))b.click()}); [...document.querySelectorAll('button')].find(b=>b.textContent.includes('ミニゲーム広場へ'))?.click(); 'ok'" >/dev/null
sleep 0.3
# The square opens on the tab last chosen: show every game first.
node tapnow.mjs "document.querySelector('.yt-subject-tab[data-subject=all]')" >/dev/null
sleep 0.3
node tapnow.mjs "(()=>{const c=document.querySelector('[data-game-id=$1]'); c?.scrollIntoView({block:'center'}); return c?.querySelector('button')||c})()" >/dev/null
sleep 0.3
if [ -n "$2" ]; then
  node cdp.mjs eval "(()=>{const s=document.querySelector('select[aria-label=$2]');if(s){s.value='$3';s.dispatchEvent(new Event('change'))};return !!s})()" >/dev/null
fi
node tapnow.mjs "(()=>{const b=document.querySelector('[data-action=start-game]'); b?.scrollIntoView({block:'center'}); return b})()" >/dev/null
sleep 0.6
node tapnow.mjs "[...document.querySelectorAll('#$1Screen button')].find(b=>b.textContent.includes('スタート'))" >/dev/null
sleep 0.8
