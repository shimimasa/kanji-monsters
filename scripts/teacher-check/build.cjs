const fs = require('fs');
const path = require('path');
const dir = __dirname;
let t = fs.readFileSync(path.join(dir, 'page.tpl.html'), 'utf8');
const d = fs.readFileSync(path.join(dir, 'data.json'), 'utf8')
  .split('<').join('\\u003c')
  .split(' ').join('\\u2028')
  .split(' ').join('\\u2029');
t = t.replace("b.role = 'tab';", "b.setAttribute('role', 'tab');").replace('__DATA__', () => d);
fs.writeFileSync(path.join(dir, 'teacher-check.html'), t);
const js = t.split('<script>')[1].split('</script>')[0];
new Function(js);
const DATA = JSON.parse(d.split('\\u003c').join('<'));
console.log('ok', t.length, Object.entries(DATA).map(([k, v]) => `${k}:${v.length}`).join(' '));
