/* Tardoria — Game Client v2
 * Phaser 3 + Socket.io
 * Renderização com sprites reais do Pixel Art Top Down Basic v1.2.3
 */
(function(){
'use strict';

const TS = 16, SCALE = 3, RW = 20, RH = 15;
const PW = RW * TS * SCALE, PH = RH * TS * SCALE;
const SPEED = 100;

const BIOMES = {
  montanha:{ floor:'tile_path',  border:0x4a4e69 },
  ruinas:  { floor:'tile_path',  border:0x5c4033 },
  floresta:{ floor:'tile_grass', border:0x2d6a4f },
  cidade:  { floor:'tile_stone', border:0x495057 },
  taverna: { floor:'tile_stone', border:0x7b2d00 },
};

const BIOME_DECOR = {
  floresta:[
    {s:'tree_1',x:.10,y:.12,sc:1.8,d:5},{s:'tree_2',x:.85,y:.10,sc:1.6,d:5},
    {s:'tree_3',x:.50,y:.08,sc:1.7,d:5},{s:'tree_1',x:.15,y:.70,sc:1.5,d:5},
    {s:'tree_2',x:.80,y:.72,sc:1.6,d:5},{s:'bush_3',x:.30,y:.30,sc:2.0,d:4},
    {s:'bush_4',x:.65,y:.35,sc:2.0,d:4},{s:'bush_2',x:.20,y:.55,sc:2.0,d:4},
    {s:'bush_5',x:.72,y:.58,sc:1.8,d:4},{s:'bush_1',x:.45,y:.65,sc:2.2,d:4},
  ],
  taverna:[
    {s:'prop_chest',x:.15,y:.18,sc:2.5,d:4},{s:'prop_chest',x:.82,y:.18,sc:2.5,d:4},
    {s:'prop_barrel',x:.22,y:.55,sc:2.5,d:4},{s:'prop_barrel',x:.76,y:.55,sc:2.5,d:4},
    {s:'prop_vase',x:.48,y:.20,sc:2.5,d:4},{s:'prop_sofa',x:.20,y:.35,sc:2.5,d:4},
    {s:'prop_sofa',x:.62,y:.35,sc:2.5,d:4},{s:'prop_sign',x:.50,y:.75,sc:2.2,d:4},
  ],
  cidade:[
    {s:'wall_brick_1',x:.08,y:.25,sc:2.0,d:4},{s:'wall_brick_2',x:.08,y:.55,sc:2.0,d:4},
    {s:'wall_brick_3',x:.85,y:.25,sc:2.0,d:4},{s:'wall_brick_1',x:.85,y:.55,sc:2.0,d:4},
    {s:'tree_2',x:.50,y:.15,sc:1.4,d:5},{s:'bush_3',x:.30,y:.75,sc:2.0,d:4},
    {s:'bush_4',x:.65,y:.75,sc:2.0,d:4},{s:'prop_well',x:.50,y:.50,sc:2.5,d:4},
    {s:'prop_statue',x:.25,y:.20,sc:2.2,d:4},{s:'prop_statue',x:.72,y:.20,sc:2.2,d:4},
  ],
  montanha:[
    {s:'prop_rocks',x:.15,y:.25,sc:2.5,d:4},{s:'prop_rocks',x:.65,y:.20,sc:2.0,d:4},
    {s:'prop_rocks',x:.40,y:.40,sc:3.0,d:4},{s:'bush_4',x:.80,y:.55,sc:1.8,d:4},
    {s:'bush_5',x:.20,y:.60,sc:1.8,d:4},{s:'wall_arch',x:.50,y:.30,sc:2.0,d:4},
  ],
  ruinas:[
    {s:'wall_brick_1',x:.12,y:.15,sc:2.2,d:4},{s:'wall_brick_2',x:.12,y:.50,sc:2.2,d:4},
    {s:'wall_brick_3',x:.82,y:.15,sc:2.2,d:4},{s:'wall_brick_1',x:.82,y:.50,sc:2.2,d:4},
    {s:'prop_cross',x:.30,y:.35,sc:2.5,d:4},{s:'prop_cross',x:.65,y:.35,sc:2.5,d:4},
    {s:'prop_altar',x:.50,y:.45,sc:2.5,d:4},{s:'prop_vase',x:.22,y:.65,sc:2.2,d:4},
    {s:'prop_rocks',x:.60,y:.65,sc:2.2,d:4},{s:'bush_2',x:.40,y:.20,sc:1.8,d:4},
  ],
};

// Estado
let token = localStorage.getItem('t_token'), myChar=null, socket=null, game=null, gameScene=null;
let isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
let activeTrade=null, activeShop={};
let scanToken = new URLSearchParams(location.search).get('scan');

const $ = id => document.getElementById(id);

// ── AUTH ─────────────────────────────────────────────────
let isReg = false;
$('auth-toggle').onclick = () => {
  isReg=!isReg;
  $('a-email').style.display=$('a-char').style.display=isReg?'':'none';
  $('auth-submit').textContent=isReg?'Registrar':'Entrar';
  $('auth-sub').textContent=isReg?'Crie sua conta':'Entre no mundo';
  $('auth-toggle').textContent=isReg?'Já tem conta? Login':'Não tem conta? Registrar';
};
$('auth-submit').onclick = async()=>{
  const user=$('a-user').value.trim(), pass=$('a-pass').value;
  if(!user||!pass)return; $('auth-err').textContent='';
  try{
    const body=isReg?{username:user,email:$('a-email').value.trim(),password:pass,charName:$('a-char').value.trim()||user}:{username:user,password:pass};
    const res=await fetch(isReg?'/api/auth/register':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await res.json();
    if(!res.ok){$('auth-err').textContent=d.error;return;}
    token=d.token;myChar=d.character;localStorage.setItem('t_token',token);startGame();
  }catch{$('auth-err').textContent='Erro de conexão.';}
};
['a-user','a-email','a-pass','a-char'].forEach(id=>$(id).addEventListener('keydown',e=>e.key==='Enter'&&$('auth-submit').click()));
if(token){fetch('/api/auth/me',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():null).then(d=>{if(d){myChar=d.character;startGame();}else{localStorage.removeItem('t_token');}}).catch(()=>{});}

// ── START ─────────────────────────────────────────────────
function startGame(){
  $('auth').style.display='none';
  $('hud').style.display='flex'; $('game').style.display='block';
  $('chat').style.display='block'; $('actions').style.display='flex';
  if(isMobile) $('joystick-zone').style.display='block';
  connectSocket();
}
function updateHUD(p){
  $('hud-name').textContent=p.name;
  $('hud-hp').textContent=`❤ ${p.hp}/${p.hp_max||p.hpMax||100}`;
  $('hud-gold').textContent=`💰 ${p.gold}g`;
  $('hud-room').textContent=`Sala ${String(p.roomId||p.room_id||0).padStart(2,'0')}`;
}

// ── SOCKET ────────────────────────────────────────────────
function connectSocket(){
  socket=io({auth:{token}});
  socket.on('connect_error',err=>{if(err.message==='Token inválido'){localStorage.removeItem('t_token');location.reload();}});
  socket.on('init',data=>{myChar=data.player;updateHUD(myChar);initPhaser(data);if(scanToken)handleScan(scanToken);});
  socket.on('goldUpdate',({gold})=>{myChar.gold=gold;updateHUD(myChar);});
  socket.on('sleepOk',()=>{myChar.isSleeping=true;$('btn-sleep').style.display='none';$('btn-wake').style.display='';});
  socket.on('wakeOk',()=>{myChar.isSleeping=false;$('btn-wake').style.display='none';$('btn-sleep').style.display='';});
  socket.on('chat',({name,message,channel})=>addChat(name,message,channel));
  socket.on('stealResult',r=>r.success?addChat(null,`🗡 +${r.amount}g`,'loot'):addChat(null,`🗡 Falhou`,'system'));
  socket.on('stolen',({by,amount})=>addChat(null,`⚠️ ${by} roubou ${amount}g`,'system'));
  socket.on('tradeIncoming',data=>{activeTrade=data;$('trade-title').textContent=`Troca de ${data.fromName}`;$('trade-msg').textContent=`Ele oferece ${data.goldOffer}g. Quanto você oferece?`;$('trade-gold-in').value='0';$('trade-modal').style.display='flex';});
  socket.on('tradeDone',()=>addChat(null,'✅ Troca concluída!','system'));
  socket.on('tradeError',m=>addChat(null,`❌ ${m}`,'system'));
  socket.on('tradeRejected',()=>addChat(null,'❌ Recusada','system'));
  setInterval(()=>{const t=Date.now();socket.emit('ping_',null,()=>{$('hud-ping').textContent=`${Date.now()-t}ms`;});},3000);
}

// ── CHAT ──────────────────────────────────────────────────
const chatLog=$('chat-log');
function addChat(name,msg,ch='local'){const d=document.createElement('div');d.className=`cm-${ch}`;d.textContent=name?`[${name}] ${msg}`:msg;chatLog.appendChild(d);chatLog.scrollTop=chatLog.scrollHeight;}
$('chat-send').onclick=sendChat;
$('chat-input').addEventListener('keydown',e=>e.key==='Enter'&&sendChat());
function sendChat(){const msg=$('chat-input').value.trim();if(!msg||!socket)return;const ch=msg.startsWith('!g ')?'global':'local';socket.emit('chat',{message:ch==='global'?msg.slice(3):msg,channel:ch});$('chat-input').value='';}

// ── AÇÕES ─────────────────────────────────────────────────
$('btn-sleep').onclick=()=>socket?.emit('sleep');
$('btn-wake').onclick=()=>socket?.emit('wake');
$('btn-steal').onclick=()=>{if(!gameScene)return;const t=gameScene.getNearby(90);if(!t.length)return addChat(null,'Ninguém próximo','system');socket.emit('steal',{targetCharId:t[0].charId});};
$('btn-trade').onclick=()=>{if(!gameScene)return;const t=gameScene.getNearby(90);if(!t.length)return addChat(null,'Ninguém próximo','system');const g=parseInt(prompt('Quantas moedas você oferece?','10'))||0;socket.emit('tradePropose',{targetCharId:t[0].charId,goldOffer:g});};
$('trade-accept').onclick=()=>{if(!activeTrade)return;socket.emit('tradeAccept',{partnerSocketId:activeTrade.fromSocketId,myGold:parseInt($('trade-gold-in').value)||0,partnerGold:activeTrade.goldOffer});$('trade-modal').style.display='none';activeTrade=null;};
$('trade-reject').onclick=()=>{if(activeTrade)socket.emit('tradeReject',{partnerSocketId:activeTrade.fromSocketId});$('trade-modal').style.display='none';activeTrade=null;};

// ── QR ────────────────────────────────────────────────────
async function handleScan(tkn){
  if(!tkn||!myChar)return;history.replaceState({},'','/');
  const pos=await new Promise(res=>navigator.geolocation?.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),()=>res({lat:null,lng:null}),{timeout:5000})).catch(()=>({lat:null,lng:null}));
  try{
    const r=await fetch('/api/partner/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tkn,lat:pos?.lat,lng:pos?.lng,charId:myChar.id})});
    const d=await r.json();
    if(!r.ok)return addChat(null,`❌ ${d.error}`,'system');
    activeShop={partnerId:d.partnerId,partnerName:d.partnerName,items:d.items};
    openShop(d.partnerName,d.items);
    $('shop-badge').textContent=`🏪 ${d.partnerName}`;$('shop-badge').style.display='block';
    $('shop-badge').onclick=()=>openShop(d.partnerName,d.items);
    addChat(null,`🏪 ${d.partnerName} — loja disponível!`,'loot');
  }catch{addChat(null,'❌ Erro no QR','system');}
}
function openShop(name,items){
  $('shop-title').textContent=`🏪 ${name}`;$('shop-sub').textContent=`Seu gold: ${myChar?.gold||0}g`;
  const c=$('shop-items');c.innerHTML='';
  if(!items?.length){c.innerHTML='<p style="color:#8b949e;font-size:12px">Sem itens.</p>';return;}
  items.forEach(item=>{const div=document.createElement('div');div.className='shop-item';div.innerHTML=`<div class="shop-item-icon">${item.icon}</div><div class="shop-item-info"><div class="shop-item-name rarity-${item.rarity}">${item.name}</div><div class="shop-item-desc">${item.desc}</div></div><div class="shop-item-price">${item.price_gold}g</div>`;div.onclick=()=>buyItem(item);c.appendChild(div);});
  $('shop-modal').style.display='flex';
}
$('shop-close').onclick=()=>{$('shop-modal').style.display='none';};
async function buyItem(item){
  if(!activeShop.partnerId)return;
  const r=await fetch('/api/shop/buy',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({itemKey:item.key,partnerId:activeShop.partnerId})});
  const d=await r.json();
  if(!r.ok)return addChat(null,`❌ ${d.error}`,'system');
  myChar.gold=d.character.gold;myChar.hp=d.character.hp;updateHUD(myChar);$('shop-sub').textContent=`Seu gold: ${myChar.gold}g`;
  addChat(null,`✅ Comprou ${item.name}!`,'loot');
}

// ── JOYSTICK ─────────────────────────────────────────────
const joy={active:false,vx:0,vy:0,originX:0,originY:0};
(function(){
  const zone=$('joystick-zone'),base=$('joystick-base'),knob=$('joystick-knob');
  if(!zone)return;
  const R=55,DEAD=8;
  function start(e){e.preventDefault();const t=e.touches?e.touches[0]:e,rect=zone.getBoundingClientRect();joy.originX=t.clientX-rect.left;joy.originY=t.clientY-rect.top;joy.active=true;base.style.left=joy.originX+'px';base.style.top=joy.originY+'px';knob.style.left=joy.originX+'px';knob.style.top=joy.originY+'px';base.style.opacity=knob.style.opacity='1';}
  function move(e){if(!joy.active)return;e.preventDefault();const t=e.touches?e.touches[0]:e,rect=zone.getBoundingClientRect(),dx=t.clientX-rect.left-joy.originX,dy=t.clientY-rect.top-joy.originY,dist=Math.sqrt(dx*dx+dy*dy),clamped=Math.min(dist,R),angle=Math.atan2(dy,dx);knob.style.left=(joy.originX+Math.cos(angle)*clamped)+'px';knob.style.top=(joy.originY+Math.sin(angle)*clamped)+'px';joy.vx=dist<DEAD?0:Math.cos(angle)*clamped/R;joy.vy=dist<DEAD?0:Math.sin(angle)*clamped/R;}
  function end(e){e.preventDefault();joy.active=false;joy.vx=joy.vy=0;base.style.opacity=knob.style.opacity='0';}
  zone.addEventListener('touchstart',start,{passive:false});zone.addEventListener('touchmove',move,{passive:false});zone.addEventListener('touchend',end,{passive:false});zone.addEventListener('touchcancel',end,{passive:false});
  zone.addEventListener('mousedown',start);zone.addEventListener('mousemove',move);zone.addEventListener('mouseup',end);zone.addEventListener('mouseleave',end);
})();

// ── PHASER ────────────────────────────────────────────────
function initPhaser(initData){
  if(game){game.destroy(true);game=null;}
  const W=Math.min(PW,window.innerWidth),H=Math.min(PH,window.innerHeight-36);
  game=new Phaser.Game({type:Phaser.AUTO,width:W,height:H,parent:'game',backgroundColor:'#1a1a2e',pixelArt:true,physics:{default:'arcade',arcade:{gravity:{y:0},debug:false}},scene:makeScene(initData)});
}

function makeScene(initData){
  const others=new Map();
  const keys={};
  let mySprite=null,myLabel=null,decorItems=[],wallRects=[];
  let currentRoom=initData.room,lastDir='down',lastEmit=0;

  const SPRITES=[
    'tile_grass','tile_stone','tile_path','TX_Player',
    'tree_1','tree_2','tree_3','bush_1','bush_2','bush_3','bush_4','bush_5',
    'prop_chest','prop_barrel','prop_vase','prop_sofa','prop_sign',
    'prop_statue','prop_well','prop_rocks','prop_altar','prop_cross','prop_door',
    'wall_brick_1','wall_brick_2','wall_brick_3','wall_arch',
    'wall_window','wall_solid','wall_door','wall_stair_l','wall_stair_r',
  ];

  return {
    preload(){
      SPRITES.forEach(k=>this.load.image(k,`/assets/sprites/${k}.png`));
      this.load.on('loaderror',()=>{});
    },

    create(){
      keys.up=this.input.keyboard.addKey(87);keys.down=this.input.keyboard.addKey(83);
      keys.left=this.input.keyboard.addKey(65);keys.right=this.input.keyboard.addKey(68);

      this.physics.world.setBounds(0,0,PW,PH);
      this._buildRoom(currentRoom);
      this._spawnPlayer(initData.player);
      initData.others.forEach(p=>this._addOther(p));
      this.cameras.main.startFollow(mySprite,true,0.08,0.08);
      this.cameras.main.setZoom(this.scale.width/PW);
      this._bindSocket();
      gameScene=this;
    },

    update(){
      if(!mySprite)return;
      let vx=0,vy=0;
      if(joy.active&&(Math.abs(joy.vx)>0.05||Math.abs(joy.vy)>0.05)){
        vx=joy.vx*SPEED;vy=joy.vy*SPEED;
      }else{
        if(keys.left?.isDown)vx=-SPEED;if(keys.right?.isDown)vx=SPEED;
        if(keys.up?.isDown)vy=-SPEED;if(keys.down?.isDown)vy=SPEED;
      }
      mySprite.setVelocity(vx,vy);
      let dir=lastDir;
      if(Math.abs(vx)>=Math.abs(vy)){if(vx<-5)dir='left';else if(vx>5)dir='right';}
      else{if(vy<-5)dir='up';else if(vy>5)dir='down';}
      const moving=Math.abs(vx)>2||Math.abs(vy)>2;
      const anim=moving?`walk_${dir}`:`idle_${dir}`;
      try{if(mySprite.anims?.currentAnim?.key!==anim)mySprite.play(anim,true);}catch{}
      lastDir=dir;
      if(myLabel)myLabel.setPosition(mySprite.x,mySprite.y-16);
      const now=Date.now();
      if(now-lastEmit>40){socket?.emit('move',{x:mySprite.x/SCALE,y:mySprite.y/SCALE,direction:dir,moving});lastEmit=now;}
      this._checkTransition();
    },

    getNearby(maxDist){
      const res=[];
      others.forEach(e=>{const dx=e.sprite.x-mySprite.x,dy=e.sprite.y-mySprite.y;if(Math.sqrt(dx*dx+dy*dy)<maxDist*SCALE)res.push({charId:e.data.charId,name:e.data.name});});
      return res;
    },

    _buildRoom(room){
      const cfg=BIOMES[room.biome]||BIOMES.floresta;
      decorItems.forEach(d=>{d.destroy&&d.destroy();});decorItems=[];
      wallRects.forEach(r=>r.destroy());wallRects=[];
      this.children.list.filter(c=>c._tbg).forEach(c=>c.destroy());

      // Chão com tile real
      const floorKey=this.textures.exists(cfg.floor)?cfg.floor:null;
      if(floorKey){
        const ts=this.textures.get(floorKey).source[0];
        const fl=this.add.tileSprite(0,0,PW,PH,floorKey).setOrigin(0).setDepth(0);
        fl.setTileScale(SCALE*(TS/ts.width));fl._tbg=true;
      }else{
        const g=this.add.graphics().setDepth(0);
        g.fillStyle(cfg.border,0.6);g.fillRect(0,0,PW,PH);g._tbg=true;
      }

      // Borda
      const BW=TS*SCALE;
      const g=this.add.graphics().setDepth(2);g._tbg=true;
      g.fillStyle(cfg.border);
      const conn=room.connections||{};
      const midX=PW/2,midY=PH/2,gap=BW*3;
      // Topo
      if(conn.norte==null)g.fillRect(0,0,PW,BW);
      else{g.fillRect(0,0,midX-gap/2,BW);g.fillRect(midX+gap/2,0,PW-(midX+gap/2),BW);}
      // Base
      if(conn.sul==null)g.fillRect(0,PH-BW,PW,BW);
      else{g.fillRect(0,PH-BW,midX-gap/2,BW);g.fillRect(midX+gap/2,PH-BW,PW-(midX+gap/2),BW);}
      // Esq
      if(conn.oeste==null)g.fillRect(0,0,BW,PH);
      else{g.fillRect(0,0,BW,midY-gap/2);g.fillRect(0,midY+gap/2,BW,PH-(midY+gap/2));}
      // Dir
      if(conn.leste==null)g.fillRect(PW-BW,0,BW,PH);
      else{g.fillRect(PW-BW,0,BW,midY-gap/2);g.fillRect(PW-BW,midY+gap/2,BW,PH-(midY+gap/2));}

      // Colisores
      const aw=(x,y,w,h)=>{const r=this.add.zone(x+w/2,y+h/2,w,h);this.physics.add.existing(r,true);wallRects.push(r);};
      aw(0,0,BW,PH);aw(PW-BW,0,BW,PH);aw(0,0,PW,BW);aw(0,PH-BW,PW,BW);

      // Decorações
      (BIOME_DECOR[room.biome]||[]).forEach(d=>{
        if(!this.textures.exists(d.s))return;
        const img=this.add.image(d.x*PW,d.y*PH,d.s).setScale(d.sc||2).setDepth(d.d||4).setOrigin(0.5,1);
        decorItems.push(img);
        if(d.s.startsWith('wall_')||d.s.startsWith('prop_well')||d.s.startsWith('prop_altar')){
          const tex=this.textures.get(d.s).source[0];
          const w=tex.width*(d.sc||2)*0.5,h=tex.height*(d.sc||2)*0.5;
          const z=this.add.zone(d.x*PW,d.y*PH-h/2,w,h);this.physics.add.existing(z,true);wallRects.push(z);
        }
      });
    },

    _spawnPlayer(p){
      const x=(p.x||p.pos_x||160)*SCALE,y=(p.y||p.pos_y||180)*SCALE;
      const hasPlayer=this.textures.exists('TX_Player');

      mySprite=this.physics.add.sprite(x,y,hasPlayer?'TX_Player':'__DEFAULT')
        .setScale(SCALE).setDepth(10).setCollideWorldBounds(true);
      mySprite.body.setSize(10,12);

      if(hasPlayer&&!this.anims.exists('walk_down')){
        [[`walk_down`,[0,1,2],8],[`idle_down`,[3],1],
         [`walk_up`,[8,9,10],8],[`idle_up`,[11],1],
         [`walk_left`,[16,17,18,19],8],[`idle_left`,[20],1],
         [`walk_right`,[24,25,26,27],8],[`idle_right`,[28],1],
        ].forEach(([key,frames,rate])=>this.anims.create({key,frameRate:rate,repeat:rate>1?-1:0,frames:frames.map(f=>({key:'TX_Player',frame:f}))}));
      }
      if(hasPlayer)mySprite.play('idle_down',true);

      myLabel=this.add.text(x,y-16,p.name,{fontSize:`${8*SCALE}px`,fill:'#ffffff',stroke:'#000000',strokeThickness:4}).setOrigin(0.5,1).setDepth(11);
      wallRects.forEach(r=>this.physics.add.collider(mySprite,r));
    },

    _addOther(p){
      if(others.has(p.charId))return;
      const x=(p.x||160)*SCALE,y=(p.y||180)*SCALE;
      const hasPlayer=this.textures.exists('TX_Player');
      const sprite=this.add.sprite(x,y,hasPlayer?'TX_Player':'__DEFAULT').setScale(SCALE).setDepth(9);
      try{sprite.play('idle_down',true);}catch{}
      const label=this.add.text(x,y-16,p.name,{fontSize:`${8*SCALE}px`,fill:'#cccccc',stroke:'#000000',strokeThickness:3}).setOrigin(0.5,1).setDepth(10);
      others.set(p.charId,{sprite,label,data:p});
    },
    _removeOther(charId){const e=others.get(charId);if(!e)return;e.sprite.destroy();e.label.destroy();others.delete(charId);},

    _checkTransition(){
      if(!mySprite||!currentRoom?.connections)return;
      const mx=mySprite.x,my=mySprite.y,BW=TS*SCALE*1.6;
      const c=currentRoom.connections,midX=PW/2,midY=PH/2;
      if(c.norte!=null&&my<BW&&Math.abs(mx-midX)<TS*SCALE*4)this._goRoom(c.norte,midX,PH-3*TS*SCALE);
      if(c.sul!=null&&my>PH-BW&&Math.abs(mx-midX)<TS*SCALE*4)this._goRoom(c.sul,midX,3*TS*SCALE);
      if(c.oeste!=null&&mx<BW&&Math.abs(my-midY)<TS*SCALE*4)this._goRoom(c.oeste,PW-3*TS*SCALE,midY);
      if(c.leste!=null&&mx>PW-BW&&Math.abs(my-midY)<TS*SCALE*4)this._goRoom(c.leste,3*TS*SCALE,midY);
    },
    _goRoom(roomId,ex,ey){
      if(this._transitioning)return;this._transitioning=true;
      socket?.emit('changeRoom',{roomId,x:ex/SCALE,y:ey/SCALE});
      this.time.delayedCall(600,()=>{this._transitioning=false;});
    },

    _bindSocket(){
      const sc=this;
      socket.on('tick',list=>{
        list.forEach(p=>{
          if(p.charId===myChar?.id)return;
          const e=others.get(p.charId);if(!e)return;
          e.sprite.setPosition(p.x*SCALE,p.y*SCALE);e.label.setPosition(p.x*SCALE,p.y*SCALE-16);
          const anim=(p.moving?`walk_`:`idle_`)+(p.direction||'down');
          try{if(e.sprite.anims?.currentAnim?.key!==anim)e.sprite.play(anim,true);}catch{}
          e.sprite.setAlpha(p.isSleeping?0.5:1);
        });
      });
      socket.on('player:join',p=>{sc._addOther(p);addChat(null,`${p.name} entrou.`,'system');});
      socket.on('player:leave',({charId})=>sc._removeOther(charId));
      socket.on('player:sleep',({charId})=>{const e=others.get(charId);if(e)e.sprite.setAlpha(0.5);});
      socket.on('player:wake',({charId})=>{const e=others.get(charId);if(e)e.sprite.setAlpha(1);});
      socket.on('sleepOk',()=>{if(mySprite)mySprite.setAlpha(0.5);});
      socket.on('wakeOk',()=>{if(mySprite)mySprite.setAlpha(1);});
      socket.on('roomChanged',data=>{
        currentRoom=data.room;myChar.roomId=data.player.roomId;updateHUD(data.player);
        others.forEach(e=>{e.sprite.destroy();e.label.destroy();});others.clear();
        sc._buildRoom(currentRoom);
        if(mySprite){mySprite.setPosition(data.player.x*SCALE,data.player.y*SCALE);wallRects.forEach(r=>sc.physics.add.collider(mySprite,r));}
        data.others.forEach(p=>sc._addOther(p));
        addChat(null,`Sala ${currentRoom.id} — ${currentRoom.label||currentRoom.biome}`,'system');
      });
    },
  };
}

window.addEventListener('resize',()=>{if(!game)return;game.scale.resize(Math.min(PW,window.innerWidth),Math.min(PH,window.innerHeight-36));});

})();
