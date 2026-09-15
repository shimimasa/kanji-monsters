// Content QA only: do not poll the large archive/artifacts tree. Production config
// and frozen child-playtest servers are deliberately left untouched.
import { createServer } from 'vite';
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:5188,strictPort:true,watch:null}});
await server.listen();server.printUrls();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
