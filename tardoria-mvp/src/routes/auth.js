const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../db/db');
const router  = express.Router();
const SECRET  = () => process.env.JWT_SECRET;

const COLORS = ['#e76f51','#52b788','#79c0ff','#f4d03f','#c77dff','#ff6b9d','#00b4d8','#e9c46a'];

router.post('/register', async (req, res) => {
  const { username, email, password, charName, charClass } = req.body;
  if (!username || !email || !password || !charName)
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  try {
    const hash  = await bcrypt.hash(password, 12);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const uRes  = await db.query(
      `INSERT INTO users(username,email,password) VALUES($1,$2,$3) RETURNING id`,
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    const cRes  = await db.query(
      `INSERT INTO characters(user_id,name,class,color) VALUES($1,$2,$3,$4) RETURNING *`,
      [uRes.rows[0].id, charName.trim(), charClass||'aventureiro', color]
    );
    const char  = cRes.rows[0];
    const token = jwt.sign({ userId: uRes.rows[0].id, charId: char.id }, SECRET(), { expiresIn:'30d' });
    res.json({ token, character: char });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username, email ou nome já em uso.' });
    console.error('[auth/register]', e.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  try {
    const uRes = await db.query(`SELECT * FROM users WHERE username=$1`, [username.trim()]);
    if (!uRes.rows.length) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const user = uRes.rows[0];
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    await db.query(`UPDATE users SET last_login=NOW() WHERE id=$1`, [user.id]);
    const cRes = await db.query(`SELECT * FROM characters WHERE user_id=$1 LIMIT 1`, [user.id]);
    const char = cRes.rows[0];
    const token = jwt.sign({ userId: user.id, charId: char.id }, SECRET(), { expiresIn:'30d' });
    res.json({ token, character: char });
  } catch(e) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const r = await db.query(
    `SELECT c.*,u.username FROM characters c JOIN users u ON u.id=c.user_id WHERE c.id=$1`,
    [req.charId]
  ).catch(()=>null);
  if (!r?.rows.length) return res.status(404).json({ error: 'Não encontrado.' });
  res.json({ character: r.rows[0] });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const p = jwt.verify(auth.slice(7), SECRET());
    req.userId = p.userId; req.charId = p.charId; next();
  } catch { res.status(401).json({ error: 'Token inválido.' }); }
}

module.exports = { router, requireAuth };
