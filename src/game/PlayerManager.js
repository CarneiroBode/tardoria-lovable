// src/game/PlayerManager.js
// Gerencia jogadores conectados em memória + sync com banco

const db = require('../db/db');

class PlayerManager {
  constructor() {
    // socketId → playerState
    this.players = new Map();
    // charId → socketId
    this.charIndex = new Map();
  }

  // ── Conectar ─────────────────────────────────────────
  async connect(socketId, character) {
    const state = {
      socketId,
      charId:   character.id,
      userId:   character.user_id,
      name:     character.name,
      class:    character.class,
      sprite:   character.sprite,
      hp:       character.hp,
      hpMax:    character.hp_max,
      gold:     character.gold,
      level:    character.level,
      roomId:   character.room_id,
      x:        character.pos_x,
      y:        character.pos_y,
      isSleeping: character.is_sleeping,
      direction: 'down',
      moving:   false,
    };

    this.players.set(socketId, state);
    this.charIndex.set(character.id, socketId);

    return state;
  }

  // ── Desconectar ──────────────────────────────────────
  async disconnect(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    // Persiste posição no banco
    await this.savePosition(player);

    this.players.delete(socketId);
    this.charIndex.delete(player.charId);
    return player;
  }

  // ── Mover ────────────────────────────────────────────
  move(socketId, { x, y, direction, moving }) {
    const player = this.players.get(socketId);
    if (!player || player.isSleeping) return null;

    player.x = x;
    player.y = y;
    player.direction = direction;
    player.moving = moving;
    return player;
  }

  // ── Trocar de sala ───────────────────────────────────
  async changeRoom(socketId, newRoomId, entryX, entryY) {
    const player = this.players.get(socketId);
    if (!player) return null;

    await this.savePosition(player);

    player.roomId = newRoomId;
    player.x = entryX;
    player.y = entryY;
    player.moving = false;
    return player;
  }

  // ── Dormir ───────────────────────────────────────────
  async sleep(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    player.isSleeping = true;
    const sleepUntil = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h

    await db.query(
      `UPDATE characters SET is_sleeping = TRUE, sleep_until = $1 WHERE id = $2`,
      [sleepUntil, player.charId]
    );
    return player;
  }

  // ── Acordar ──────────────────────────────────────────
  async wake(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;

    player.isSleeping = false;

    await db.query(
      `UPDATE characters SET is_sleeping = FALSE, sleep_until = NULL WHERE id = $1`,
      [player.charId]
    );
    return player;
  }

  // ── Roubo ────────────────────────────────────────────
  async steal(thiefSocketId, targetCharId) {
    const thief  = this.players.get(thiefSocketId);
    const tgtSid = this.charIndex.get(targetCharId);
    const target = tgtSid ? this.players.get(tgtSid) : null;

    if (!thief || !target) return { success: false, reason: 'jogador_ausente' };
    if (thief.roomId !== target.roomId) return { success: false, reason: 'sala_diferente' };
    if (target.isSleeping) {
      // Roubo garantido em personagem dormindo
      const amount = Math.floor(target.gold * 0.2) || 1;
      target.gold  -= amount;
      thief.gold   += amount;
      await this.syncGold(thief);
      await this.syncGold(target);
      await db.query(
        `INSERT INTO action_log (actor_id, target_id, action_type, data, room_id)
         VALUES ($1,$2,'steal',$3,$4)`,
        [thief.charId, target.charId, JSON.stringify({ amount, sleeping: true }), thief.roomId]
      );
      return { success: true, amount, targetSid: tgtSid };
    }

    // Roubo de jogador acordado — chance 40%
    const success = Math.random() < 0.4;
    if (success) {
      const amount = Math.min(Math.floor(target.gold * 0.1) || 1, target.gold);
      target.gold -= amount;
      thief.gold  += amount;
      await this.syncGold(thief);
      await this.syncGold(target);
      await db.query(
        `INSERT INTO action_log (actor_id, target_id, action_type, data, room_id)
         VALUES ($1,$2,'steal',$3,$4)`,
        [thief.charId, target.charId, JSON.stringify({ amount, sleeping: false }), thief.roomId]
      );
      return { success: true, amount, targetSid: tgtSid };
    }

    await db.query(
      `INSERT INTO action_log (actor_id, target_id, action_type, data, room_id)
       VALUES ($1,$2,'rob_fail','{}', $3)`,
      [thief.charId, target.charId, thief.roomId]
    );
    return { success: false, reason: 'falhou', targetSid: tgtSid };
  }

  // ── Troca (proposta) ─────────────────────────────────
  async acceptTrade(socketIdA, socketIdB, goldA, goldB, itemsA, itemsB) {
    const playerA = this.players.get(socketIdA);
    const playerB = this.players.get(socketIdB);
    if (!playerA || !playerB) return false;

    playerA.gold = Math.max(0, playerA.gold - goldA) + goldB;
    playerB.gold = Math.max(0, playerB.gold - goldB) + goldA;

    await this.syncGold(playerA);
    await this.syncGold(playerB);

    await db.query(
      `INSERT INTO action_log (actor_id, target_id, action_type, data, room_id)
       VALUES ($1,$2,'trade',$3,$4)`,
      [playerA.charId, playerB.charId,
       JSON.stringify({ goldA, goldB, itemsA, itemsB }),
       playerA.roomId]
    );
    return true;
  }

  // ── Helpers ──────────────────────────────────────────
  getBySocket(socketId) {
    return this.players.get(socketId) || null;
  }

  getByChar(charId) {
    const sid = this.charIndex.get(charId);
    return sid ? this.players.get(sid) : null;
  }

  getInRoom(roomId) {
    return [...this.players.values()].filter(p => p.roomId === roomId);
  }

  async savePosition(player) {
    await db.query(
      `UPDATE characters SET room_id=$1, pos_x=$2, pos_y=$3, updated_at=NOW() WHERE id=$4`,
      [player.roomId, player.x, player.y, player.charId]
    );
  }

  async syncGold(player) {
    await db.query(
      `UPDATE characters SET gold=$1 WHERE id=$2`,
      [player.gold, player.charId]
    );
  }
}

module.exports = new PlayerManager();
