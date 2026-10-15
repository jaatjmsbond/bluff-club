// File previews and privacy settings can deny storage; gameplay must still start.
function savedGet(kind,key){try{return window[kind].getItem(key)}catch{return null}}
function savedSet(kind,key,value){try{window[kind].setItem(key,value)}catch{}}
function savedRemove(kind,key){try{window[kind].removeItem(key)}catch{}}
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let apiBase=savedGet('localStorage','bluff-api')||'',token=savedGet('sessionStorage','bluff-guest-token')||'',me=null,room=null,practice=null,selected=new Set(),sorted=false,poll=null,botTimer=null,busy=false;const names=['Mira','Kabir','Aarav'];let visualKey=null,soundEnabled=false,audioContext=null,winTimer=null;
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',4000)}
async function api(p,b){
 let r;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{r=await fetch(apiBase+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(b?{body:JSON.stringify(b)}:{}),signal:controller.signal})}catch{throw Error('Could not reach the game server. Open the deployed game link or use Connect server. A free server may need a minute to wake up.')}finally{clearTimeout(timer)}
 let d;try{d=await r.json()}catch{throw Error('The game server did not return a valid response. Check your server URL.')}
 if(!r.ok){const e=Error(d.error||'Connection failed.');e.status=r.status;e.roomGone=!!d.roomGone;throw e}return d;
}
function modal(html){$('modalcontent').innerHTML=html;$('modal').showModal()}$('close').onclick=()=>$('modal').close();
$('rules').onclick=()=>modal(`<span class="eyebrow">THE HOUSE RULES</span><h2>Play your hand. Sell your story.</h2><ol><li>2–4 players receive 11 cards each. Choose 1–4 cards and claim a single rank, such as “two kings.” Your actual cards can be anything.</li><li>The next player raises an <b>Objection!</b>, plays 1–4 cards claiming the <b>same rank</b>, or chooses <b>Skip turn</b>. Cards from every play stay in the table pile.</li><li>An objection checks <b>only the latest play</b>. If any of those cards do not match the claim, the objection is correct: the player who made that claim picks up the <b>entire table pile</b>, and the objector leads.</li><li>If every card in the latest play matches, the objection is wrong: the objector picks up the <b>entire table pile</b>, and the previous player leads again.</li><li>Example: 2 cards + 2 cards + 1 card = <b>5 table cards</b>. Whoever loses the objection takes all five. The table clears, and the next lead chooses any rank.</li><li><b>Skip turn</b> plays no cards and raises no objection. It accepts the previous claim, leaves the pile and rank unchanged, and moves to the next player. Only the immediate next player gets an objection opportunity.</li><li><b>Last cards are not an instant win.</b> The next player must choose Objection! or Skip turn. A correct objection makes the final player pick up the entire pile and continue. A wrong objection confirms their win. Skipping accepts the final claim and confirms the winner.</li></ol><p>No turn timer. Practice opponents are bots. Unused cards stay out of the game.</p>`);
function clearGuest(){token='';me=null;savedRemove('sessionStorage','bluff-guest-token');savedRemove('sessionStorage','bluff-last-room')}
async function ensureGuest(name){
 name=name.trim();if(me&&token&&name===me.name)return;if(me&&room?.game&&!room.game.winner)throw Error('Finish this game before changing your display name.');
 const d=await api('/api/guest',{name});token=d.token;me=d.user;savedSet('sessionStorage','bluff-guest-token',token);savedSet('localStorage','bluff-nickname',me.name);
}
function guestForm(mode='create',invite={}){
 modal(`<span class="eyebrow">NO ACCOUNTS. JUST FRIENDS.</span><h2>${mode==='create'?'Create your room.':'Join your friends.'}</h2><p>${mode==='create'?'Choose a room name. We’ll give you a private code to share.':'Enter the room name and code your friend shared.'}</p><form id="roomform"><label for="nickname">YOUR DISPLAY NAME</label><input id="nickname" autocomplete="nickname" minlength="2" maxlength="20" required value="${esc(me?.name||savedGet('localStorage','bluff-nickname')||'')}" placeholder="e.g. Alex"><label for="roomname">ROOM NAME</label><input id="roomname" minlength="3" maxlength="32" required value="${esc(invite.name||'')}" placeholder="e.g. Friday Friends">${mode==='join'?`<label for="roomcode">ROOM CODE</label><input id="roomcode" minlength="6" maxlength="6" required value="${esc(invite.code||'')}" placeholder="e.g. A3B7F2" autocapitalize="characters" autocomplete="off">`:''}<button class="primary" id="roomsubmit">${mode==='create'?'Create room':'Join room'}</button></form><p id="roomerror" class="error" role="status"></p><p class="guest-note">No registration or password. Open the deployed game link to play online.</p>`);
 $('roomform').onsubmit=async e=>{e.preventDefault();const button=$('roomsubmit');button.disabled=true;button.textContent='Connecting…';const name=$('roomname').value.trim(),nickname=$('nickname').value.trim(),code=$('roomcode')?.value.trim().toUpperCase();
  try{await ensureGuest(nickname);const next=mode==='create'?await api('/api/rooms',{name}):await api('/api/rooms/'+code+'/join',{name});mountRoom(next);$('modal').close();toast(mode==='create'?'Room created. Share its name and code.':'You joined '+next.name+'.')}
  catch(e){if(e.status===401)clearGuest();if($('roomerror'))$('roomerror').textContent=e.message;button.disabled=false;button.textContent=mode==='create'?'Create room':'Join room';renderLobby();render()}
 };
}
$('connection').onclick=()=>{modal(`<span class="eyebrow">ONLINE CONNECTION</span><h2>Your game server.</h2><p>If you opened the deployed game, leave this blank. For a downloaded file or GitHub Pages, enter your backend HTTPS URL.</p><label for="backend">BACKEND URL</label><input id="backend" placeholder="https://your-game.onrender.com" value="${esc(apiBase)}"><button class="primary" id="savebackend">Save connection</button><p id="connectionerror" class="error"></p>`);$('savebackend').onclick=()=>{try{const v=$('backend').value.trim().replace(/\/$/,'');if(v){const u=new URL(v);if(!['https:','http:'].includes(u.protocol))throw Error('Use an HTTPS URL.')}stop();apiBase=v;savedSet('localStorage','bluff-api',v);clearGuest();room=null;newPractice();$('modal').close();toast('Connection saved. Create or join a room.')}catch(e){$('connectionerror').textContent=e.message}}};
$('account').onclick=()=>{if(!me)return guestForm('create');modal(`<span class="eyebrow">YOUR GUEST SEAT</span><h2>${esc(me.name)}</h2><p>Your seat is remembered in this browser tab. Refreshing can reconnect while the room and saved guest session still exist.</p><button class="primary" id="profilejoin">Join a room</button><button class="secondary" id="profilecreate">Create a room</button><button class="secondary" id="switchguest">Use another name</button><p class="guest-note">Using another name starts a new guest seat. It does not reclaim your previous hand.</p>`);$('profilejoin').onclick=()=>guestForm('join');$('profilecreate').onclick=()=>guestForm('create');$('switchguest').onclick=()=>{if(room?.game&&!room.game.winner)return toast('Finish this game before changing your name.');stop();clearGuest();room=null;$('modal').close();newPractice();guestForm('create')}};
function stop(){clearInterval(poll);clearTimeout(botTimer);poll=null;botTimer=null}
function newPractice(){stop();clearTimeout(winTimer);clearTimeout(announce.timer);$('event-banner').classList.remove('show');document.querySelector('.board').classList.remove('is-objection','is-dealing');visualKey=null;$('fx-layer').replaceChildren();room=null;savedRemove('sessionStorage','bluff-last-room');selected.clear();const n=Number($('bots')?.value||2);practice=Game.start([{id:'you',name:'You'},...names.slice(0,n).map((name,i)=>({id:'bot'+i,name}))]);renderLobby();render();scheduleBot();toast('Fresh game dealt · '+practice.players.length+' players · 11 cards each')}
function renderLobby(){
 const el=$('lobby');
 if(room){
  el.innerHTML=`<span class="room-label">${esc(room.name)}</span><label>ROOM CODE · SHARE WITH FRIENDS</label><div class="roomcode">${esc(room.code)}</div><button id="copyinvite" class="secondary">Copy invite</button><div class="members">${room.players.map(p=>esc(p.name)+(p.id===room.host?' · host':'')).join('<br>')}</div><p class="room-status">${room.game?'Keep this tab to reconnect.':room.players.length+' / 4 players · '+(room.host===me.id?'You are the host.':'Waiting for the host to deal.')}</p>${room.host===me.id&&(!room.game||room.game.winner)?'<button id="start" class="primary secondary">'+(room.game?'Play again':'Shuffle & deal')+'</button>':''}<button id="leavetable" class="secondary">Back to lobby</button>${!room.game||room.game.winner?'<button id="leave-room" class="text-button">Leave room & free seat</button>':''}<p id="syncstatus" class="syncstatus" role="status"></p>`;
  $('copyinvite').onclick=copyInvite;
  if($('start'))$('start').onclick=async()=>{const button=$('start');button.disabled=true;try{const next=await api('/api/rooms/'+room.code+'/start',{});if(room&&next.code===room.code){room=next;selected.clear();renderLobby();render()}}catch(e){toast(e.message);button.disabled=false}};
  $('leavetable').onclick=()=>{stop();room=null;practice=null;savedRemove('sessionStorage','bluff-last-room');renderLobby();render()};
  if($('leave-room'))$('leave-room').onclick=async()=>{try{await api('/api/rooms/'+room.code+'/leave',{});stop();room=null;practice=null;savedRemove('sessionStorage','bluff-last-room');renderLobby();render();toast('You left the room.')}catch(e){toast(e.message)}};
  return;
 }
 const n=practice?.players.length-1||2;
 el.innerHTML=`<button id="create" class="primary secondary">Create room</button><button id="join" class="secondary">Join room</button><p class="guest-note">Just a name. No accounts or passwords.</p><div id="myrooms" class="members"></div><div class="practice-tools"><label for="bots">OR PRACTICE WITH BOTS</label><select id="bots"><option value="1" ${n===1?'selected':''}>1 friend · bot</option><option value="2" ${n===2?'selected':''}>2 friends · bots</option><option value="3" ${n===3?'selected':''}>3 friends · bots</option></select><button id="practice" class="secondary">Deal a fresh game</button></div>`;
 $('create').onclick=()=>guestForm('create');$('join').onclick=()=>guestForm('join');$('practice').onclick=newPractice;
 if(me)api('/api/rooms').then(d=>{if(room||!$('myrooms'))return;$('myrooms').innerHTML=d.rooms.slice(-6).map(r=>`<button class="secondary resume" data-code="${r.code}">${esc(r.name)} · Resume</button>`).join('');document.querySelectorAll('.resume').forEach(b=>b.onclick=()=>resumeRoom(b.dataset.code))}).catch(e=>{if(e.status===401){clearGuest();render()}else toast(e.message)});
}
async function resumeRoom(code){try{mountRoom(await api('/api/rooms/'+code))}catch(e){if(e.status===401)clearGuest();toast(e.message);renderLobby();render()}}
function mountRoom(next){stop();room=next;practice=null;selected.clear();visualKey=null;savedSet('sessionStorage','bluff-last-room',room.code);renderLobby();render();const code=room.code;let syncing=false,failed=false;
 poll=setInterval(async()=>{if(syncing||!room||room.code!==code)return;syncing=true;try{const next=await api('/api/rooms/'+code);if(!room||room.code!==code)return;failed=false;const changed=JSON.stringify(next)!==JSON.stringify(room);room=next;if(changed){renderLobby();render()}if($('syncstatus'))$('syncstatus').textContent=''}catch(e){if(!room||room.code!==code)return;if(e.status===401||e.roomGone){stop();if(e.status===401)clearGuest();room=null;practice=null;savedRemove('sessionStorage','bluff-last-room');renderLobby();render();toast(e.message)}else{if(!failed)toast('Connection interrupted. Reconnecting…');failed=true;if($('syncstatus'))$('syncstatus').textContent='Reconnecting… Keep this tab open.'}}finally{syncing=false}},1500);
}
async function copyInvite(){
 let text='Join my Bluff Club room!\nRoom name: '+room.name+'\nRoom code: '+room.code;
 if(['http:','https:'].includes(location.protocol)){const link=new URL(location.href);link.search='';link.searchParams.set('room',room.code);link.searchParams.set('name',room.name);link.hash='';text+='\n'+link.href}
 try{await navigator.clipboard.writeText(text);toast('Invite copied. Send it to your friends.')}catch{modal(`<h2>Share your room.</h2><p>Copy this invitation and send it to your friends.</p><textarea id="invite-text" rows="6" readonly>${esc(text)}</textarea>`);$('invite-text').select()}
}
async function restoreGuest(code){if(!token)return;try{const d=await api('/api/me');me=d.user;if(code){mountRoom(await api('/api/rooms/'+code))}else{renderLobby();render()}}catch(e){if(e.status===401)clearGuest();else if(e.roomGone)savedRemove('sessionStorage','bluff-last-room');toast(e.message);renderLobby();render()}}
function state(){return practice||room?.game}function myId(){return practice?'you':me?.id}function myHand(){return state()?.players.find(p=>p.id===myId())?.hand||[]}
function render(){
 const g=state(),id=myId(),mine=g?.players.find(p=>p.id===id),turn=g?.players[g.turn];
 const isTurn=!!g&&!g.winner&&turn.id===id;
 const final=!!g?.last&&(g.players[g.last.by].hand?.length??g.players[g.last.by].count)===0;
 const pileCount=g?(g.pile?.length??g.pileCount??g.last?.cards?.length??0):0;
 const key=g?(practice?'practice':room.code)+':'+g.revision:'lobby';
 const changed=key!==visualKey;
 $('account').textContent=me?me.name+' ▾':'Play with friends';
 $('mode').textContent=practice?'PRACTICE · BOTS':room?'ONLINE · '+room.code:'ONLINE LOBBY';
 $('myname').textContent=mine?.name||me?.name||'You';
 $('your-seat').querySelector('.avatar').textContent=(mine?.name||me?.name||'You')[0].toUpperCase();
 const mineCount=mine?.hand?.length??mine?.count;
 $('handcount').textContent=mine?mineCount+' card'+(mineCount===1?'':'s')+' in hand':'Waiting for a deal';
 $('yourturn').textContent=g?.winner?'GAME FINISHED':isTurn?(final?'OBJECTION OR SKIP':'YOUR TURN'):'AT THE TABLE';
 $('your-seat').classList.toggle('active',isTurn);
 $('opponents').innerHTML=(g?.players||room?.players||[]).filter(p=>p.id!==id).map(p=>`<div class="opponent ${turn?.id===p.id&&!g?.winner?'active':''}" data-player="${esc(p.id)}"><span class="avatar">${esc(p.name[0].toUpperCase())}</span><b>${esc(p.name)}</b><small>${p.hand?.length??p.count??'Ready'} ${g?((p.hand?.length??p.count)===1?'card':'cards'):'to play'}</small><div class="backs">${g?'<i></i>'.repeat(Math.min(5,p.hand?.length??p.count)):''}</div></div>`).join('');
 $('pile').className='pile'+(pileCount?'':' empty')+(changed&&g?.event?.type==='play'?' pile-land':'');
 $('pile').innerHTML=pileCount?Array.from({length:Math.min(10,pileCount)},(_,i)=>`<div class="cardback" style="--angle:${[-12,8,-5,16,-8,3,11,-16,6,-2][i]}deg;--lift:${i%3*2}px"></div>`).join(''):'♠';
 $('pilecount').innerHTML=pileCount?`<strong>${pileCount}</strong> CARD${pileCount===1?'':'S'} ON THE TABLE`:'EMPTY TABLE';
 $('table-rank').innerHTML=g?.rank?'TABLE RANK <b>'+esc(g.rank)+'</b>':'CHOOSE ANY RANK';
 const winner=g?.players.find(p=>p.id===g.winner);
 $('claim').textContent=winner?winner.name+' wins! ✦':g?.last?g.players[g.last.by].name+' claims '+(g.last.cards?.length??g.last.count)+' × '+g.last.rank:g?'Your move. Make it count.':'Your seat is waiting.';
 $('turn').textContent=winner?'Well played. Ready for another round?':g?final?'Waiting for '+turn.name+' to object or skip.':isTurn?(g.last?'Play, object, or skip. All '+pileCount+' table cards are at stake.':g.rank?'Play the table rank, or skip your turn.':'Choose 1–4 cards, or skip your turn.'):turn.name+' is thinking…':'Create a room and bring 1–3 friends.';
 $('final-notice').hidden=!final||!!winner;
 $('final-notice').textContent=final?(isTurn?'FINAL CLAIM PENDING · Objection can catch a bluff. Skip accepts the claim.':'FINAL CLAIM PENDING · No winner until the next player decides.') : '';
 document.querySelector('.board').classList.toggle('final-pending',final&&!winner);
 const e=g?.event;
 $('reaction').innerHTML=e?.type==='objection'?`<b>${e.truth?'OBJECTION WRONG':'OBJECTION CORRECT'}</b> · ${esc(g.players.find(p=>p.id===e.loser)?.name||'Player')} picks up all ${e.count} cards.<div class="reveal">${e.revealed.map(c=>`<span class="mini-card ${['♥','♦'].includes(c.s)?'red':''}">${esc(c.r+c.s)}</span>`).join('')}</div>`:'';
 $('hand').innerHTML='';let cards=[...myHand()];
 if(sorted)cards.sort((a,b)=>Game.ranks.indexOf(a.r)-Game.ranks.indexOf(b.r));
 selected=new Set([...selected].filter(id=>cards.some(c=>c.id===id)));
 cards.forEach((c,i)=>{const b=document.createElement('button');b.className='card '+(['♥','♦'].includes(c.s)?'red ':'')+(selected.has(c.id)?'selected ':'')+(changed&&e?.type==='deal'?'just-dealt':'');b.style.setProperty('--delay',Math.min(i,15)*30+'ms');b.setAttribute('aria-label',c.r+' '+c.s);b.setAttribute('aria-pressed',selected.has(c.id));b.disabled=!isTurn||final;b.innerHTML=esc(c.r)+'<span>'+c.s+'</span><em>'+c.s+'</em>';b.onclick=()=>{if(selected.has(c.id))selected.delete(c.id);else if(selected.size<4)selected.add(c.id);else return toast('Choose up to four cards.');tone('select');render()};$('hand').appendChild(b)});
 const previous=$('rank').value;
 $('rank').innerHTML=(g?.rank?[g.rank]:Game.ranks).map(r=>`<option>${r}</option>`).join('');
 if(!g?.rank&&Game.ranks.includes(previous))$('rank').value=previous;
 $('rank').disabled=!isTurn||!!g?.rank||final;
 $('selection').textContent=final?'Object or skip to decide':selected.size?selected.size+' card'+(selected.size>1?'s':'')+' selected':'Tap cards to select';
 $('play').textContent='Play face down';
 $('play').disabled=!isTurn||busy||final||!selected.size;
 $('skip').disabled=!isTurn||busy;
 $('skip').title=final?'Skip the objection and accept the final claim.':'Pass your turn without playing cards or raising an objection.';
 $('skip').setAttribute('aria-label',final?'Skip turn and accept the final claim':'Skip turn');
 $('challenge').disabled=!isTurn||!g?.last||busy;
 $('challenge').setAttribute('aria-label',pileCount?'Objection! Entire pile: '+pileCount+' cards':'Objection!');
 $('hint').textContent=practice?'PRACTICE WITH BOTS · Only you can see your hand.':room?'PRIVATE HANDS · Lose an objection, pick up the whole pile.':'Create a room or join your friends. No login needed.';
 $('log').innerHTML=(g?.log||['Your next game night starts here.']).slice().reverse().map(l=>'<div>'+esc(l)+'</div>').join('');
 document.querySelector('.board').classList.toggle('is-winner',!!winner);
 if(changed){visualKey=key;if(g)animateGame(g,winner);}
}
function seatCenter(id){const seat=id===myId()?$('your-seat'):Array.from(document.querySelectorAll('.opponent')).find(el=>el.dataset.player===id);return (seat||$('pile')).getBoundingClientRect()}
function flyCards(from,to,count){
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(let i=0;i<Math.min(count,8);i++){
  const card=document.createElement('div');card.className='cardfly';card.textContent='♠';
  card.style.left=from.left+from.width/2-23+'px';card.style.top=from.top+from.height/2-33+'px';$('fx-layer').appendChild(card);
  const animation=card.animate([{transform:'translate(0,0) rotate(-12deg)',opacity:1},{transform:`translate(${to.left+to.width/2-from.left-from.width/2}px,${to.top+to.height/2-from.top-from.height/2}px) rotate(${i*7-15}deg)`,opacity:0}],{duration:550,delay:i*55,easing:'cubic-bezier(.2,.7,.3,1)',fill:'both'});
  animation.onfinish=()=>card.remove();
 }
}
function announce(title,subtitle){const el=$('event-banner');el.replaceChildren();el.appendChild(document.createTextNode(title));const small=document.createElement('small');small.textContent=subtitle;el.appendChild(small);el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(announce.timer);announce.timer=setTimeout(()=>el.classList.remove('show'),2500)}
function animateGame(g,winner){
 const board=document.querySelector('.board'),e=g.event;
 if(e?.type==='deal'){board.classList.add('is-dealing');setTimeout(()=>board.classList.remove('is-dealing'),900);tone('deal');}
 if(e?.type==='play'){flyCards(seatCenter(e.by),$('pile').getBoundingClientRect(),e.count);tone('play');if(g.last&&(g.players[g.last.by].hand?.length??g.players[g.last.by].count)===0)announce('FINAL CLAIM','Objection or skip next · no winner yet');}
 if(e?.type==='skip'){announce('TURN SKIPPED',g.players.find(p=>p.id===e.by).name+' passed · table pile stays');tone('select');}
 if(e?.type==='objection'){
  board.classList.add('is-objection');setTimeout(()=>board.classList.remove('is-objection'),600);
  announce('OBJECTION!',(e.truth?'Wrong objection':'Bluff caught')+' · All '+e.count+' cards → '+g.players.find(p=>p.id===e.loser).name);
  flyCards($('pile').getBoundingClientRect(),seatCenter(e.loser),e.count);tone('objection');
 }
 if(winner){winTimer=setTimeout(()=>announce(winner.id===myId()?'YOU WIN!':winner.name.toUpperCase()+' WINS!','First empty hand. Well played.'),e?.type==='objection'?2600:100);tone('win');
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)for(let i=0;i<35;i++){const piece=document.createElement('i');piece.className='confetti';piece.style.cssText=`left:${15+Math.random()*70}%;top:15%;background:${['#79f2cc','#f8d184','#ff9292','#bda7ff'][i%4]};animation-delay:${Math.random()*.6}s`;$('fx-layer').appendChild(piece);setTimeout(()=>piece.remove(),3200);}
 }
}
function tone(type){if(!soundEnabled)return;try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),v=audioContext.createGain();o.connect(v);v.connect(audioContext.destination);const now=audioContext.currentTime;o.frequency.setValueAtTime(({select:550,deal:300,play:440,objection:170,win:660})[type]||440,now);o.frequency.exponentialRampToValueAtTime(type==='win'?990:280,now+.13);v.gain.setValueAtTime(.045,now);v.gain.exponentialRampToValueAtTime(.001,now+.16);o.start(now);o.stop(now+.18)}catch{}}
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').textContent=soundEnabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',soundEnabled);tone('select')};
async function action(type){let g=state();if(!g||busy)return;let a={type,ids:[...selected],rank:$('rank').value,revision:g.revision};busy=true;try{if(practice)Game.act(practice,'you',a);else room=await api('/api/rooms/'+room.code+'/action',a);selected.clear();renderLobby();}catch(e){toast(e.message)}finally{busy=false;render();scheduleBot()}}
$('play').onclick=()=>action('play');$('challenge').onclick=()=>action('challenge');$('skip').onclick=()=>action('skip');$('sort').onclick=()=>{sorted=!sorted;render()};
function scheduleBot(){
 clearTimeout(botTimer);if(!practice||practice.winner||practice.players[practice.turn].id==='you')return;
 botTimer=setTimeout(()=>{if(!practice||practice.winner)return;const p=practice.players[practice.turn],g=practice;try{
  const final=!!g.last&&!g.players[g.last.by].hand.length;
  // A final claim always waits for a real bot decision; it is never auto-won on play.
  if(final){Game.act(g,p.id,{type:Math.random()<.55?'challenge':'skip'})}
  else if(g.last&&Math.random()<.30)Game.act(g,p.id,{type:'challenge'});
  else if(Math.random()<.14)Game.act(g,p.id,{type:'skip'});
  else{const rank=g.rank||p.hand[0].r,honest=p.hand.filter(c=>c.r===rank),cards=honest.length?honest.slice(0,Math.min(4,honest.length)):p.hand.slice(0,1+Math.floor(Math.random()*Math.min(3,p.hand.length)));Game.act(g,p.id,{type:'play',rank,ids:cards.map(c=>c.id)})}
  render();scheduleBot();
 }catch(e){toast(e.message)}},1500+Math.random()*1000);
}
// Restore a seat only with this tab's private guest token, never by display name.
const reconnectCode=savedGet('sessionStorage','bluff-last-room');
newPractice();if($('startupnotice'))$('startupnotice').hidden=true;
const invited=new URLSearchParams(location.search);
async function openInvitation(){await restoreGuest(reconnectCode);if(invited.has('room')&&room?.code!==invited.get('room'))guestForm('join',{code:invited.get('room'),name:invited.get('name')||''})}
openInvitation();
