// server.js — Tardoria RPG Server
require('dotenv').config();

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');
const jwt       = require('jsonwebtoken');
const db        = require('./src/db/db');
const { router: authRouter } = require('./src/routes/auth');
const players   = require('./src/game/PlayerManager');
const { ROOMS } = require('./src/game/WorldMap');

const PORT     = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;

// ── Express ──────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(express.json());
// Serve React build (dist/) first, then fallback to public/
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');
const fs = require('fs');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(publicPath));
}
app.use('/api/auth', authRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// SPA fallback
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ── Socket.io ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Middleware: valida JWT antes de conectar
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token não fornecido'));

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.userId;
    socket.charId = payload.charId;

    const charRes = await db.query(
      `SELECT * FROM characters WHERE id = $1 AND user_id = $2`,
      [payload.charId, payload.userId]
    );
    if (!charRes.rows.length) return next(new Error('Personagem não encontrado'));
    socket.character = charRes.rows[0];
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

// ── Eventos Socket ───────────────────────────────────────
io.on('connection', async (socket) => {
  const char = socket.character;
  const player = await players.connect(socket.id, char);

  console.log(`[+] ${player.name} (sala ${player.roomId})`);

  // Entra na sala atual
  const roomKey = `room:${player.roomId}`;
  socket.join(roomKey);

  // Envia estado inicial ao jogador
  const roomPlayers = players.getInRoom(player.roomId)
    .filter(p => p.socketId !== socket.id);

  socket.emit('init', {
    player,
    room:    ROOMS[player.roomId],
    others:  roomPlayers,
  });

  // Avisa outros na sala que alguém chegou
  socket.to(roomKey).emit('player:join', player);

  // ── Movimento ─────────────────────────────────────────
  socket.on('player:move', (data) => {
    const updated = players.move(socket.id, data);
    if (!updated) return;
    socket.to(`room:${updated.roomId}`).emit('player:moved', {
      charId: updated.charId,
      x: updated.x, y: updated.y,
      direction: updated.direction,
      moving: updated.moving,
    });
  });

  // ── Troca de sala ─────────────────────────────────────
  socket.on('player:changeRoom', async ({ roomId, x, y }) => {
    const room = ROOMS[roomId];
    if (!room) return;

    const oldRoomKey = `room:${player.roomId}`;
    socket.to(oldRoomKey).emit('player:leave', { charId: player.charId });
    socket.leave(oldRoomKey);

    const updated = await players.changeRoom(socket.id, roomId, x ?? room.spawnX, y ?? room.spawnY);
    const newRoomKey = `room:${roomId}`;
    socket.join(newRoomKey);

    const others = players.getInRoom(roomId).filter(p => p.socketId !== socket.id);
    socket.emit('room:changed', {
      room:   ROOMS[roomId],
      others,
      player: updated,
    });

    socket.to(newRoomKey).emit('player:join', updated);
  });

  // ── Chat ─────────────────────────────────────────────
  socket.on('chat:send', async ({ message, channel }) => {
    if (!message?.trim() || message.length > 200) return;
    const p = players.getBySocket(socket.id);
    if (!p) return;

    const payload = {
      charId:  p.charId,
      name:    p.name,
      message: message.trim(),
      channel: channel || 'local',
      ts:      Date.now(),
    };

    if (channel === 'global') {
      io.emit('chat:message', payload);
    } else {
      io.to(`room:${p.roomId}`).emit('chat:message', payload);
    }

    // Persiste assíncronamente (sem aguardar)
    db.query(
      `INSERT INTO chat_log (room_id, character_id, channel, message) VALUES ($1,$2,$3,$4)`,
      [p.roomId, p.charId, payload.channel, payload.message]
    ).catch(() => {});
  });

  // ── Dormir ───────────────────────────────────────────
  socket.on('action:sleep', async () => {
    const p = await players.sleep(socket.id);
    if (!p) return;
    io.to(`room:${p.roomId}`).emit('player:sleep', { charId: p.charId });
    socket.emit('action:sleep:ok');
  });

  socket.on('action:wake', async () => {
    const p = await players.wake(socket.id);
    if (!p) return;
    io.to(`room:${p.roomId}`).emit('player:wake', { charId: p.charId });
    socket.emit('action:wake:ok');
  });

  // ── Roubo ────────────────────────────────────────────
  socket.on('action:steal', async ({ targetCharId }) => {
    const result = await players.steal(socket.id, targetCharId);
    socket.emit('action:steal:result', result);

    if (result.success && result.targetSid) {
      const thief = players.getBySocket(socket.id);
      io.to(result.targetSid).emit('action:stolen', {
        by:     thief?.name,
        amount: result.amount,
      });
    }
  });

  // ── Troca ────────────────────────────────────────────
  // Fase 1: proposta
  socket.on('trade:propose', ({ targetCharId, goldOffer }) => {
    const tgt = players.getByChar(targetCharId);
    if (!tgt) return socket.emit('trade:error', 'Jogador offline');

    const proposer = players.getBySocket(socket.id);
    io.to(tgt.socketId).emit('trade:incoming', {
      fromCharId: proposer.charId,
      fromName:   proposer.name,
      goldOffer,
      socketId:   socket.id,
    });
  });

  // Fase 2: aceite
  socket.on('trade:accept', async ({ partnerSocketId, myGold, partnerGold }) => {
    const ok = await players.acceptTrade(socket.id, partnerSocketId, myGold, partnerGold, [], []);
    const me = players.getBySocket(socket.id);
    const pt = players.getBySocket(partnerSocketId);
    if (ok && me && pt) {
      socket.emit('trade:done',              { gold: me.gold });
      io.to(partnerSocketId).emit('trade:done', { gold: pt.gold });
    }
  });

  socket.on('trade:reject', ({ partnerSocketId }) => {
    io.to(partnerSocketId).emit('trade:rejected');
  });

  // ── Desconectar ──────────────────────────────────────
  socket.on('disconnect', async () => {
    const p = await players.disconnect(socket.id);
    if (p) {
      console.log(`[-] ${p.name} (sala ${p.roomId})`);
      io.to(`room:${p.roomId}`).emit('player:leave', { charId: p.charId });
    }
  });
});

// ── Game Loop: tick de posições ──────────────────────────
// Broadcasteia estado dos jogadores a cada 50ms (20 tick/s)
const TICK_RATE = Number(process.env.TICK_RATE) || 20;
setInterval(() => {
  // Agrupa jogadores por sala e envia snapshot
  const byRoom = new Map();
  for (const p of players.players.values()) {
    if (!byRoom.has(p.roomId)) byRoom.set(p.roomId, []);
    byRoom.get(p.roomId).push({
      charId: p.charId, x: p.x, y: p.y,
      direction: p.direction, moving: p.moving,
      isSleeping: p.isSleeping,
    });
  }
  byRoom.forEach((list, roomId) => {
    io.to(`room:${roomId}`).emit('world:tick', list);
  });
}, Math.round(1000 / TICK_RATE));

// ── Inicialização ────────────────────────────────────────
async function start() {
  // Testa conexão com banco
  try {
    await db.query('SELECT 1');
    console.log('[db] ✅ PostgreSQL conectado');
  } catch (err) {
    console.error('[db] ❌ Falha ao conectar ao banco:', err.message);
    process.exit(1);
  }

  // Roda migrations automaticamente
  const fs   = require('fs');
  const path = require('path');
  const sql  = fs.readFileSync(path.join(__dirname, 'src/db/schema.sql'), 'utf8');
  await db.query(sql).catch(() => {}); // ignora se tabelas já existem

  server.listen(PORT, () => {
    console.log(`\n🍺 Tardoria rodando em http://localhost:${PORT}`);
    console.log(`   Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Tick: ${TICK_RATE}/s\n`);
  });
}

start();
