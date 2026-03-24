require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const jwt        = require('jsonwebtoken');
const fs         = require('fs');
const db         = require('./src/db/db');
const { router: authRouter }    = require('./src/routes/auth');
const { router: partnerRouter } = require('./src/routes/partner');
const { router: shopRouter }    = require('./src/routes/shop');
const players    = require('./src/game/PlayerManager');
const { ROOMS }  = require('./src/game/WorldMap');

const PORT = process.env.PORT || 4000;

// ── Express ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth',    authRouter);
app.use('/api/partner', partnerRouter);
app.use('/api/shop',    shopRouter);

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

// QR scan redirect
app.get('/scan', (req, res) => {
  const token = req.query.token;
  res.redirect(`/?scan=${token}`);
});

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Socket.io ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin:'*' },
  pingInterval: 10000,
  pingTimeout:  5000,
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token não fornecido'));
  try {
    const p   = jwt.verify(token, process.env.JWT_SECRET);
    const res = await db.query(`SELECT * FROM characters WHERE id=$1 AND user_id=$2`, [p.charId, p.userId]);
    if (!res.rows.length) return next(new Error('Personagem não encontrado'));
    socket.character = res.rows[0];
    next();
  } catch { next(new Error('Token inválido')); }
});

io.on('connection', async (socket) => {
  const char   = socket.character;
  const player = await players.connect(socket.id, char);
  const roomKey = `room:${player.roomId}`;

  console.log(`[+] ${player.name} → Sala ${player.roomId}`);

  socket.join(roomKey);
  socket.emit('init', {
    player,
    room:   ROOMS[player.roomId],
    others: players.getInRoom(player.roomId).filter(p => p.socketId !== socket.id),
  });
  socket.to(roomKey).emit('player:join', player);

  // ── Movimento ─────────────────────────────────────────
  socket.on('move', (data) => {
    const p = players.move(socket.id, data);
    if (!p) return;
    socket.to(`room:${p.roomId}`).emit('player:moved', {
      charId:p.charId, x:p.x, y:p.y, direction:p.direction, moving:p.moving,
    });
  });

  // ── Troca de sala ─────────────────────────────────────
  socket.on('changeRoom', async ({ roomId, x, y }) => {
    const room = ROOMS[roomId];
    if (!room) return;
    const oldKey = `room:${player.roomId}`;
    socket.to(oldKey).emit('player:leave', { charId:player.charId });
    socket.leave(oldKey);

    const updated = await players.changeRoom(socket.id, roomId, x ?? room.spawnX, y ?? room.spawnY);
    const newKey  = `room:${roomId}`;
    socket.join(newKey);

    socket.emit('roomChanged', {
      room: ROOMS[roomId],
      others: players.getInRoom(roomId).filter(p => p.socketId !== socket.id),
      player: updated,
    });
    socket.to(newKey).emit('player:join', updated);
  });

  // ── Chat ─────────────────────────────────────────────
  socket.on('chat', async ({ message, channel }) => {
    if (!message?.trim() || message.length > 200) return;
    const p = players.getBySocket(socket.id);
    if (!p) return;
    const payload = { charId:p.charId, name:p.name, message:message.trim(), channel:channel||'local', ts:Date.now() };
    if (channel === 'global') io.emit('chat', payload);
    else io.to(`room:${p.roomId}`).emit('chat', payload);
    db.query(`INSERT INTO chat_log(room_id,character_id,channel,message)VALUES($1,$2,$3,$4)`,
      [p.roomId, p.charId, payload.channel, payload.message]).catch(()=>{});
  });

  // ── Dormir / Acordar ──────────────────────────────────
  socket.on('sleep', async () => {
    const p = await players.sleep(socket.id);
    if (!p) return;
    io.to(`room:${p.roomId}`).emit('player:sleep', { charId:p.charId });
    socket.emit('sleepOk', { isSleeping:true });
  });
  socket.on('wake', async () => {
    const p = await players.wake(socket.id);
    if (!p) return;
    io.to(`room:${p.roomId}`).emit('player:wake', { charId:p.charId });
    socket.emit('wakeOk', { isSleeping:false });
  });

  // ── Roubo ────────────────────────────────────────────
  socket.on('steal', async ({ targetCharId }) => {
    const result = await players.steal(socket.id, targetCharId);
    socket.emit('stealResult', result);
    if (result.success && result.targetSid) {
      const thief = players.getBySocket(socket.id);
      io.to(result.targetSid).emit('stolen', { by:thief?.name, amount:result.amount });
    }
    // Atualiza gold no HUD do ladrão
    const thief = players.getBySocket(socket.id);
    if (thief) socket.emit('goldUpdate', { gold:thief.gold });
  });

  // ── Troca ────────────────────────────────────────────
  socket.on('tradePropose', ({ targetCharId, goldOffer }) => {
    const tgt = players.getByChar(targetCharId);
    if (!tgt) return socket.emit('tradeError', 'Jogador offline.');
    const me = players.getBySocket(socket.id);
    io.to(tgt.socketId).emit('tradeIncoming', {
      fromCharId:me.charId, fromName:me.name, goldOffer, fromSocketId:socket.id
    });
  });
  socket.on('tradeAccept', async ({ partnerSocketId, myGold, partnerGold }) => {
    const ok = await players.trade(socket.id, partnerSocketId, myGold, partnerGold);
    if (!ok) return socket.emit('tradeError', 'Gold insuficiente.');
    const me = players.getBySocket(socket.id);
    const pt = players.getBySocket(partnerSocketId);
    if (me) socket.emit('goldUpdate', { gold:me.gold });
    if (pt) io.to(partnerSocketId).emit('goldUpdate', { gold:pt.gold });
    socket.emit('tradeDone');
    io.to(partnerSocketId).emit('tradeDone');
  });
  socket.on('tradeReject', ({ partnerSocketId }) => {
    io.to(partnerSocketId).emit('tradeRejected');
  });

  // ── Ping ─────────────────────────────────────────────
  socket.on('ping_', (_, cb) => { if(typeof cb==='function') cb(); });

  // ── Desconectar ──────────────────────────────────────
  socket.on('disconnect', async () => {
    const p = await players.disconnect(socket.id);
    if (p) {
      console.log(`[-] ${p.name}`);
      io.to(`room:${p.roomId}`).emit('player:leave', { charId:p.charId });
    }
  });
});

// ── Game Tick (20/s) ─────────────────────────────────────
const TICK = Math.round(1000 / (Number(process.env.TICK_RATE)||20));
setInterval(() => {
  const byRoom = new Map();
  for (const p of players.players.values()) {
    if (!byRoom.has(p.roomId)) byRoom.set(p.roomId, []);
    byRoom.get(p.roomId).push({ charId:p.charId, x:p.x, y:p.y, direction:p.direction, moving:p.moving, isSleeping:p.isSleeping });
  }
  byRoom.forEach((list, roomId) => io.to(`room:${roomId}`).emit('tick', list));
}, TICK);

// ── Boot ────────────────────────────────────────────────
async function boot() {
  await db.query('SELECT 1');
  console.log('[db] ✅ PostgreSQL conectado');
  const sql = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
  await db.query(sql).catch(e => console.warn('[db] schema:', e.message.slice(0,60)));
  server.listen(PORT, () => {
    console.log(`\n🍺 Tardoria rodando → http://localhost:${PORT}`);
    console.log(`   tardoriasales  → http://localhost:${PORT}/partner`);
    console.log(`   TV screen      → http://localhost:${PORT}/tv\n`);
  });
}
boot().catch(e => { console.error('[boot]', e.message); process.exit(1); });
