const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function start(players, random = Math.random) {
  if (players.length < 2 || players.length > 4) throw Error('A table needs 2–4 players.');
  const deck = ranks.flatMap(r => ['♠','♥','♦','♣'].map(s => ({id:r+s,r,s})));
  for (let i=51;i>0;i--) {const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  return {players:players.map(p=>({...p,hand:deck.splice(0,11)})),turn:0,last:null,pile:[],rank:null,winner:null,
    log:['11 cards dealt. Let the game begin!'],revision:0,event:{type:'deal'}};
}
function act(g, uid, a) {
  if (g.winner) throw Error('Game has ended.');
  const player = g.players[g.turn];
  if (player.id !== uid) throw Error('Wait for your turn.');
  const finalPending=!!g.last && !g.players[g.last.by].hand.length;
  if (a.type === 'challenge') {
    if (!g.last) throw Error('No claim to object to.');
    const last=g.last, truth=last.cards.every(c=>c.r===last.rank), loser=truth?g.turn:last.by;
    const pile=g.pile || last.cards; // Older saved games retain their latest unresolved cards.
    g.players[loser].hand.push(...pile);
    g.turn=truth?last.by:g.turn;
    g.event={type:'objection',by:uid,truth,loser:g.players[loser].id,count:pile.length,revealed:last.cards.map(c=>({...c})),rank:last.rank};
    g.log.push(`${player.name}: Objection! ${truth?'Objection wrong — claim was true.':'Objection correct — bluff caught!'} ${g.players[loser].name} picks up all ${pile.length} table cards.`);
    g.pile=[];g.last=null;g.rank=null;
    const empty=g.players.find(p=>!p.hand.length);
    if (empty) g.winner=empty.id;
  } else if (a.type === 'play') {
    if (finalPending) throw Error('Final claim pending. Raise an objection or skip to accept it.');
    if (!Array.isArray(a.ids) || a.ids.length<1 || a.ids.length>4 || new Set(a.ids).size!==a.ids.length) throw Error('Select 1–4 cards.');
    if (!ranks.includes(a.rank) || (g.rank && a.rank!==g.rank)) throw Error('Continue the table rank.');
    const cards=a.ids.map(id=>player.hand.find(c=>c.id===id));
    if (cards.some(c=>!c)) throw Error('Invalid card.');
    g.pile=g.pile || (g.last?[...g.last.cards]:[]);
    player.hand=player.hand.filter(c=>!a.ids.includes(c.id));
    g.pile.push(...cards);
    g.last={by:g.turn,cards,rank:a.rank};g.rank=a.rank;
    g.event={type:'play',by:uid,count:cards.length,rank:a.rank};
    g.log.push(`${player.name} claims ${cards.length} × ${a.rank}. Table: ${g.pile.length} cards.${!player.hand.length?' Final claim — waiting for objection or skip.':''}`);
    g.turn=(g.turn+1)%g.players.length;
  } else if (a.type === 'skip') {
    if (finalPending) {
      g.winner=g.players[g.last.by].id;g.event={type:'win',by:uid,reason:'final-skip'};
      g.log.push(`${player.name} skipped the objection. Final claim accepted — ${g.players[g.last.by].name} wins.`);
    } else {
      // Only the immediate next player may object. Skipping accepts that claim,
      // but leaves every table card and the required rank in place.
      const accepted=!!g.last;
      g.pile=g.pile || (g.last?[...g.last.cards]:[]);
      g.last=null;g.turn=(g.turn+1)%g.players.length;
      g.event={type:'skip',by:uid};
      g.log.push(`${player.name} skipped.${accepted?' Previous claim accepted.':''} ${g.pile.length} cards remain on the table.`);
    }
  } else if (a.type === 'accept' && finalPending) {
    // Older clients may still send the explicit acceptance action.
    g.winner=g.players[g.last.by].id;g.event={type:'win',by:uid};g.log.push('Final claim accepted.');
  } else throw Error('Play cards, raise an objection, or skip your turn.');
  g.revision++;g.log=g.log.slice(-35);return g;
}
function view(g, uid) {
  const {pile,...publicState}=g;
  return {...publicState,pileCount:pile?.length || (g.last?.cards.length ?? 0),
    players:g.players.map(p=>({id:p.id,name:p.name,count:p.hand.length,...(p.id===uid?{hand:p.hand}:{})})),
    last:g.last?{by:g.last.by,rank:g.last.rank,count:g.last.cards.length}:null};
}
window.Game={ranks,start,act,view};
