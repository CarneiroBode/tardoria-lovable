/* Tardoria — Game Client
 * Phaser 3 + Socket.io
 * Suporta Pixel Art Top Down Basic v1.2.3
 * Fallback visual procedural quando assets não encontrados
 */
(function(){
'use strict';

// ── Constantes ───────────────────────────────────────────
const TS    = 16;   // tile size px
const SCALE = 2;    // zoom pixel art
const RW    = 20;   // room width tiles
const RH    = 15;   // room height tiles
const PW    = RW * TS * SCALE;  // 640px
const PH    = RH * TS * SCALE;  // 480px
const SPEED = 90;

const BIOME_CFG = {
  montanha:{ bg:0x2c2f4a, floor:0x3d415e, wall:0x6c757d, accent:0x9a8c98 },
  ruinas:  { bg:0x1e150d, floor:0x3d2b1f, wall:0x6b4226, accent:0x8b5e3c },
  floresta:{ bg:0x0d2218, floor:0x1b4332, wall:0x2d6a4f, accent:0x52b788 },
  cidade:  { bg:0x1c1f24, floor:0x343a40, wall:0x495057, accent:0xadb5bd },
  taverna: { bg:0x2a0f00, floor:0x4a1a00, wall:0x7b2d00, accent:0xe76f51 },
};

const CHAR_COLORS = {
  aventureiro:'#e76f51', guerreiro:'#f4d03f', mago:'#79c0ff',
  ladino:'#c77dff',      clerigo:'#52b788',   default:'#adb5bd',
};

// ── Estado global ─────────────────────────────────────────
let token     = localStorage.getItem('t_token');
let myChar    = null;
let socket    = null;
let game      = null;
let gameScene = null;
let isMobile  = /Mobi|Android|iPhone/i.test(navigator.userAgent);
let activeTrade = null; // incoming trade data
let activeShop  = { partnerId:null, partnerName:null };
let scanToken   = new URLSearchParams(location.search).get('scan');

// ── DOM refs ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const authEl    = $('auth');
const hudEl     = $('hud');
const gameEl    = $('game');
const chatEl    = $('chat');
const actionsEl = $('actions');

// ── AUTH UI ───────────────────────────────────────────────
let isReg = false;
$('auth-toggle').onclick = () => {
  isReg = !isReg;
  $('a-email').style.display = isReg ? '' : 'none';
  $('a-char').style.display  = isReg ? '' : 'none';
  $('auth-submit').textContent = isReg ? 'Registrar' : 'Entrar';
  $('auth-sub').textContent    = isReg ? 'Crie sua conta' : 'Entre no mundo';
  $('auth-toggle').textContent = isReg ? 'Já tem conta? Login' : 'Não tem conta? Registrar';
};

$('auth-submit').onclick = async () => {
  const user = $('a-user').value.trim();
  const pass = $('a-pass').value;
  if (!user || !pass) return;
  $('auth-err').textContent = '';
  try {
    const body = isReg
      ? { username:user, email:$('a-email').value.trim(), password:pass, charName:$('a-char').value.trim()||user }
      : { username:user, password:pass };
    const res  = await fetch(isReg ? '/api/auth/register' : '/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { $('auth-err').textContent = data.error; return; }
    token   = data.token;
    myChar  = data.character;
    localStorage.setItem('t_token', token);
    startGame();
  } catch { $('auth-err').textContent = 'Erro de conexão.'; }
};
['a-user','a-email','a-pass','a-char'].forEach(id =>
  $(id).addEventListener('keydown', e => e.key==='Enter' && $('auth-submit').click())
);

// Auto-login
if (token) {
  fetch('/api/auth/me', { headers:{ Authorization:`Bearer ${token}` } })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if(d){ myChar = d.character; startGame(); } else { localStorage.removeItem('t_token'); token=null; } })
    .catch(()=>{});
}

// ── START GAME ────────────────────────────────────────────
function startGame() {
  authEl.style.display    = 'none';
  hudEl.style.display     = 'flex';
  gameEl.style.display    = 'block';
  chatEl.style.display    = 'block';
  actionsEl.style.display = 'flex';
  if (isMobile) document.getElementById('joystick-zone').style.display = 'block';
  connectSocket();
}

// ── SOCKET.IO ─────────────────────────────────────────────
function connectSocket() {
  socket = io({ auth:{ token } });

  socket.on('connect_error', err => {
    if (err.message==='Token inválido') { localStorage.removeItem('t_token'); location.reload(); }
  });

  socket.on('init', data => {
    myChar = data.player;
    updateHUD(myChar);
    initPhaser(data);
    if (scanToken) handleScan(scanToken);
  });

  socket.on('goldUpdate', ({ gold }) => {
    myChar.gold = gold;
    updateHUD(myChar);
    if (gameScene) gameScene.myGold = gold;
  });

  socket.on('sleepOk',  () => { myChar.isSleeping=true;  $('btn-sleep').style.display='none'; $('btn-wake').style.display=''; });
  socket.on('wakeOk',   () => { myChar.isSleeping=false; $('btn-wake').style.display='none';  $('btn-sleep').style.display=''; });

  socket.on('chat',      onChat);
  socket.on('stealResult', onStealResult);
  socket.on('stolen',    ({ by, amount }) => addChat(null, `⚠️ ${by} roubou ${amount}g de você!`, 'system'));
  socket.on('tradeIncoming', onTradeIncoming);
  socket.on('tradeDone',  () => addChat(null, '✅ Troca concluída!', 'system'));
  socket.on('tradeError', msg => addChat(null, `❌ Troca: ${msg}`, 'system'));
  socket.on('tradeRejected', () => addChat(null, '❌ Troca recusada.', 'system'));

  // Ping
  setInterval(() => {
    const t = Date.now();
    socket.emit('ping_', null, () => { $('hud-ping').textContent = `${Date.now()-t}ms`; });
  }, 3000);
}

// ── HUD ───────────────────────────────────────────────────
function updateHUD(p) {
  $('hud-name').textContent = p.name;
  $('hud-hp').textContent   = `❤ ${p.hp}/${p.hp_max||p.hpMax}`;
  $('hud-gold').textContent = `💰 ${p.gold}g`;
  $('hud-room').textContent = `Sala ${String(p.roomId||p.room_id).padStart(2,'0')}`;
}

// ── CHAT ──────────────────────────────────────────────────
const chatLog = $('chat-log');
function addChat(name, msg, channel='local') {
  const d   = document.createElement('div');
  d.className = `cm-${channel}`;
  d.textContent = name ? `[${name}] ${msg}` : msg;
  chatLog.appendChild(d);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function onChat({ name, message, channel }) { addChat(name, message, channel); }

$('chat-send').onclick = sendChat;
$('chat-input').addEventListener('keydown', e => e.key==='Enter' && sendChat());
function sendChat() {
  const msg = $('chat-input').value.trim();
  if (!msg || !socket) return;
  const channel = msg.startsWith('!g ') ? 'global' : 'local';
  socket.emit('chat', { message: channel==='global' ? msg.slice(3) : msg, channel });
  $('chat-input').value = '';
}

// ── ACTIONS ───────────────────────────────────────────────
$('btn-sleep').onclick = () => socket?.emit('sleep');
$('btn-wake').onclick  = () => socket?.emit('wake');
$('btn-steal').onclick = () => {
  if (!gameScene) return;
  const targets = gameScene.getNearbyPlayers(80);
  if (!targets.length) return addChat(null, 'Nenhum jogador próximo.', 'system');
  socket.emit('steal', { targetCharId: targets[0].charId });
};
$('btn-trade').onclick = () => {
  if (!gameScene) return;
  const targets = gameScene.getNearbyPlayers(80);
  if (!targets.length) return addChat(null, 'Nenhum jogador próximo.', 'system');
  const goldOffer = parseInt(prompt('Quantas moedas você oferece?', '10')) || 0;
  socket.emit('tradePropose', { targetCharId:targets[0].charId, goldOffer });
  addChat(null, `Proposta de troca enviada para ${targets[0].name}...`, 'system');
};

function onStealResult(result) {
  if (result.success) addChat(null, `🗡 Roubo! +${result.amount}g`, 'loot');
  else addChat(null, `🗡 Roubo falhou: ${result.reason}`, 'system');
}
function onTradeIncoming(data) {
  activeTrade = data;
  $('trade-title').textContent = `Troca de ${data.fromName}`;
  $('trade-msg').textContent   = `Ele oferece ${data.goldOffer}g. Quanto você oferece?`;
  $('trade-gold-in').value     = '0';
  $('trade-modal').style.display = 'flex';
}
$('trade-accept').onclick = () => {
  if (!activeTrade) return;
  socket.emit('tradeAccept', {
    partnerSocketId: activeTrade.fromSocketId,
    myGold:          parseInt($('trade-gold-in').value)||0,
    partnerGold:     activeTrade.goldOffer,
  });
  $('trade-modal').style.display = 'none';
  activeTrade = null;
};
$('trade-reject').onclick = () => {
  if (!activeTrade) socket.emit('tradeReject', { partnerSocketId: activeTrade?.fromSocketId });
  $('trade-modal').style.display = 'none';
  activeTrade = null;
};

// ── QR SCAN ───────────────────────────────────────────────
async function handleScan(tkn) {
  if (!tkn || !myChar) return;
  history.replaceState({}, '', '/');
  try {
    const pos = await new Promise(res =>
      navigator.geolocation?.getCurrentPosition(
        p => res({ lat:p.coords.latitude, lng:p.coords.longitude }),
        () => res({ lat:null, lng:null }), { timeout:5000 }
      )
    ).catch(() => ({ lat:null, lng:null }));

    const r = await fetch('/api/partner/scan', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token:tkn, lat:pos?.lat||null, lng:pos?.lng||null, charId:myChar.id })
    });
    const d = await r.json();
    if (!r.ok) return addChat(null, `❌ ${d.error}`, 'system');

    activeShop.partnerId   = d.partnerId;
    activeShop.partnerName = d.partnerName;
    activeShop.items       = d.items;
    openShop(d.partnerName, d.items);
    addChat(null, `🏪 Chegou em ${d.partnerName}! Loja disponível.`, 'loot');
    $('shop-badge').textContent = `🏪 ${d.partnerName} — toque para abrir a loja`;
    $('shop-badge').style.display = 'block';
    $('shop-badge').onclick = () => openShop(d.partnerName, d.items);
  } catch(e) { addChat(null, '❌ Erro ao validar QR.', 'system'); }
}

function openShop(name, items) {
  $('shop-title').textContent = `🏪 ${name}`;
  $('shop-sub').textContent   = `Seus gold: ${myChar?.gold || 0}g`;
  const container = $('shop-items');
  container.innerHTML = '';
  if (!items?.length) { container.innerHTML = '<p style="color:#8b949e;font-size:12px">Sem itens disponíveis.</p>'; }
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-info">
        <div class="shop-item-name rarity-${item.rarity}">${item.name}</div>
        <div class="shop-item-desc">${item.desc}</div>
      </div>
      <div class="shop-item-price">${item.price_gold}g</div>`;
    div.onclick = () => buyItem(item);
    container.appendChild(div);
  });
  $('shop-modal').style.display = 'flex';
}
$('shop-close').onclick = () => { $('shop-modal').style.display = 'none'; };

async function buyItem(item) {
  if (!activeShop.partnerId) return;
  try {
    const r = await fetch('/api/shop/buy', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({ itemKey:item.key, partnerId:activeShop.partnerId })
    });
    const d = await r.json();
    if (!r.ok) return addChat(null, `❌ ${d.error}`, 'system');
    myChar.gold = d.character.gold;
    myChar.hp   = d.character.hp;
    updateHUD(myChar);
    $('shop-sub').textContent = `Seus gold: ${myChar.gold}g`;
    addChat(null, `✅ Comprou ${item.name}!`, 'loot');
    socket?.emit('goldUpdate', { gold:myChar.gold });
  } catch { addChat(null, '❌ Erro na compra.', 'system'); }
}

// ── PHASER GAME ───────────────────────────────────────────
function initPhaser(initData) {
  if (game) { game.destroy(true); game = null; }

  const W = Math.min(PW, window.innerWidth);
  const H = Math.min(PH, window.innerHeight - 36);

  const config = {
    type: Phaser.AUTO,
    width: W, height: H,
    parent: 'game',
    backgroundColor: '#0d1117',
    pixelArt: true,
    physics: { default:'arcade', arcade:{ gravity:{y:0}, debug:false } },
    scene: makeGameScene(initData),
  };

  game = new Phaser.Game(config);
}

function makeGameScene(initData) {
  const others     = new Map(); // charId → {sprite,label,data}
  const keys       = {};
  let   mySprite   = null;
  let   myLabel    = null;
  let   currentRoom = initData.room;
  let   lastDir    = 'down';
  let   lastEmit   = 0;
  let   assetsLoaded = false;

  // Joystick flutuante
  const joy = { active:false, vx:0, vy:0, originX:0, originY:0 };
  const DEAD_ZONE   = 8;   // px mínimo para considerar movimento
  const JOYSTICK_R  = 55;  // raio máximo do knob em px

  function initJoystick() {
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    if (!zone) return;

    function start(e) {
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const rect  = zone.getBoundingClientRect();
      joy.originX = touch.clientX - rect.left;
      joy.originY = touch.clientY - rect.top;
      joy.active  = true;

      base.style.left = joy.originX + 'px';
      base.style.top  = joy.originY + 'px';
      knob.style.left = joy.originX + 'px';
      knob.style.top  = joy.originY + 'px';
      base.style.opacity = '1';
      knob.style.opacity = '1';
    }

    function move(e) {
      if (!joy.active) return;
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const rect  = zone.getBoundingClientRect();
      const dx = touch.clientX - rect.left - joy.originX;
      const dy = touch.clientY - rect.top  - joy.originY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const clamped = Math.min(dist, JOYSTICK_R);
      const angle   = Math.atan2(dy, dx);

      const kx = joy.originX + Math.cos(angle) * clamped;
      const ky = joy.originY + Math.sin(angle) * clamped;
      knob.style.left = kx + 'px';
      knob.style.top  = ky + 'px';

      if (dist < DEAD_ZONE) {
        joy.vx = 0; joy.vy = 0;
      } else {
        joy.vx = (Math.cos(angle) * clamped) / JOYSTICK_R;
        joy.vy = (Math.sin(angle) * clamped) / JOYSTICK_R;
      }
    }

    function end(e) {
      e.preventDefault();
      joy.active = false;
      joy.vx = 0; joy.vy = 0;
      base.style.opacity = '0';
      knob.style.opacity = '0';
    }

    zone.addEventListener('touchstart',  start, { passive:false });
    zone.addEventListener('touchmove',   move,  { passive:false });
    zone.addEventListener('touchend',    end,   { passive:false });
    zone.addEventListener('touchcancel', end,   { passive:false });
    // Mouse para testar no desktop
    zone.addEventListener('mousedown',  start);
    zone.addEventListener('mousemove',  move);
    zone.addEventListener('mouseup',    end);
    zone.addEventListener('mouseleave', end);
  }
  initJoystick();

  return {
    // ── PRELOAD ────────────────────────────────────────────
    preload() {
      // Pixel Art Top Down Basic v1.2.3 — nomes exatos dos arquivos
      const D = '/assets/tilesets/';
      this.load.image('grass',  D+'TX_Tileset_Grass.png');
      this.load.image('stone',  D+'TX_Tileset_Stone.png');
      this.load.image('wall',   D+'TX_Tileset_Wall.png');
      this.load.image('props',  D+'TX_Props.png');
      this.load.image('plants', D+'TX_Plant.png');
      this.load.image('struct', D+'TX_Struct.png');

      // TX_Player.png — 128×128px — 8 colunas × 8 linhas de 16×16
      // Linha 0: down  (walk 0-2, idle 3-5)
      // Linha 1: up    (walk 8-10, idle 11-13)
      // Linha 2: left  (walk 16-19, idle 20-23)
      // Linha 3: right (walk 24-27, idle 28-31)
      this.load.spritesheet('player', '/assets/sprites/TX_Player.png', {
        frameWidth: 16, frameHeight: 16
      });

      // Mapas Tiled JSON
      ['taverna','floresta','montanha','ruinas','cidade'].forEach(name => {
        this.load.tilemapTiledJSON(name, `/assets/maps/${name}.tmj`);
      });

      this.load.on('filecomplete', (key) => {
        if (['grass','stone','wall','props','plants','struct'].includes(key)) assetsLoaded = true;
      });
      this.load.on('loaderror', () => {}); // silencia erros — usa fallback
    },

    // ── CREATE ─────────────────────────────────────────────
    create() {
      // Gera texturas de fallback se assets não carregados
      this._genFallbackTilesets();
      this._genCharTextures();

      // Input teclado
      keys.up    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      keys.down  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      keys.left  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      keys.right = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.physics.world.setBounds(0, 0, PW, PH);
      this._buildRoom(currentRoom);
      this._spawnPlayer(initData.player);
      initData.others.forEach(p => this._addOther(p));

      this.cameras.main.startFollow(mySprite, true, 0.08, 0.08);
      this.cameras.main.setZoom(this.scale.width / PW);

      this._bindSocket();

      gameScene = this;
    },

    // ── UPDATE ─────────────────────────────────────────────
    update() {
      if (!mySprite) return;

      // Teclado (WASD / setas) + joystick analógico
      const kUp    = keys.up?.isDown    || this.input.keyboard.addKey(38)?.isDown;
      const kDown  = keys.down?.isDown  || this.input.keyboard.addKey(40)?.isDown;
      const kLeft  = keys.left?.isDown  || this.input.keyboard.addKey(37)?.isDown;
      const kRight = keys.right?.isDown || this.input.keyboard.addKey(39)?.isDown;

      // Joystick analógico sobrescreve com velocidade proporcional
      let vx = 0, vy = 0;
      if (joy.active && (Math.abs(joy.vx) > 0.05 || Math.abs(joy.vy) > 0.05)) {
        vx = joy.vx * SPEED;
        vy = joy.vy * SPEED;
      } else {
        if (kLeft)  vx = -SPEED;
        if (kRight) vx =  SPEED;
        if (kUp)    vy = -SPEED;
        if (kDown)  vy =  SPEED;
      }

      mySprite.setVelocity(vx, vy);

      let dir = lastDir;
      // Direção dominante pelo eixo com maior magnitude
      if (Math.abs(vx) >= Math.abs(vy)) {
        if (vx < -5) dir = 'left';
        else if (vx > 5) dir = 'right';
      } else {
        if (vy < -5) dir = 'up';
        else if (vy > 5) dir = 'down';
      }

      const moving = Math.abs(vx) > 2 || Math.abs(vy) > 2;
      const anim   = moving ? `walk_${dir}` : `idle_${dir}`;
      try {
        if (mySprite.anims.currentAnim?.key !== anim) mySprite.play(anim, true);
      } catch {}
      lastDir = dir;

      // Atualiza label
      if (myLabel) myLabel.setPosition(mySprite.x, mySprite.y - 14);

      // Emit throttled
      const now = Date.now();
      if (now - lastEmit > 40) {
        socket?.emit('move', { x:mySprite.x/SCALE, y:mySprite.y/SCALE, direction:dir, moving });
        lastEmit = now;
      }

      // Transição de sala
      this._checkTransition();
    },

    // ── HELPERS ────────────────────────────────────────────
    getNearbyPlayers(maxDist) {
      const res = [];
      others.forEach((entry) => {
        const dx = entry.sprite.x - mySprite.x;
        const dy = entry.sprite.y - mySprite.y;
        if (Math.sqrt(dx*dx+dy*dy) < maxDist * SCALE)
          res.push({ charId:entry.data.charId, name:entry.data.name });
      });
      return res;
    },

    // ── ROOM BUILD ─────────────────────────────────────────
    _buildRoom(room) {
      const cfg = BIOME_CFG[room.biome] || BIOME_CFG.floresta;

      // Fundo com cor do bioma
      if (this._bg) this._bg.destroy();
      this._bg = this.add.rectangle(PW/2, PH/2, PW, PH, cfg.bg).setDepth(0);

      // Destroi layers antigos
      if (this._layers) this._layers.forEach(l => l.destroy());
      this._layers = [];
      if (this._wallRects) this._wallRects.forEach(r=>r.destroy());
      this._wallRects = [];
      if (this._decorGroup) this._decorGroup.destroy(true);
      this._decorGroup = this.add.group();
      this._colObjects = [];

      const mapKey = room.mapFile?.replace('.tmj','');

      // Tenta carregar o tilemap real
      let map = null;
      try { map = this.make.tilemap({ key: mapKey }); } catch(e) {}

      if (map) {
        this._buildFromTilemap(map, cfg, room.biome);
      } else {
        this._buildFallbackRoom(cfg, room);
      }
    },

    _buildFromTilemap(map, cfg, biome) {
      // Nomes no TMJ → chave carregada no Phaser
      const tilesetKeys = [
        ['grass',  'grass'],
        ['stone',  'stone'],
        ['wall',   'wall'],
        ['props',  'props'],
        ['plants', 'plants'],
        ['struct', 'struct'],
      ];

      const tilesets = [];
      tilesetKeys.forEach(([name, key]) => {
        try {
          const ts = map.addTilesetImage(name, key);
          if (ts) tilesets.push(ts);
        } catch {}
      });

      // Fallback: se nenhum tileset real carregou, usa os gerados
      if (!tilesets.length || !assetsLoaded) {
        tilesetKeys.forEach(([name, key]) => {
          const fbKey = 'fb_'+key;
          if (this.textures.exists(fbKey)) {
            try { const ts = map.addTilesetImage(name, fbKey); if(ts) tilesets.push(ts); } catch {}
          }
        });
      }

      const layerNames = ['Chão','Floor','Paredes','Árvores','Montanhas','Ruínas','Estruturas','Objetos'];
      layerNames.forEach((name, i) => {
        try {
          const l = map.createLayer(name, tilesets, 0, 0);
          if (!l) return;
          l.setScale(SCALE);
          l.setDepth(i + 1);
          this._layers.push(l);

          // Colisão
          if (['Paredes','Árvores','Montanhas','Ruínas','Estruturas'].includes(name)) {
            l.setCollisionByExclusion([-1, 0]);
            if (mySprite) this.physics.add.collider(mySprite, l);
          }
        } catch {}
      });

      // Extrai objetos do tilemap
      try {
        const objLayer = map.getObjectLayer('Colisão');
        if (objLayer) {
          this._colObjects = objLayer.objects;
          // Adiciona colisores de retângulo para objetos de colisão
          objLayer.objects.forEach(obj => {
            if (obj.type === 'colisao') {
              const rect = this.physics.add.staticImage(
                (obj.x + obj.width/2) * SCALE,
                (obj.y + obj.height/2) * SCALE,
                'px_wall'
              ).setDisplaySize(obj.width * SCALE, obj.height * SCALE).refreshBody();
              rect.setAlpha(0);
              this._wallRects.push(rect);
              if (mySprite) this.physics.add.collider(mySprite, rect);
            }
          });
        }
      } catch {}
    },

    _buildFallbackRoom(cfg, room) {
      const g = this.add.graphics().setDepth(1);

      // Grade de tiles
      g.lineStyle(1, cfg.floor, 0.15);
      for (let x = 0; x <= PW; x += TS*SCALE)   g.lineBetween(x, 0, x, PH);
      for (let y = 0; y <= PH; y += TS*SCALE)    g.lineBetween(0, y, PW, y);
      this._layers.push(g);

      // Borda/parede
      const border = this.add.graphics().setDepth(2);
      border.fillStyle(cfg.wall);
      border.fillRect(0, 0, PW, TS*SCALE);            // topo
      border.fillRect(0, PH-TS*SCALE, PW, TS*SCALE);  // base
      border.fillRect(0, 0, TS*SCALE, PH);             // esq
      border.fillRect(PW-TS*SCALE, 0, TS*SCALE, PH);  // dir
      this._layers.push(border);

      // Colisão das bordas
      const walls = [
        [PW/2, TS*SCALE/2, PW, TS*SCALE],
        [PW/2, PH-TS*SCALE/2, PW, TS*SCALE],
        [TS*SCALE/2, PH/2, TS*SCALE, PH],
        [PW-TS*SCALE/2, PH/2, TS*SCALE, PH],
      ];
      walls.forEach(([x,y,w,h]) => {
        const r = this.physics.add.staticImage(x, y, 'px_wall')
          .setDisplaySize(w, h).refreshBody().setAlpha(0);
        this._wallRects.push(r);
        if (mySprite) this.physics.add.collider(mySprite, r);
      });

      // Decoração por bioma
      this._drawBiomeDecor(cfg, room.biome);

      // Passagens nas paredes (saídas)
      const { connections } = room;
      this._drawExits(connections);
    },

    _drawBiomeDecor(cfg, biome) {
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(cfg.accent, 0.6);

      const decorators = {
        taverna: () => {
          // Balcão central
          g.fillStyle(cfg.wall);
          g.fillRect(7*TS*SCALE, 4*TS*SCALE, 6*TS*SCALE, 3*TS*SCALE);
          g.fillStyle(cfg.accent, 0.8);
          g.fillRect(7.2*TS*SCALE, 4.2*TS*SCALE, 5.6*TS*SCALE, 2.6*TS*SCALE);
          // Mesas
          [[2,2],[14,2],[2,9],[14,9],[5,9],[11,9]].forEach(([tx,ty]) => {
            g.fillStyle(cfg.accent, 0.5);
            g.fillCircle(tx*TS*SCALE+TS*SCALE/2, ty*TS*SCALE+TS*SCALE/2, TS*SCALE*0.8);
          });
          // Lareira
          g.fillStyle(0xe76f51, 0.7);
          g.fillRect(9*TS*SCALE, 1*TS*SCALE, 2*TS*SCALE, TS*SCALE);
          this._layers.push(g);
        },
        floresta: () => {
          const trees = [[2,2],[16,2],[3,5],[15,5],[4,9],[14,9],[2,12],[17,12],[6,3],[13,3]];
          trees.forEach(([tx,ty]) => {
            g.fillStyle(0x1b4332);
            g.fillCircle(tx*TS*SCALE+TS*SCALE, ty*TS*SCALE+TS*SCALE, TS*SCALE*1.2);
            g.fillStyle(0x2d6a4f);
            g.fillCircle(tx*TS*SCALE+TS*SCALE, ty*TS*SCALE+TS*SCALE, TS*SCALE*0.9);
            g.fillStyle(0x52b788, 0.5);
            g.fillCircle(tx*TS*SCALE+TS*SCALE, ty*TS*SCALE+TS*SCALE, TS*SCALE*0.5);
          });
          this._layers.push(g);
        },
        montanha: () => {
          // Picos de montanha
          g.fillStyle(0x6c757d);
          const pts1 = [4,6, 10,2, 16,6];
          g.fillTriangle(pts1[0]*TS*SCALE,7*TS*SCALE, pts1[1]*TS*SCALE,2*TS*SCALE, pts1[2]*TS*SCALE,7*TS*SCALE);
          g.fillStyle(0x9a8c98);
          const pts2 = [7,8, 13,3, 19,8];
          g.fillTriangle(pts2[0]*TS*SCALE,8*TS*SCALE, pts2[1]*TS*SCALE,3*TS*SCALE, pts2[2]*TS*SCALE,8*TS*SCALE);
          g.fillStyle(0xffffff, 0.3);
          g.fillTriangle(10*TS*SCALE,2*TS*SCALE, 9.3*TS*SCALE,3.5*TS*SCALE, 10.7*TS*SCALE,3.5*TS*SCALE);
          this._layers.push(g);
        },
        cidade: () => {
          // Prédios
          [[1,1,4,5],[13,1,4,5],[1,8,5,5],[12,8,5,5]].forEach(([tx,ty,tw,th]) => {
            g.fillStyle(cfg.wall);
            g.fillRect(tx*TS*SCALE, ty*TS*SCALE, tw*TS*SCALE, th*TS*SCALE);
            g.fillStyle(0xffe066, 0.4);
            // janelas
            for(let wy=1;wy<th-1;wy++) for(let wx=1;wx<tw-1;wx+=2) {
              g.fillRect((tx+wx)*TS*SCALE+2, (ty+wy)*TS*SCALE+2, TS*SCALE-4, TS*SCALE-4);
            }
          });
          this._layers.push(g);
        },
        ruinas: () => {
          [[2,1,2,3],[15,1,2,3],[4,4,3,4],[11,4,3,4],[8,7,4,3]].forEach(([tx,ty,tw,th]) => {
            g.fillStyle(cfg.wall, 0.7);
            g.fillRect(tx*TS*SCALE, ty*TS*SCALE, tw*TS*SCALE, th*TS*SCALE);
            g.fillStyle(0x000000, 0.3);
            g.fillRect(tx*TS*SCALE+2, ty*TS*SCALE+2, tw*TS*SCALE-4, Math.floor(th/2)*TS*SCALE);
          });
          // Altar
          g.fillStyle(0x8b5e3c);
          g.fillRect(8*TS*SCALE, 6*TS*SCALE, 4*TS*SCALE, 2*TS*SCALE);
          this._layers.push(g);
        },
      };

      (decorators[biome] || decorators.floresta)();
    },

    _drawExits(connections) {
      const g = this.add.graphics().setDepth(3);
      const gapW = 3*TS*SCALE;
      const midX = PW/2;
      const midY = PH/2;

      if (connections?.norte !== null) {
        g.fillStyle(0x52b788, 0.3);
        g.fillRect(midX - gapW/2, 0, gapW, TS*SCALE);
      }
      if (connections?.sul !== null) {
        g.fillStyle(0x52b788, 0.3);
        g.fillRect(midX - gapW/2, PH - TS*SCALE, gapW, TS*SCALE);
      }
      if (connections?.oeste !== null) {
        g.fillStyle(0x52b788, 0.3);
        g.fillRect(0, midY - gapW/2, TS*SCALE, gapW);
      }
      if (connections?.leste !== null) {
        g.fillStyle(0x52b788, 0.3);
        g.fillRect(PW - TS*SCALE, midY - gapW/2, TS*SCALE, gapW);
      }
      this._layers.push(g);
    },

    _checkTransition() {
      if (!mySprite || !currentRoom?.connections) return;
      const mx = mySprite.x, my = mySprite.y;
      const M  = TS*SCALE*1.5;
      const { norte, sul, oeste, leste } = currentRoom.connections;
      const midX = PW/2, midY = PH/2;

      if (norte !== null && my < M    && Math.abs(mx-midX) < TS*SCALE*3) this._goRoom(norte, midX, PH-3*TS*SCALE);
      if (sul   !== null && my > PH-M && Math.abs(mx-midX) < TS*SCALE*3) this._goRoom(sul,   midX, 2*TS*SCALE);
      if (oeste !== null && mx < M    && Math.abs(my-midY) < TS*SCALE*3) this._goRoom(oeste, PW-3*TS*SCALE, midY);
      if (leste !== null && mx > PW-M && Math.abs(my-midY) < TS*SCALE*3) this._goRoom(leste, 2*TS*SCALE, midY);
    },

    _goRoom(roomId, entryX, entryY) {
      if (this._transitioning) return;
      this._transitioning = true;
      socket?.emit('changeRoom', { roomId, x:entryX/SCALE, y:entryY/SCALE });
      this.time.delayedCall(500, () => { this._transitioning = false; });
    },

    // ── PLAYER SPAWN ───────────────────────────────────────
    _spawnPlayer(p) {
      const x = (p.x||p.pos_x||160) * SCALE;
      const y = (p.y||p.pos_y||180) * SCALE;

      // Usa TX_Player.png se carregado, senão gera fallback
      const texKey = this.textures.exists('player') ? 'player' : 'char_my';

      mySprite = this.physics.add.sprite(x, y, texKey).setScale(SCALE).setDepth(10);
      mySprite.setCollideWorldBounds(true);
      mySprite.body.setSize(10, 12); // hitbox menor que sprite

      // Animações — TX_Player.png: 8 colunas × 8 linhas de 16px
      // Linha 0 (down):  walk frames 0,1,2  | idle frame 3
      // Linha 1 (up):    walk frames 8,9,10 | idle frame 11
      // Linha 2 (left):  walk frames 16,17,18,19 | idle frame 20
      // Linha 3 (right): walk frames 24,25,26,27 | idle frame 28
      const anims = [
        { key:'walk_down',  frames:[0,1,2],        rate:8 },
        { key:'idle_down',  frames:[3],             rate:1 },
        { key:'walk_up',    frames:[8,9,10],        rate:8 },
        { key:'idle_up',    frames:[11],            rate:1 },
        { key:'walk_left',  frames:[16,17,18,19],   rate:8 },
        { key:'idle_left',  frames:[20],            rate:1 },
        { key:'walk_right', frames:[24,25,26,27],   rate:8 },
        { key:'idle_right', frames:[28],            rate:1 },
      ];
      anims.forEach(({ key, frames, rate }) => {
        if (!this.anims.exists(key)) {
          this.anims.create({
            key, frameRate: rate, repeat: rate > 1 ? -1 : 0,
            frames: frames.map(f => ({ key: texKey, frame: f })),
          });
        }
      });

      mySprite.play('idle_down', true);

      myLabel = this.add.text(x, y-14, p.name, {
        fontSize:`${7*SCALE}px`, fill:'#fff', stroke:'#000', strokeThickness:3
      }).setOrigin(0.5,1).setDepth(11);

      // Adiciona colisores com walls
      this._wallRects.forEach(r => this.physics.add.collider(mySprite, r));
      this._layers.filter(l => l.setCollisionByExclusion).forEach(l => {
        this.physics.add.collider(mySprite, l);
      });
    },

    // ── OTHER PLAYERS ──────────────────────────────────────
    _addOther(p) {
      if (others.has(p.charId)) return;
      const x   = (p.x || 160) * SCALE;
      const y   = (p.y || 180) * SCALE;
      const key = this.textures.exists('player') ? 'player' : 'char_other';

      const sprite = this.add.sprite(x, y, key).setScale(SCALE).setDepth(9);
      sprite.play('idle_down', true);
      const label  = this.add.text(x, y-14, p.name, {
        fontSize:`${7*SCALE}px`, fill:'#aaa', stroke:'#000', strokeThickness:2
      }).setOrigin(0.5,1).setDepth(10);

      others.set(p.charId, { sprite, label, data:p });
    },

    _removeOther(charId) {
      const entry = others.get(charId);
      if (!entry) return;
      entry.sprite.destroy();
      entry.label.destroy();
      others.delete(charId);
    },

    // ── TEXTURES GEN ───────────────────────────────────────
    _genFallbackTilesets() {
      const sets = [
        ['fb_grass',   0x2d6a4f, 256],
        ['fb_stone',   0x495057, 256],
        ['fb_wall',    0x6b4226, 1024],
        ['fb_props',   0x6c757d, 1024],
        ['fb_plants',  0x1b4332, 1024],
        ['fb_struct',  0x343a40, 1024],
      ];
      sets.forEach(([key, baseColor, count]) => {
        if (this.textures.exists(key)) return;
        const cols  = key.includes('grass')||key.includes('stone') ? 16 : 32;
        const rows  = Math.ceil(count / cols);
        const canvas = document.createElement('canvas');
        canvas.width = cols * TS; canvas.height = rows * TS;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < count; i++) {
          const col = i % cols, row = Math.floor(i / cols);
          const r   = (baseColor >> 16) & 0xff;
          const g   = (baseColor >>  8) & 0xff;
          const b   =  baseColor        & 0xff;
          const var_ = (i % 7) * 8 - 24;
          ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,r+var_))},${Math.max(0,Math.min(255,g+var_))},${Math.max(0,Math.min(255,b+var_))})`;
          ctx.fillRect(col*TS, row*TS, TS, TS);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.strokeRect(col*TS+0.5, row*TS+0.5, TS-1, TS-1);
        }
        this.textures.addCanvas(key, canvas);
        // Registra também sem prefixo fb_ para addTilesetImage
        const realKey = key.replace('fb_','');
        if (!this.textures.exists(realKey)) {
          this.textures.addCanvas(realKey, canvas);
        }
      });

      // Pixel wall invisível para colisores
      if (!this.textures.exists('px_wall')) {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0,0,16,16);
        this.textures.addCanvas('px_wall', c);
      }
    },

    _genCharTextures() {
      // Gera sprite de fallback apenas se TX_Player não foi carregado
      if (!this.textures.exists('char_my'))    this._makeCharCanvas('char_my',    '#e76f51');
      if (!this.textures.exists('char_other')) this._makeCharCanvas('char_other', '#79c0ff');
    },

    _makeCharCanvas(key, bodyColor) {
      if (this.textures.exists(key)) return;
      // 4 dirs × 3 frames = 12 frames, 16×16 each
      const DIRS = 4, FRAMES = 3;
      const W = DIRS * FRAMES * TS, H = TS;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      const dirAngles = [Math.PI/2, -Math.PI/2, Math.PI, 0]; // down left right up

      for (let d = 0; d < DIRS; d++) {
        for (let f = 0; f < FRAMES; f++) {
          const bx = (d * FRAMES + f) * TS;
          const by = 0;
          const cx = bx + TS/2, cy = by + TS/2;

          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath(); ctx.ellipse(cx, cy+5, 5, 3, 0, 0, Math.PI*2); ctx.fill();

          // Body
          ctx.fillStyle = bodyColor;
          ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();

          // Outline
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.stroke();

          // Eyes / face direction
          const angle  = dirAngles[d];
          const ex     = cx + Math.cos(angle) * 2.5;
          const ey     = cy + Math.sin(angle) * 2.5;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(ex + Math.cos(angle)*0.5, ey + Math.sin(angle)*0.5, 0.9, 0, Math.PI*2); ctx.fill();

          // Bobbing on walk frames
          if (f === 1) {
            // slight offset visual handled via frame difference already
          }
        }
      }
      this.textures.addCanvas(key, canvas);
    },

    _createAnims(texKey, startFrame) {
      const dirNames = ['down','left','right','up'];
      dirNames.forEach((dir, d) => {
        const base = d * 3;
        const animKey = `${texKey}_walk_${dir}`;
        const idleKey = `${texKey}_idle_${dir}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({ key:animKey, frames:this.anims.generateFrameNumbers(texKey,{start:base,end:base+2}), frameRate:8, repeat:-1 });
        }
        if (!this.anims.exists(idleKey)) {
          this.anims.create({ key:idleKey, frames:[{key:texKey,frame:base}], frameRate:1 });
        }
      });
      // Simplifica: usa mesma anim key sem textura prefix para compatibilidade
      const genericKeys = ['walk_down','walk_left','walk_right','walk_up','idle_down','idle_left','idle_right','idle_up'];
      genericKeys.forEach(k => {
        if (!this.anims.exists(k)) {
          const existing = `${texKey}_${k}`;
          if (this.anims.exists(existing)) {
            const src = this.anims.get(existing);
            this.anims.create({ key:k, frames:src.frames.map(f=>({key:f.textureKey,frame:f.textureFrame})), frameRate:8, repeat:k.startsWith('walk')?-1:0 });
          }
        }
      });
    },

    // ── SOCKET EVENTS ─────────────────────────────────────
    _bindSocket() {
      const scene = this;

      socket.on('tick', (list) => {
        list.forEach(p => {
          if (p.charId === myChar?.id) return;
          const entry = others.get(p.charId);
          if (!entry) return;
          entry.sprite.setPosition(p.x * SCALE, p.y * SCALE);
          entry.label.setPosition(p.x * SCALE, p.y * SCALE - 14);
          const dir  = p.direction || 'down';
          const anim = p.moving ? `walk_${dir}` : `idle_${dir}`;
          try { entry.sprite.play(anim, true); } catch {}
          entry.sprite.setAlpha(p.isSleeping ? 0.5 : 1);
        });
      });

      socket.on('player:join',  p => { scene._addOther(p); addChat(null, `${p.name} entrou na sala.`, 'system'); });
      socket.on('player:leave', ({ charId }) => { scene._removeOther(charId); });
      socket.on('player:sleep', ({ charId }) => { const e = others.get(charId); if(e) e.sprite.setAlpha(0.5); });
      socket.on('player:wake',  ({ charId }) => { const e = others.get(charId); if(e) e.sprite.setAlpha(1); });
      socket.on('player:moved', ({ charId, x, y, direction, moving }) => {
        const e = others.get(charId);
        if (!e) return;
        e.sprite.setPosition(x*SCALE, y*SCALE);
        e.label.setPosition(x*SCALE, y*SCALE-14);
      });

      socket.on('roomChanged', (data) => {
        currentRoom = data.room;
        myChar.roomId = data.player.roomId;
        updateHUD(data.player);
        // Limpa outros
        others.forEach((e,id) => { e.sprite.destroy(); e.label.destroy(); });
        others.clear();
        // Rebuild
        scene._buildRoom(currentRoom);
        // Reposiciona meu sprite
        if (mySprite) {
          mySprite.setPosition(data.player.x * SCALE, data.player.y * SCALE);
          // Reaplica colisores
          scene._wallRects.forEach(r => scene.physics.add.collider(mySprite, r));
        }
        data.others.forEach(p => scene._addOther(p));
        addChat(null, `Chegou em ${currentRoom.label} (Sala ${currentRoom.id})`, 'system');
      });
    },
  };
}

// Resize handler
window.addEventListener('resize', () => {
  if (!game) return;
  const W = Math.min(PW, window.innerWidth);
  const H = Math.min(PH, window.innerHeight - 36);
  game.scale.resize(W, H);
  if (game.scene.getScene('default')) {
    game.scene.getScene('default').cameras?.main?.setZoom(W / PW);
  }
});

})();
