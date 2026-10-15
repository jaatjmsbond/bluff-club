const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const game=require('./game.cjs');
const DAY=86400000;
function createApp(options={}) {
  const dir=options.dataDir||process.env.DATA_DIR||path.join(__dirname,'data');
  fs.mkdirSync(dir,{recursive:true});
  // A new file preserves any older administrator/account data during this update.
  const file=path.join(dir,'guest-rooms.json');
  const db=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{guests:{},rooms:{}};
  const limits=new Map();let lastCleanup=0;
  const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(db));fs.renameSync(file+'.tmp',file)};
  const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
  const cleanText=(v,min,max,label)=>{if(typeof v!=='string')throw Error('Enter '+label+'.');const s=v.normalize('NFKC').trim().replace(/\s+/g,' ');if(s.length<min||s.length>max||/[\u0000-\u001F\u007F]/.test(s))throw Error(label+' must be '+min+'–'+max+' characters.');return s};
  const roomView=(r,u)=>({code:r.code,name:r.name,host:r.host,players:r.players,game:r.game?game.view(r.game,u.id):null});
  function rate(key,max=30,window=60000){const now=Date.now();let value=limits.get(key);if(!value||now-value.since>window){value={n:0,since:now};limits.set(key,value)}if(++value.n>max){const e=Error('Too many attempts. Wait a minute and try again.');e.status=429;throw e}}
  function cleanup(){const now=Date.now();if(now-lastCleanup<60000)return;lastCleanup=now;let changed=false;for(const [k,u] of Object.entries(db.guests))if(u.expires<now){delete db.guests[k];changed=true}for(const [k,r] of Object.entries(db.rooms))if(now-r.lastActive>DAY){delete db.rooms[k];changed=true}for(const [k,v] of limits)if(now-v.since>600000)limits.delete(k);if(changed)save()}
  return http.createServer(async(req,res)=>{
    const origin=process.env.PUBLIC_ORIGIN;
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Vary','Origin')}
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    const url=new URL(req.url,'http://localhost');
    const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
    try{
      if(!url.pathname.startsWith('/api/')){
        if(req.method!=='GET'){res.writeHead(405);return res.end('Method not allowed')}
        const asset=url.pathname==='/'?'index.html':url.pathname.slice(1);
        if(!['index.html','app.js','style.css','game.js'].includes(asset)){res.writeHead(404);return res.end('Not found')}
        res.setHeader('Content-Type',asset.endsWith('.html')?'text/html; charset=utf-8':asset.endsWith('.css')?'text/css':'text/javascript; charset=utf-8');
        return res.end(fs.readFileSync(path.join(__dirname,'public',asset)));
      }
      cleanup();let body={};
      if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Request too large.')}body=JSON.parse(raw||'{}')}
      else if(req.method!=='GET')return send({error:'Method not allowed.'},405);
      const post=()=>{if(req.method!=='POST'){const e=Error('POST required.');e.status=405;throw e}};
      if(url.pathname==='/api/status')return send({ok:true,mode:'guest-rooms',accountsRequired:false});
      if(url.pathname==='/api/guest'){
        post();rate('guest:'+req.socket.remoteAddress,30);
        if(Object.keys(db.guests).length>=5000)throw Error('Server is busy. Try again later.');
        const name=cleanText(body.name,2,20,'Your name'),token=crypto.randomBytes(32).toString('hex');
        const u={id:crypto.randomUUID(),name,expires:Date.now()+7*DAY};db.guests[digest(token)]=u;save();
        return send({token,user:{id:u.id,name:u.name}});
      }
      const token=(req.headers.authorization||'').replace(/^Bearer /,''),key=digest(token),u=db.guests[key];
      if(!u||u.expires<Date.now())return send({error:'Your guest session has ended. Enter your name to play again.',resetGuest:true},401);
      if(url.pathname==='/api/me')return send({user:{id:u.id,name:u.name}});
      if(url.pathname==='/api/logout'){post();delete db.guests[key];save();return send({ok:true})}
      if(url.pathname==='/api/rooms'){
        if(req.method==='POST'){
          rate('create:'+u.id,10);const owned=Object.values(db.rooms).filter(r=>r.host===u.id);
          if(owned.length>=10||Object.keys(db.rooms).length>=500)throw Error('Too many rooms. Leave an unused room first.');
          const name=cleanText(body.name,3,32,'Room name');let code;
          do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(db.rooms[code]);
          const r={code,name,host:u.id,players:[{id:u.id,name:u.name}],game:null,lastActive:Date.now()};
          db.rooms[code]=r;save();return send(roomView(r,u));
        }
        return send({rooms:Object.values(db.rooms).filter(r=>r.players.some(p=>p.id===u.id)).map(r=>({code:r.code,name:r.name,started:!!r.game,players:r.players.length}))});
      }
      const match=url.pathname.match(/^\/api\/rooms\/([A-F0-9]{6})(?:\/(join|start|action|leave))?$/);
      if(!match)return send({error:'Not found.'},404);
      const command=match[2];if(command)post();
      if(command==='join')rate('join:'+u.id,20);
      const r=db.rooms[match[1]];
      if(!r)return send({error:'Room not found. It may have expired or the server restarted. Create a new room.',roomGone:true},404);
      const member=r.players.some(p=>p.id===u.id);
      if(command==='join'&&!member){
        if(typeof body.name!=='string'||cleanText(body.name,3,32,'Room name').toLowerCase()!==r.name.toLowerCase())throw Error('Room name does not match. Check it with your friend.');
        if(r.game||r.players.length>=4)throw Error('Room is full or the game has already started.');
        if(r.players.some(p=>p.name.toLowerCase()===u.name.toLowerCase()))throw Error('That player name is already in this room. Choose a different name.');
        r.players.push({id:u.id,name:u.name});r.lastActive=Date.now();save();
      }
      if(!member&&command!=='join')return send({error:'Join this room first.'},403);
      if(command==='leave'){
        if(r.game&&!r.game.winner)throw Error('Finish the game before leaving your seat. You can return to the lobby and resume.');
        r.players=r.players.filter(p=>p.id!==u.id);r.game=null;
        if(!r.players.length)delete db.rooms[r.code];else if(r.host===u.id)r.host=r.players[0].id;
        save();return send({ok:true});
      }
      if(command==='start'){
        if(r.host!==u.id)throw Error('Only the room host can deal.');
        if(r.players.length<2)throw Error('Wait for at least one friend to join.');
        if(r.game&&!r.game.winner)throw Error('Game already running.');
        r.game=game.start(r.players);r.lastActive=Date.now();save();
      }
      if(command==='action'){
        if(!r.game)throw Error('Game has not started.');
        if(body.revision!==r.game.revision)return send({error:'Table changed. Try again.'},409);
        game.act(r.game,u.id,body);r.lastActive=Date.now();save();
      }
      if(Date.now()-r.lastActive>60000){r.lastActive=Date.now();save()}
      return send(roomView(r,u));
    }catch(e){send({error:e.message},e.status||400)}
  });
}
if(require.main===module)createApp().listen(process.env.PORT||3000,()=>console.log('Bluff Club guest-room server ready'));
module.exports={createApp};
