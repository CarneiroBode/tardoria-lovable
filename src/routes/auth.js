// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/db');
const router  = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 12;

// ── POST /api/auth/register ──────────────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password, charName, charClass, charSprite } = req.body;

  if (!username || !email || !password || !charName)
    return res.status(400).json({ error: 'Campos obrigatórios: username, email, password, charName' });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    const userRes = await db.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id`,
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    const userId = userRes.rows[0].id;

    const charRes = await db.query(
      `INSERT INTO characters (user_id, name, class, sprite)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, charName.trim(), charClass || 'aventureiro', charSprite || 'char_01']
    );
    const character = charRes.rows[0];

    const token = jwt.sign({ userId, charId: character.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, character });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'Username, email ou nome de personagem já em uso.' });
    console.error('[auth/register]', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'username e password são obrigatórios.' });

  try {
    const userRes = await db.query(
      `SELECT * FROM users WHERE username = $1`, [username.trim()]
    );
    if (!userRes.rows.length)
      return res.status(401).json({ error: 'Credenciais inválidas.' });

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Credenciais inválidas.' });

    await db.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

    const charRes = await db.query(
      `SELECT * FROM characters WHERE user_id = $1 ORDER BY created_at LIMIT 1`, [user.id]
    );
    const character = charRes.rows[0];

    const token = jwt.sign({ userId: user.id, charId: character.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, character });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const charRes = await db.query(
      `SELECT c.*, u.username FROM characters c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`, [req.charId]
    );
    if (!charRes.rows.length)
      return res.status(404).json({ error: 'Personagem não encontrado.' });

    res.json({ character: charRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Middleware de autenticação ───────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    req.charId = payload.charId;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = { router, requireAuth };
