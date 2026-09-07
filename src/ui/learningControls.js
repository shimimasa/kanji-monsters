import { getContainedRect, gameUnitsForCssPixels } from './viewportLayout.js';
import { drawStoneButton } from './uiRenderer.js';
import { gameToScreenCoordinates } from '../utils/coordinateUtils.js';

/** Rectangles are shared by rendering and hit testing; sizes are CSS pixels. */
export function getLearningControls(canvas) {
  const rect = canvas.getBoundingClientRect?.() || {left:0,top:0,width:800,height:600};
  const {scale} = getContainedRect(rect, canvas.width, canvas.height);
  const h = Math.max(48, Math.ceil(gameUnitsForCssPixels(44, scale)));
  const compact = scale < 0.8;
  const y = compact ? canvas.height - h - 10 : 380;
  return {
    compact, scale,
    back: {x:20,y:20,w:compact?230:120,h,label:'もどる'},
    practice: {x:compact?520:20,y:compact?20:20+h+8,w:compact?260:120,h,label:'れんしゅうへ'},
    attack: {x:compact?20:230,y,w:compact?240:110,h,label:'こうげき'},
    heal: {x:compact?280:350,y,w:compact?240:110,h,label:'かいふく'},
    hint: {x:compact?540:470,y,w:compact?240:110,h,label:'ヒント'},
    submit: {x:compact?280:300,y,w:compact?240:200,h,label:'こたえる'},
    continue: {x:compact?20:140,y,w:compact?370:240,h,label:'もう1もん'},
    finish: {x:compact?410:420,y,w:compact?370:240,h,label:'今日はここまで'},
  };
}
export function drawLearningButton(ctx, b, scale = 1) {
  drawStoneButton(ctx,b.x,b.y,b.w,b.h,b.label,false,false,Math.max(18,16/scale));
}
export function placeLearningInput(canvas, input, controls = getLearningControls(canvas)) {
  if (!input) return;
  const p = gameToScreenCoordinates(canvas.width/2, controls.submit.y, canvas);
  const width = Math.min(320, canvas.width*controls.scale-24);
  Object.assign(input.style, {position:'fixed',left:`${p.x-width/2}px`,top:`${p.y-58}px`,width:`${width}px`,
    height:'48px',minHeight:'48px',fontSize:'20px',boxSizing:'border-box',transform:'none',zIndex:'1000'});
}
