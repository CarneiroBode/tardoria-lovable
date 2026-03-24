const crypto = require('crypto');
const db     = require('../db/db');

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function buildToken(partnerId, dateStr, secretKey) {
  return crypto
    .createHmac('sha256', secretKey)
    .update(`${partnerId}:${dateStr}`)
    .digest('hex')
    .slice(0, 40);
}

async function getDailyToken(partnerId, secretKey) {
  const date  = todayStr();
  const token = buildToken(partnerId, date, secretKey);
  await db.query(
    `INSERT INTO daily_qr (partner_id, date, token) VALUES ($1,$2,$3)
     ON CONFLICT (partner_id, date) DO NOTHING`,
    [partnerId, date, token]
  );
  return token;
}

async function validate(token, playerLat, playerLng) {
  const result = await db.query(
    `SELECT dq.*, p.lat, p.lng, p.establishment_name, p.id AS partner_id, p.active
     FROM daily_qr dq
     JOIN partners p ON p.id = dq.partner_id
     WHERE dq.token = $1 AND dq.date = $2`,
    [token, todayStr()]
  );

  if (!result.rows.length)
    return { valid: false, reason: 'QR inválido ou expirado.' };

  const p = result.rows[0];
  if (!p.active)
    return { valid: false, reason: 'Estabelecimento inativo.' };

  // GPS check — só valida se parceiro tem coordenadas e jogador enviou
  if (p.lat && p.lng && playerLat && playerLng) {
    const dist = haversine(playerLat, playerLng, p.lat, p.lng);
    if (dist > 300)
      return { valid: false, reason: `Você está a ${Math.round(dist)}m. Precisa estar no local.` };
  }

  return { valid: true, partnerId: p.partner_id, name: p.establishment_name };
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = { getDailyToken, validate };
