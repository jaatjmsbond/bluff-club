const {test}=require('node:test'),assert=require('node:assert/strict'),Game=require('./game.cjs');
function fixture(cards){return {players:[{id:'a',name:'A',hand:cards},{id:'b',name:'B',hand:[{id:'K♠',r:'K',s:'♠'}]}],turn:0,last:null,rank:null,winner:null,log:[],revision:0}}
test('2–4 players receive unique 11-card hands',()=>{for(let n=2;n<=4;n++){let g=Game.start(Array.from({length:n},(_,i)=>({id:''+i,name:''+i})));assert.equal(new Set(g.players.flatMap(p=>p.hand.map(c=>c.id))).size,n*11);assert.ok(g.players.every(p=>p.hand.length===11))}});
test('caught bluff returns table cards to liar and objector leads',()=>{let g=fixture([{id:'A♠',r:'A',s:'♠'},{id:'2♣',r:'2',s:'♣'}]);Game.act(g,'a',{type:'play',ids:['A♠'],rank:'Q'});Game.act(g,'b',{type:'challenge'});assert.equal(g.players[0].hand.length,2);assert.equal(g.turn,1);assert.equal(g.rank,null);assert.equal(g.winner,null)});
test('false objection gives challenger the cards and original player leads',()=>{let g=fixture([{id:'A♠',r:'A',s:'♠'},{id:'2♣',r:'2',s:'♣'}]);Game.act(g,'a',{type:'play',ids:['A♠'],rank:'A'});Game.act(g,'b',{type:'challenge'});assert.equal(g.players[1].hand.length,2);assert.equal(g.turn,0);assert.equal(g.rank,null)});
test('final claim must resolve; truthful challenge and acceptance win',()=>{for(let type of ['challenge','skip','accept']){let g=fixture([{id:'A♠',r:'A',s:'♠'}]);Game.act(g,'a',{type:'play',ids:['A♠'],rank:'A'});assert.equal(g.winner,null);Game.act(g,'b',{type});assert.equal(g.winner,'a')}});
test('false final claim can be caught',()=>{let g=fixture([{id:'A♠',r:'A',s:'♠'}]);Game.act(g,'a',{type:'play',ids:['A♠'],rank:'K'});Game.act(g,'b',{type:'challenge'});assert.equal(g.winner,null);assert.equal(g.players[0].hand.length,1)});
test('skip on an empty table advances the turn without moving cards',()=>{
 const g=Game.start(['a','b','c','d'].map(id=>({id,name:id}))),before=g.players.map(p=>p.hand.map(c=>c.id));
 for(const id of ['a','b','c','d'])Game.act(g,id,{type:'skip'});
 assert.equal(g.turn,0);assert.equal(g.revision,4);assert.equal(g.pile.length,0);assert.equal(g.rank,null);assert.equal(g.winner,null);
 assert.deepEqual(g.players.map(p=>p.hand.map(c=>c.id)),before);
});
test('ordinary skip accepts the latest claim but preserves the full pile and required rank',()=>{
 const g=fixture([{id:'A♠',r:'A',s:'♠'},{id:'2♣',r:'2',s:'♣'}]);
 g.players.push({id:'c',name:'C',hand:[{id:'Q♥',r:'Q',s:'♥'},{id:'9♣',r:'9',s:'♣'}]});
 Game.act(g,'a',{type:'play',ids:['A♠'],rank:'A'});const before=g.players.map(p=>p.hand.map(c=>c.id));
 assert.throws(()=>Game.act(g,'c',{type:'skip'}));Game.act(g,'b',{type:'skip',ids:['K♠']});
 assert.equal(g.turn,2);assert.equal(g.pile.length,1);assert.equal(g.rank,'A');assert.equal(g.last,null);assert.equal(g.winner,null);
 assert.deepEqual(g.players.map(p=>p.hand.map(c=>c.id)),before);
 assert.throws(()=>Game.act(g,'c',{type:'challenge'}));assert.throws(()=>Game.act(g,'c',{type:'play',ids:['Q♥'],rank:'Q'}));
 Game.act(g,'c',{type:'play',ids:['Q♥'],rank:'A'});assert.equal(g.pile.length,2);Game.act(g,'a',{type:'challenge'});
 assert.equal(g.players[2].hand.length,3);assert.equal(g.pile.length,0);
});
test('playing after a final claim cannot silently confirm a winner',()=>{
 const g=fixture([{id:'A♠',r:'A',s:'♠'}]);Game.act(g,'a',{type:'play',ids:['A♠'],rank:'A'});
 const before=JSON.stringify(g);assert.equal(g.winner,null);
 assert.throws(()=>Game.act(g,'b',{type:'play',ids:['K♠'],rank:'A'}),/Final claim pending/);
 assert.equal(JSON.stringify(g),before);Game.act(g,'b',{type:'challenge'});assert.equal(g.winner,'a');
});
test('enforce same rank, ownership, unique cards, and turn order without mutation',()=>{let g=fixture([{id:'A♠',r:'A',s:'♠'},{id:'2♣',r:'2',s:'♣'}]);let before=JSON.stringify(g);for(let a of [{type:'play',ids:['A♠','A♠'],rank:'A'},{type:'play',ids:['J♠'],rank:'A'}])assert.throws(()=>Game.act(g,'a',a));assert.equal(JSON.stringify(g),before);assert.throws(()=>Game.act(g,'b',{type:'play',ids:['K♠'],rank:'K'}));Game.act(g,'a',{type:'play',ids:['A♠'],rank:'A'});assert.throws(()=>Game.act(g,'b',{type:'play',ids:['K♠'],rank:'K'}));let v=Game.view(g,'b');assert.ok(!v.players[0].hand);assert.ok(!v.last.cards);assert.equal(v.players[1].hand.length,1)});
function fiveCardTable(truth,final=false) {
 const g=fixture([{id:'A♠',r:'A',s:'♠'},{id:'A♥',r:'A',s:'♥'},{id:'2♣',r:'2',s:'♣'},{id:'3♦',r:'3',s:'♦'}]);
 if(final)g.players[0].hand=g.players[0].hand.filter(c=>c.id!=='3♦');
 g.players[1].hand=[{id:'K♠',r:'K',s:'♠'},{id:'K♥',r:'K',s:'♥'},{id:'4♣',r:'4',s:'♣'}];
 Game.act(g,'a',{type:'play',ids:['A♠','A♥'],rank:truth?'2':'A'});
 Game.act(g,'b',{type:'play',ids:['K♠','K♥'],rank:truth?'2':'A'});
 Game.act(g,'a',{type:'play',ids:['2♣'],rank:truth?'2':'A'});
 return g;
}
test('2 + 2 + 1 cards: correct objection gives all five cards to last player',()=>{
 const g=fiveCardTable(false);assert.equal(g.pile.length,5);
 Game.act(g,'b',{type:'challenge'});
 assert.equal(g.players[0].hand.length,6);assert.equal(g.players[1].hand.length,1);
 assert.equal(g.pile.length,0);assert.equal(g.turn,1);assert.equal(g.rank,null);
 assert.equal(g.event.count,5);assert.equal(g.event.truth,false);
 assert.equal(new Set(g.players.flatMap(p=>p.hand.map(c=>c.id))).size,7);
});
test('2 + 2 + 1 cards: wrong objection gives all five cards to objector; only last play is judged',()=>{
 const g=fiveCardTable(true);Game.act(g,'b',{type:'challenge'});
 assert.equal(g.players[0].hand.length,1);assert.equal(g.players[1].hand.length,6);
 assert.equal(g.pile.length,0);assert.equal(g.turn,0);assert.equal(g.rank,null);
 assert.equal(g.event.count,5);assert.equal(g.event.truth,true);
});
test('a caught final bluff returns every table card and continues the game',()=>{
 const g=fiveCardTable(false,true);assert.equal(g.players[0].hand.length,0);assert.equal(g.winner,null);
 assert.equal(Game.view(g,'b').players[0].count,0);Game.act(g,'b',{type:'challenge'});
 assert.equal(g.winner,null);assert.equal(g.players[0].hand.length,5);assert.equal(g.players[1].hand.length,1);assert.equal(g.turn,1);assert.equal(g.pile.length,0);
 Game.act(g,'b',{type:'play',ids:['4♣'],rank:'4'});assert.equal(g.winner,null);Game.act(g,'a',{type:'skip'});assert.equal(g.winner,'b');
});
test('a wrong final objection or an explicit final skip confirms the winner',()=>{
 for(const type of ['challenge','skip']){const g=fiveCardTable(true,true);assert.equal(g.winner,null);Game.act(g,'b',{type});assert.equal(g.winner,'a');if(type==='challenge'){assert.equal(g.players[1].hand.length,6);assert.equal(g.pile.length,0)}else{assert.equal(g.players[1].hand.length,1);assert.equal(g.pile.length,5)}}
});
test('public view shows pile count and hides every unresolved table card',()=>{
 const g=fiveCardTable(false),v=Game.view(g,'b');
 assert.equal(v.pileCount,5);assert.ok(!('pile' in v));assert.ok(!v.last.cards);
 assert.ok(!v.event.revealed);assert.ok(!v.players[0].hand);
 Game.act(g,'b',{type:'challenge'});const after=Game.view(g,'b');
 assert.equal(after.pileCount,0);assert.equal(after.event.revealed.length,1);
 assert.equal(after.event.revealed[0].id,'2♣');
});
test('four-player rounds conserve all dealt cards through accepted plays and objections',()=>{
 const g=Game.start(['a','b','c','d'].map(id=>({id,name:id})));
 for(let i=0;i<240&&!g.winner;i++){
   const p=g.players[g.turn];
   if(g.last&&i%4===0)Game.act(g,p.id,{type:'challenge'});
   else if(g.last&&!g.players[g.last.by].hand.length)Game.act(g,p.id,{type:'accept'});
   else Game.act(g,p.id,{type:'play',ids:p.hand.slice(0,Math.min(2,p.hand.length)).map(c=>c.id),rank:g.rank||p.hand[0].r});
   const all=[...g.players.flatMap(p=>p.hand),...g.pile];
   assert.equal(all.length,44);assert.equal(new Set(all.map(c=>c.id)).size,44);
 }
});

async function withServer(fn){
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createApp}=require('./server.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bluff-guest-test-'));let server;
 async function open(){server=createApp({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port}
 let base=await open();
 async function request(p,b,token){const r=await fetch(base+'/api'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(b?{body:JSON.stringify(b)}:{})});return {status:r.status,data:await r.json()}}
 const guest=async name=>{const r=await request('/guest',{name});assert.equal(r.status,200);return r.data};
 try{await fn({request,guest,dir,restart:async()=>{await new Promise(r=>server.close(r));base=await open()}})}finally{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})}
}
test('guests need only a display name; room names and join codes protect entry',()=>withServer(async({request:req,guest})=>{
 assert.equal((await req('/status')).data.accountsRequired,false);
 assert.equal((await req('/guest',{name:'a'})).status,400);
 const a=await guest('Alex'),b=await guest('Sam');
 assert.equal((await req('/rooms')).status,401);
 assert.equal((await req('/rooms',{name:'x'},a.token)).status,400);
 const made=await req('/rooms',{name:'Friday Friends'},a.token);assert.equal(made.status,200);const code=made.data.code;
 assert.match(code,/^[A-F0-9]{6}$/);assert.equal(made.data.name,'Friday Friends');assert.equal(made.data.host,a.user.id);
 assert.equal((await req('/rooms/'+code,null,b.token)).status,403);
 assert.equal((await req('/rooms/'+code+'/join',{name:'Wrong room'},b.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/join',{name:' friday   friends '},b.token)).status,200);
 assert.equal((await req('/rooms/'+code+'/join',{},b.token)).data.players.length,2);
 assert.equal((await req('/rooms',null,b.token)).data.rooms[0].name,'Friday Friends');
 assert.equal((await req('/rooms',{name:'Another Room'},b.token)).status,200);
 assert.equal((await req('/rooms/FFFFFF',null,b.token)).data.roomGone,true);
}));
test('rooms enforce player limits, duplicate display names, host dealing and membership',()=>withServer(async({request:req,guest})=>{
 const people=await Promise.all(['Alex','Sam','Mira','Kabir','Fifth','alex'].map(guest));
 const [a,b,c,d,e,duplicate]=people;const code=(await req('/rooms',{name:'Four Friends'},a.token)).data.code;
 assert.equal((await req('/rooms/'+code+'/start',{},a.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/join',{name:'Four Friends'},duplicate.token)).status,400);
 for(const p of [b,c,d])assert.equal((await req('/rooms/'+code+'/join',{name:'Four Friends'},p.token)).status,200);
 assert.equal((await req('/rooms/'+code+'/join',{name:'Four Friends'},e.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/start',{},b.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/start',{},a.token)).status,200);
 assert.equal((await req('/rooms/'+code+'/start',{},a.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/leave',{},a.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/action',{revision:0,type:'challenge'},e.token)).status,403);
}));
test('guest multiplayer hides hands, rejects stale moves and restores seats across server restarts',()=>withServer(async({request:req,guest,dir,restart})=>{
 const a=await guest('Alex'),b=await guest('Sam');const code=(await req('/rooms',{name:'Card Night'},a.token)).data.code;
 await req('/rooms/'+code+'/join',{name:'Card Night'},b.token);
 const started=(await req('/rooms/'+code+'/start',{},a.token)).data.game;
 assert.equal(started.players[0].hand.length,11);assert.ok(!started.players[1].hand);
 const card=started.players[0].hand[0],move={type:'play',ids:[card.id],rank:'A',revision:0};
 assert.equal((await req('/rooms/'+code+'/action',move,b.token)).status,400);
 assert.equal((await req('/rooms/'+code+'/action',move,a.token)).status,200);
 assert.equal((await req('/rooms/'+code+'/action',move,a.token)).status,409);
 const other=(await req('/rooms/'+code,null,b.token)).data.game;
 assert.ok(!other.players[0].hand);assert.ok(!other.last.cards);assert.ok(!other.pile);assert.equal(other.pileCount,1);
 const saved=require('node:fs').readFileSync(require('node:path').join(dir,'guest-rooms.json'),'utf8');
 assert.ok(!saved.includes(a.token));assert.ok(!saved.includes(b.token));
 await restart();assert.equal((await req('/me',null,a.token)).data.user.id,a.user.id);
 const resumed=(await req('/rooms/'+code,null,a.token)).data;
 assert.equal(resumed.game.revision,1);assert.equal(resumed.game.players[0].hand.length,10);
 assert.equal((await req('/rooms/'+code+'/join',{},b.token)).data.players.length,2);
}));
test('leaving a waiting room transfers the host and removes empty rooms',()=>withServer(async({request:req,guest})=>{
 const a=await guest('Alex'),b=await guest('Sam');const code=(await req('/rooms',{name:'New Host'},a.token)).data.code;
 await req('/rooms/'+code+'/join',{name:'New Host'},b.token);
 assert.equal((await req('/rooms/'+code+'/leave',{},a.token)).status,200);
 const r=(await req('/rooms/'+code,null,b.token)).data;assert.equal(r.host,b.user.id);assert.equal(r.players.length,1);
 assert.equal((await req('/rooms/'+code,null,a.token)).status,403);
 assert.equal((await req('/rooms/'+code+'/leave',{},b.token)).status,200);
 assert.equal((await req('/rooms/'+code,null,b.token)).status,404);
}));
test('lost guest sessions return a recoverable error instead of requiring accounts',()=>withServer(async({request:req,guest})=>{
 const a=await guest('Alex');assert.equal((await req('/logout',{},a.token)).status,200);
 const gone=await req('/me',null,a.token);assert.equal(gone.status,401);assert.equal(gone.data.resetGuest,true);
 const again=await guest('Alex');assert.notEqual(a.user.id,again.user.id);
 assert.equal((await req('/rooms',{name:'Fresh Room'},again.token)).status,200);
}));

test('multiplayer skip obeys turn/revision checks and preserves saved hands and pile',()=>withServer(async({request:req,guest,restart})=>{
 const a=await guest('Alex'),b=await guest('Sam');const code=(await req('/rooms',{name:'Skip Night'},a.token)).data.code;
 await req('/rooms/'+code+'/join',{name:'Skip Night'},b.token);await req('/rooms/'+code+'/start',{},a.token);
 const endpoint='/rooms/'+code+'/action';assert.equal((await req(endpoint,{type:'skip',revision:0},b.token)).status,400);
 const first=(await req(endpoint,{type:'skip',revision:0},a.token)).data.game;assert.equal(first.turn,1);assert.equal(first.players[0].hand.length,11);assert.equal(first.pileCount,0);
 assert.equal((await req(endpoint,{type:'skip',revision:0},a.token)).status,409);
 const state=(await req('/rooms/'+code,null,b.token)).data.game,ids=state.players[1].hand.slice(0,2).map(c=>c.id);
 await req(endpoint,{type:'play',ids,rank:'K',revision:1},b.token);
 const skipped=(await req(endpoint,{type:'skip',revision:2},a.token)).data.game;
 assert.equal(skipped.pileCount,2);assert.equal(skipped.rank,'K');assert.equal(skipped.last,null);assert.equal(skipped.players[0].hand.length,11);assert.equal(skipped.turn,1);
 await restart();const saved=(await req('/rooms/'+code,null,b.token)).data.game;assert.equal(saved.revision,3);assert.equal(saved.pileCount,2);assert.equal(saved.players[1].hand.length,9);
}));
