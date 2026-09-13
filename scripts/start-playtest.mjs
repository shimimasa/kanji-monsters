import { build, preview } from 'vite';
import { fileURLToPath } from 'node:url';

// A local-only, frozen, bundled test build avoids dev-module loading affecting play.
// Never writes dist or changes the normal production configuration.
const enabled=process.argv.includes('--record');
process.env.VITE_PLAYTEST_LOGGER=enabled?'1':'0';
const root=fileURLToPath(new URL('../',import.meta.url));
const outDir=enabled?'artifacts/child-playtest-app-on':'artifacts/child-playtest-app-off';
const config={root,mode:'child-playtest',build:{outDir},preview:{host:'127.0.0.1',port:enabled?5181:5182,strictPort:true}};
await build(config);
const server=await preview(config);server.printUrls();
console.log(`Playtest logger ${enabled?'AVAILABLE (operator start still required)':'OFF'}; restart after code changes.`);
process.once('SIGINT',()=>server.httpServer.close(()=>process.exit(0)));
