const db = require('../db/db');

class PlayerManager {
  constructor() {
    this.players  = new Map(); // socketId → state
    this.charIdx  = new Map(); // charId   → socketId
  }

  async connect(socketId, char) {
    const state = {
      socketId, charId: char.id, userId: char.user_id,
      name: char.name, class: char.class,
      sprite: char.sprite, color: char.color || '#e76f51',
      hp: char.hp, hpMax: char.hp_max, gold: char.gold,
      level: char.level, roomId: char.room_id,
      x: char.pos_x, y: char.pos_y,
      isSleeping: char.is_sleeping,
      direction: 'down', moving: false,
    };
    this.players.set(socketId, state);
    this.charIdx.set(char.id, socketId);
    return state;
  }

  async disconnect(socketId) {
    const p = this.players.get(socketId);
    if (!p) return null;
    await this._savePos(p);
    this.players.delete(socketId);
    this.charIdx.delete(p.charId);
    return p;
  }

  move(socketId, { x, y, direction, moving }) {
    const p = this.players.get(socketId);
    if (!p || p.isSleeping) return null;
    p.x = x; p.y = y; p.direction = direction; p.moving = moving;
    return p;
  }

  async changeRoom(socketId, roomId, x, y) {
    const p = this.players.get(socketId);
    if (!p) return null;
    await this._savePos(p);
    p.roomId = roomId; p.x = x; p.y = y; p.moving = false;
    return p;
  }

  async sleep(socketId) {
    const p = this.players.get(socketId);
    if (!p) return null;
    p.isSleeping = true;
    await db.query(`UPDATE characters SET is_sleeping=TRUE WHERE id=$1`, [p.charId]);
    return p;
  }

  async wake(socketId) {
    const p = this.players.get(socketId);
    if (!p) return null;
    p.isSleeping = false;
    await db.query(`UPDATE characters SET is_sleeping=FALSE WHERE id=$1`, [p.charId]);
    return p;
  }

  async steal(thiefSid, targetCharId) {
    const thief  = this.players.get(thiefSid);
    const tgtSid = this.charIdx.get(targetCharId);
    const target = tgtSid ? this.players.get(tgtSid) : null;

    if (!thief || !target)         return { success:false, reason:'jogador_ausente' };
    if (thief.roomId !== target.roomId) return { success:false, reason:'sala_diferente' };
    if (target.gold <= 0)          return { success:false, reason:'sem_gold' };

    const chance = target.isSleeping ? 1.0 : 0.4;
    if (Math.random() > chance)    return { success:false, reason:'falhou', targetSid: tgtSid };

    const amount = Math.max(1, Math.floor(target.gold * (target.isSleeping ? 0.25 : 0.1)));
    target.gold -= amount; thief.gold += amount;
    await this._syncGold(thief); await this._syncGold(target);
    await db.query(
      `INSERT INTO action_log(actor_id,target_id,action_type,data,room_id)VALUES($1,$2,'steal',$3,$4)`,
      [thief.charId, target.charId, JSON.stringify({amount,sleeping:target.isSleeping}), thief.roomId]
    );
    return { success:true, amount, targetSid: tgtSid };
  }

  async trade(sidA, sidB, goldA, goldB) {
    const pA = this.players.get(sidA);
    const pB = this.players.get(sidB);
    if (!pA || !pB) return false;
    if (pA.gold < goldA || pB.gold < goldB) return false;
    pA.gold = pA.gold - goldA + goldB;
    pB.gold = pB.gold - goldB + goldA;
    await this._syncGold(pA); await this._syncGold(pB);
    await db.query(
      `INSERT INTO action_log(actor_id,target_id,action_type,data,room_id)VALUES($1,$2,'trade',$3,$4)`,
      [pA.charId, pB.charId, JSON.stringify({goldA,goldB}), pA.roomId]
    );
    return true;
  }

  getBySocket(sid)  { return this.players.get(sid) || null; }
  getByChar(charId) { const s = this.charIdx.get(charId); return s ? this.players.get(s) : null; }
  getInRoom(roomId) { return [...this.players.values()].filter(p => p.roomId === roomId); }

  async _savePos(p) {
    await db.query(
      `UPDATE characters SET room_id=$1,pos_x=$2,pos_y=$3,updated_at=NOW() WHERE id=$4`,
      [p.roomId, p.x, p.y, p.charId]
    ).catch(()=>{});
  }
  async _syncGold(p) {
    await db.query(`UPDATE characters SET gold=$1 WHERE id=$2`, [p.gold, p.charId]).catch(()=>{});
  }
}

module.exports = new PlayerManager();
