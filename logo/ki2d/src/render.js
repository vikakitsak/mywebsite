const {chromium}=require('playwright');const fs=require('fs');
const [a,b]=(process.argv[2]||'0,360').split(',').map(Number);const dir=process.argv[3]||__dirname+'/frames';fs.mkdirSync(dir,{recursive:true});
(async()=>{const br=await chromium.launch();const p=await br.newPage({viewport:{width:1920,height:1080}});p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/index.html');await p.waitForFunction('window.ready');
const list=process.argv[4]?process.argv[4].split(',').map(Number):Array.from({length:b-a},(_,k)=>a+k);
for(const f of list){await p.evaluate(f=>window.renderFrame(f),f);const d=await p.evaluate(()=>window.grab());fs.writeFileSync(`${dir}/f${String(f).padStart(4,'0')}.png`,Buffer.from(d.split(',')[1],'base64'));}
await br.close();console.log('DONE',list.length);})();
