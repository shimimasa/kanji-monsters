// Shared look for real-time mini-games. Game-specific scenery lives in each view.
export const ARCADE_CSS = `
.ya-arcade{position:fixed;inset:0;z-index:100010;display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain;touch-action:manipulation;
  font-family:"UDデジタル教科書体","Hiragino Sans",system-ui,sans-serif;color:#fff;background:#0f2530;-webkit-user-select:none;user-select:none}
.ya-arcade *{box-sizing:border-box}.ya-arcade [hidden]{display:none!important}
.ya-arcade[data-completed=true]{overflow:auto;background:#f4f3e5;color:#17362f}
.ya-arcade[data-completed=true] .ya-stage{display:none}
.ya-shell{display:flex;flex-direction:column;min-height:100%;flex:1}
.ya-arcade[data-completed=false] .ya-shell{height:100%}
.ya-header{display:flex;align-items:center;gap:8px;min-height:50px;padding:4px max(10px,env(safe-area-inset-right)) 4px max(12px,env(safe-area-inset-left));background:#0008;color:#fff;z-index:5}
.ya-header h1{flex:1;margin:0;font-size:clamp(17px,2.6vw,24px);letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ya-arcade[data-completed=true] .ya-header{background:#17362f}
.ya-arcade .ya-header button,.ya-arcade .gt-header-actions button{min-height:40px!important;min-width:44px;padding:6px 12px!important;border-radius:10px!important;border:1px solid #ffffff60!important;background:#ffffff1c!important;color:#fff!important;font:inherit;font-size:14px!important;box-shadow:none!important;cursor:pointer}
.ya-arcade .gt-header-actions{display:flex;gap:6px;margin:0}
.ya-arcade .gt-sound{position:absolute;right:10px;top:52px;z-index:30;background:#fffdf6;color:#17362f;border-radius:12px;padding:10px;box-shadow:0 8px 24px #0006}
.ya-stage{flex:1;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;gap:0}
@media (min-width:900px) and (min-aspect-ratio:5/4){.ya-stage{grid-template-rows:none;grid-template-columns:minmax(0,1fr) clamp(300px,28vw,380px)}}
.ya-field{position:relative;overflow:hidden;min-height:220px;isolation:isolate}
.ya-world{position:absolute;inset:0}
.ya-fx{position:absolute;inset:0;pointer-events:none;z-index:8}
.ya-dock{position:relative;z-index:6;display:flex;flex-direction:column;gap:8px;justify-content:center;padding:10px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:linear-gradient(#10202bf2,#0b1820f7);box-shadow:0 -6px 24px #0005}
.ya-hud{position:absolute;left:0;right:0;top:0;z-index:7;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 10px;pointer-events:none}
.ya-hud-left,.ya-hud-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ya-hud-right{justify-content:flex-end}
.ya-score-box{display:flex;align-items:baseline;gap:3px;background:#0009;border-radius:12px;padding:3px 12px;text-shadow:0 2px 0 #0006}
.ya-score{font-size:clamp(22px,3.4vw,32px);font-variant-numeric:tabular-nums;line-height:1.1}.ya-score-box small{font-size:13px;opacity:.85}
.ya-combo{font-weight:900;font-size:clamp(15px,2.2vw,20px);padding:3px 12px;border-radius:99px;background:#f7c85c;color:#3d2600;box-shadow:0 3px 0 #a0701a}
.ya-combo[data-level=warm]{background:#ffab3d}.ya-combo[data-level=hot]{background:linear-gradient(90deg,#ff7a59,#ffcf4d);color:#3a0f00}
.ya-progress{position:relative;min-width:120px;height:26px;border-radius:99px;background:#0009;overflow:hidden;border:1px solid #ffffff40}
.ya-progress i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#5ad1a0,#b9f27a);transition:width .25s}
.ya-progress span{position:relative;display:block;text-align:center;font-size:13px;font-weight:800;line-height:24px;padding:0 10px;text-shadow:0 1px 2px #000}
.ya-lives{display:flex;align-items:center;gap:3px;background:#0009;border-radius:99px;padding:3px 10px}
.ya-lives small{font-size:12px;margin-right:3px}.ya-lives i{width:14px;height:14px;border-radius:4px;background:#ffffff30;border:1px solid #ffffff70}
.ya-lives i.on{background:#7fe0ff;box-shadow:0 0 8px #7fe0ff}
.ya-gauge{display:flex;align-items:center;gap:3px;background:#0009;border-radius:99px;padding:3px 10px}
.ya-gauge span{font-size:12px;margin-right:3px}.ya-gauge i{width:14px;height:14px;border-radius:50%;background:#ffffff30;border:1px solid #ffffff80}
.ya-gauge i.on{background:#ffd54a;box-shadow:0 0 8px #ffd54a}
.ya-gauge[data-fever=true]{background:linear-gradient(90deg,#ff7a59,#ffcf4d);color:#3a0f00;animation:ya-glow .6s ease-in-out infinite alternate}
.ya-mission{font-size:12px;font-weight:800;background:#0009;border-radius:99px;padding:5px 10px;max-width:40vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ya-mission[data-done=true]{background:#2f9e6b}
.ya-bump{animation:ya-bump .32s ease-out}
.ya-pause-veil{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:#0008;font-size:clamp(22px,4vw,34px);font-weight:900;letter-spacing:.1em}
.ya-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.ya-entry{display:flex;align-items:center;justify-content:center;gap:10px;min-height:64px;border-radius:14px;background:#fff;color:#16242c;font-size:clamp(30px,5vw,44px);font-weight:900;font-variant-numeric:tabular-nums;box-shadow:inset 0 -4px 0 #0002}
.ya-entry[data-empty=true]::after{content:'';width:3px;height:1em;background:#16242c;animation:ya-caret 1s steps(1) infinite}
.ya-entry[data-empty=true] span{color:#8aa0ad;font-size:.5em;font-weight:700}
.ya-entry.ya-miss{animation:ya-nudge .35s ease-out;background:#ffe6b3}
.ya-dock-note{margin:0;min-height:1.5em;text-align:center;font-size:15px;font-weight:700;color:#d8e8f0}
.ya-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.ya-pad button{min-height:clamp(46px,7.2vh,62px);border:0;border-radius:12px;background:#f5f8fa;color:#16242c;font:inherit;font-size:clamp(22px,3.4vw,28px);font-weight:900;box-shadow:0 4px 0 #9fb3bf;cursor:pointer;touch-action:manipulation}
.ya-pad button:active{transform:translateY(3px);box-shadow:0 1px 0 #9fb3bf}
.ya-pad .ya-pad-del{font-size:17px;background:#dfe7ec}
.ya-pad .ya-pad-fire{background:#ffb627;color:#3a2400;box-shadow:0 4px 0 #b57500;font-size:clamp(18px,2.8vw,24px)}
.ya-pad button:disabled{opacity:.5}
.ya-arcade button:focus-visible{outline:3px solid #ffd54a!important;outline-offset:2px}
.ya-fx-item{position:absolute;transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap}
.ya-pop{font-weight:900;font-size:clamp(18px,2.6vw,26px);text-shadow:0 2px 0 #0008,0 0 10px #0006;animation:ya-pop 1.1s ease-out forwards}
.ya-tone-good{color:#fff27a}.ya-tone-great{color:#ffb2f0}.ya-tone-soft{color:#ffd9a0}.ya-tone-info{color:#bff1ff}
.ya-banner{font-weight:900;font-size:clamp(30px,6vw,60px);letter-spacing:.06em;text-shadow:0 4px 0 #0007,0 0 24px #000a;animation:ya-banner 1.5s ease-out forwards;z-index:3}
.ya-burst{width:0;height:0;animation:ya-fade .7s ease-out forwards}
.ya-burst i{position:absolute;left:0;top:0;width:calc(12px * var(--size,1));height:calc(12px * var(--size,1));margin:calc(-6px * var(--size,1));border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor;transform:rotate(var(--a)) translateX(0);animation:ya-spark .6s ease-out forwards}
.ya-beam{height:6px;margin-top:-3px;transform-origin:0 50%;border-radius:6px;background:linear-gradient(90deg,#fff,currentColor);box-shadow:0 0 14px currentColor;animation:ya-fade .35s ease-out forwards;translate:0 0}
.ya-beam.ya-fx-item{transform:none}
.ya-shake{animation:ya-shake .35s ease-out}
.ya-flash-good::after,.ya-flash-soft::after,.ya-flash-great::after{content:'';position:absolute;inset:0;z-index:9;pointer-events:none;animation:ya-fade .45s ease-out forwards}
.ya-flash-good::after{background:#fff6}.ya-flash-soft::after{background:#ffb34755}.ya-flash-great::after{background:radial-gradient(circle,#fff9 0,#ffd54a55 60%,transparent)}
.ya-intro{position:absolute;inset:0;z-index:40;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 30%,#1c4a57ee,#0b1c24f5)}
.ya-intro-card{width:min(560px,100%);max-height:100%;overflow:auto;border-radius:22px;background:#fffdf6;color:#17362f;padding:20px 22px;box-shadow:0 14px 40px #000a;text-align:center}
.ya-intro-icon{display:grid;place-items:center;width:72px;height:72px;margin:0 auto 6px;border-radius:20px;background:var(--accent,#177a69);color:#fff;font-size:40px}
.ya-intro h2{margin:4px 0 2px;font-size:clamp(24px,4vw,32px)}.ya-intro-tagline{margin:0 0 12px;font-weight:700;color:#3f5d55}
.ya-intro ol{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px;text-align:left}
.ya-intro li{display:flex;gap:10px;align-items:flex-start;background:#f2f7eb;border-radius:12px;padding:9px 12px;font-size:15px;line-height:1.5}
.ya-intro li b{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent,#177a69);color:#fff;font-size:14px}
.ya-intro-meta{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 14px}
.ya-intro-meta span{font-size:13px;font-weight:800;border-radius:99px;padding:4px 10px;background:#e8efe4}
.ya-intro-meta .ya-pace-slow{background:#dff0ff;color:#174a7a}
.ya-intro-start{width:100%;min-height:58px;border:0;border-radius:16px;background:var(--accent,#177a69);color:#fff;font:inherit;font-size:24px;font-weight:900;box-shadow:0 5px 0 #0004;cursor:pointer}
.ya-intro-start:active{transform:translateY(3px);box-shadow:0 2px 0 #0004}
.ya-intro-note{margin:10px 0 0;font-size:12px;color:#5b7069}
@keyframes ya-pop{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}15%{opacity:1;transform:translate(-50%,-60%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-190%) scale(1)}}
@keyframes ya-banner{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}14%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}24%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-70%) scale(1)}}
@keyframes ya-spark{to{transform:rotate(var(--a)) translateX(calc(48px * var(--size,1))) scale(.2);opacity:0}}
@keyframes ya-fade{to{opacity:0}}
@keyframes ya-shake{0%,100%{transform:none}20%{transform:translate(-7px,2px)}40%{transform:translate(6px,-2px)}60%{transform:translate(-4px,1px)}80%{transform:translate(3px,0)}}
@keyframes ya-bump{0%{transform:scale(1)}40%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes ya-nudge{0%,100%{transform:none}30%{transform:translateX(-8px)}60%{transform:translateX(6px)}}
@keyframes ya-caret{50%{opacity:0}}
@keyframes ya-glow{from{box-shadow:0 0 4px #ffcf4d}to{box-shadow:0 0 16px #ffcf4d}}
/* The shell also tags this root .yt-game, and minigame-shell.css / growth-gameplay.css
   restyle every .yt-game (some by #id) as a light 920px page. Win back the arcade frame. */
.ya-arcade{background:#0f2530!important;color:#fff!important;padding:0!important}
.ya-arcade[data-completed=true]{background:#f4f3e5!important;color:#17362f!important}
.ya-arcade>.ya-shell{max-width:none!important;margin:0!important}
.ya-arcade .ya-header{background:#0008!important;padding:4px max(10px,env(safe-area-inset-right)) 4px max(12px,env(safe-area-inset-left))!important;border-bottom:0!important}
.ya-arcade[data-completed=true] .ya-header{background:#17362f!important}
.ya-arcade .ya-header h1{color:inherit!important;font-size:clamp(17px,2.6vw,24px)!important}
@media (max-height:560px){.ya-header{min-height:42px}.ya-pad button{min-height:40px;font-size:20px}.ya-entry{min-height:48px;font-size:28px}.ya-dock{gap:5px;padding-top:6px}}
@media (prefers-reduced-motion:reduce){.ya-arcade *,.ya-arcade *::after{animation:none!important;transition:none!important}.ya-burst,.ya-beam{display:none}}
`;
