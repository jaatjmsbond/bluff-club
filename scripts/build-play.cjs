// Rebuild the standalone browser game after editing files in public/.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),pub=path.join(root,'public');
const read=p=>fs.readFileSync(path.join(pub,p),'utf8');
const html=read('index.html').replace('<link rel="stylesheet" href="style.css">','<style>'+read('style.css')+'</style>').replace('<script src="game.js"></script>','<script>'+read('game.js')+'</script>').replace('<script src="app.js"></script>','<script>'+read('app.js')+'</script>');
fs.writeFileSync(path.join(root,'PLAY.html'),html);
console.log('PLAY.html rebuilt.');
