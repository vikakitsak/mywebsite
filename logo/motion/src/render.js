const {chromium}=require('playwright');const fs=require('fs');
const [a,b,step]=process.argv.slice(2).map(Number);const dir=__dirname+'/frames';fs.mkdirSync(dir,{recursive:true});
(async()=>{const br=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await br.newPage({viewport:{width:1920,height:1080}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/index.html');await p.waitForFunction('window.ready',null,{timeout:60000});
for(let f=a;f<b;f+=step){const fn=`${dir}/f${String(f).padStart(4,'0')}.jpg`;if(fs.existsSync(fn))continue;
await p.evaluate(f=>window.renderFrame(f,7),f);const d=await p.evaluate(()=>window.grab(0.95));fs.writeFileSync(fn,Buffer.from(d.split(',')[1],'base64'));
if(f%60<step)console.log('frame',f,new Date().toISOString());}
await br.close();console.log('DONE',a,step);})();
