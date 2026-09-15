// Read the frozen commit without checking it out or altering its refs/worktree.
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
export const BASELINE='a9cb2b294e68229b31805a46666d2249ff273ac3';
const urls=new Map();
function moduleUrl(file) {
  if(urls.has(file))return urls.get(file);
  if(!file.startsWith('src/minigames/'))throw new Error(`Unexpected baseline module ${file}`);
  let source=execFileSync('git',['show',`${BASELINE}:${file}`],{maxBuffer:8*1024*1024}).toString();
  source=source.replace(/from\s+(['"])(\.[^'"]+)\1/g,(whole,quote,specifier)=>
    `from ${quote}${moduleUrl(posix.normalize(posix.join(posix.dirname(file),specifier)))}${quote}`);
  const url='data:text/javascript;base64,'+Buffer.from(source).toString('base64');urls.set(file,url);return url;
}
export const loadBaseline = file => import(moduleUrl(file));
