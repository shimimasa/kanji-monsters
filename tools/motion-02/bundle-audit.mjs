import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const [baseline,out]=process.argv.slice(2);if(!baseline||!out)throw Error('baseline dist and output required');
function files(dir){return fs.readdirSync(path.join(dir,'assets')).filter(n=>/\.(js|css)$/.test(n)).map(name=>{const b=fs.readFileSync(path.join(dir,'assets',name));return{name,bytes:b.length,gzip:zlib.gzipSync(b).length,sha256:crypto.createHash('sha256').update(b).digest('hex')};});}
const before=files(baseline),after=files('dist'),sum=a=>a.filter(f=>f.name.endsWith('.js')).reduce((x,f)=>({bytes:x.bytes+f.bytes,gzip:x.gzip+f.gzip}),{bytes:0,gzip:0});
const oldMain=before.find(f=>/^index-.*\.js$/.test(f.name)),newMain=after.find(f=>/^index-.*\.js$/.test(f.name));
const data={baseline,baselineFiles:before,currentFiles:after,mainDelta:{bytes:newMain.bytes-oldMain.bytes,gzip:newMain.gzip-oldMain.gzip},totalJS:{before:sum(before),after:sum(after)},note:'gzip is local default zlib reference, not measured HTTP transfer. No performance claim.'};
fs.writeFileSync(out,JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));
