const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const QRCode   = require('qrcode');
const db       = require('../db/db');
const qrMgr    = require('../game/QRManager');
const { ITEMS } = require('../game/ItemCatalog');
const router   = express.Router();

const PSECRET = () => process.env.JWT_SECRET + '_partner';

// ── Registro ────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { establishmentName, email, password, address, lat, lng } = req.body;
  if (!establishmentName || !email || !password)
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  try {
    const hash      = await bcrypt.hash(password, 12);
    const secretKey = crypto.randomBytes(32).toString('hex');
    const tvCode    = crypto.randomBytes(4).toString('hex').toUpperCase();
    const r = await db.query(
      `INSERT INTO partners(establishment_name,email,password,address,lat,lng,secret_key,tv_code)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,establishment_name,plan,tv_code`,
      [establishmentName, email.trim().toLowerCase(), hash, address||null, lat||null, lng||null, secretKey, tvCode]
    );
    const partner = r.rows[0];
    const token   = jwt.sign({ partnerId: partner.id }, PSECRET(), { expiresIn:'30d' });
    res.json({ token, partner });
  } catch(e) {
    if (e.code==='23505') return res.status(409).json({ error: 'Email já cadastrado.' });
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── Login ────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await db.query(`SELECT * FROM partners WHERE email=$1`, [email?.toLowerCase()]).catch(()=>null);
  if (!r?.rows.length || !await bcrypt.compare(password, r.rows[0].password))
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  const partner = r.rows[0];
  const token   = jwt.sign({ partnerId: partner.id }, PSECRET(), { expiresIn:'30d' });
  res.json({ token, partner: { id:partner.id, establishment_name:partner.establishment_name, plan:partner.plan, tv_code:partner.tv_code } });
});

// ── Me ───────────────────────────────────────────────────
router.get('/me', pAuth, async (req, res) => {
  const r = await db.query(`SELECT id,establishment_name,plan,tv_code,address,lat,lng FROM partners WHERE id=$1`, [req.partnerId]);
  if (!r.rows.length) return res.status(404).json({ error: 'Não encontrado.' });
  res.json({ partner: r.rows[0] });
});

// ── QR do dia ────────────────────────────────────────────
router.get('/qr', pAuth, async (req, res) => {
  const r = await db.query(`SELECT secret_key FROM partners WHERE id=$1`, [req.partnerId]);
  if (!r.rows.length) return res.status(404).json({ error: 'Parceiro não encontrado.' });

  const token   = await qrMgr.getDailyToken(req.partnerId, r.rows[0].secret_key);
  const scanUrl = `${req.protocol}://${req.get('host')}/scan?token=${token}`;
  const qrImg   = await QRCode.toDataURL(scanUrl, { width:300, margin:2, color:{ dark:'#e76f51', light:'#0d1117' } });

  res.json({ token, scanUrl, qrImg });
});

// ── Itens do parceiro ────────────────────────────────────
router.get('/items', pAuth, async (req, res) => {
  const active = await db.query(
    `SELECT item_key,price_gold,stock,active FROM partner_items WHERE partner_id=$1`,
    [req.partnerId]
  );
  const activeMap = {};
  active.rows.forEach(r => { activeMap[r.item_key] = r; });

  const catalog = Object.entries(ITEMS).map(([key, item]) => ({
    key, ...item,
    enabled:    !!activeMap[key]?.active,
    price_gold: activeMap[key]?.price_gold || 20,
    stock:      activeMap[key]?.stock ?? -1,
  }));

  res.json({ catalog });
});

router.post('/items', pAuth, async (req, res) => {
  const { itemKey, priceGold, stock, active } = req.body;
  if (!ITEMS[itemKey]) return res.status(400).json({ error: 'Item inválido.' });
  await db.query(
    `INSERT INTO partner_items(partner_id,item_key,price_gold,stock,active)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(partner_id,item_key) DO UPDATE
     SET price_gold=$3, stock=$4, active=$5`,
    [req.partnerId, itemKey, priceGold||20, stock??-1, active!==false]
  );
  res.json({ ok: true });
});

// ── Stats ────────────────────────────────────────────────
router.get('/stats', pAuth, async (req, res) => {
  const today   = new Date().toISOString().split('T')[0];
  const visits  = await db.query(
    `SELECT COUNT(*) as total,
            COUNT(CASE WHEN visited_at::DATE=$2 THEN 1 END) as today
     FROM location_visits WHERE partner_id=$1`,
    [req.partnerId, today]
  );
  const topHour = await db.query(
    `SELECT EXTRACT(HOUR FROM visited_at) as hour, COUNT(*) as cnt
     FROM location_visits WHERE partner_id=$1
     GROUP BY hour ORDER BY cnt DESC LIMIT 1`,
    [req.partnerId]
  );
  res.json({
    totalVisits: Number(visits.rows[0].total),
    todayVisits: Number(visits.rows[0].today),
    peakHour:    topHour.rows[0]?.hour || null,
  });
});

// ── TV data (público) ────────────────────────────────────
router.get('/tv/:tvCode', async (req, res) => {
  const r = await db.query(
    `SELECT p.id,p.establishment_name,p.plan,
            pi.item_key, pi.price_gold
     FROM partners p
     LEFT JOIN partner_items pi ON pi.partner_id=p.id AND pi.active=TRUE
     WHERE p.tv_code=$1 AND p.active=TRUE`,
    [req.params.tvCode]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Estabelecimento não encontrado.' });

  const partner = { id:r.rows[0].id, name:r.rows[0].establishment_name };
  const items   = r.rows.filter(row => row.item_key).map(row => ({
    ...ITEMS[row.item_key], key:row.item_key, price_gold:row.price_gold
  }));

  // QR do dia
  const qrR = await db.query(
    `SELECT token FROM daily_qr WHERE partner_id=$1 AND date=CURRENT_DATE`,
    [partner.id]
  );
  const token  = qrR.rows[0]?.token || null;
  const qrImg  = token
    ? await QRCode.toDataURL(`${req.protocol}://${req.get('host')}/scan?token=${token}`, {
        width:400, margin:2, color:{dark:'#e76f51',light:'#0d1117'}
      })
    : null;

  res.json({ partner, items, qrImg, token });
});

// ── Validar QR scan (jogador) ────────────────────────────
router.post('/scan', async (req, res) => {
  const { token, lat, lng, charId } = req.body;
  const result = await qrMgr.validate(token, lat, lng);
  if (!result.valid) return res.status(400).json({ error: result.reason });

  // Registra visita (1x por dia por local)
  if (charId) {
    await db.query(
      `INSERT INTO location_visits(character_id,partner_id) VALUES($1,$2)`,
      [charId, result.partnerId]
    ).catch(()=>{});
  }

  const items = await db.query(
    `SELECT pi.item_key,pi.price_gold,pi.stock
     FROM partner_items pi WHERE pi.partner_id=$1 AND pi.active=TRUE`,
    [result.partnerId]
  );

  res.json({
    ok: true,
    partnerName: result.name,
    partnerId:   result.partnerId,
    items: items.rows.map(r => ({ ...ITEMS[r.item_key], key:r.item_key, price_gold:r.price_gold })),
  });
});

// ── Middleware parceiro ──────────────────────────────────
function pAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const p = jwt.verify(auth.slice(7), PSECRET());
    req.partnerId = p.partnerId; next();
  } catch { res.status(401).json({ error: 'Token inválido.' }); }
}

module.exports = { router };
