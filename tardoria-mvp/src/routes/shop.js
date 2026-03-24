const express = require('express');
const db      = require('../db/db');
const { ITEMS } = require('../game/ItemCatalog');
const { requireAuth } = require('./auth');
const router  = express.Router();

// GET /api/shop/:partnerId — itens disponíveis
router.get('/:partnerId', requireAuth, async (req, res) => {
  const r = await db.query(
    `SELECT pi.item_key, pi.price_gold, pi.stock
     FROM partner_items pi
     JOIN partners p ON p.id=pi.partner_id
     WHERE pi.partner_id=$1 AND pi.active=TRUE AND p.active=TRUE`,
    [req.params.partnerId]
  );
  const items = r.rows.map(row => ({
    ...ITEMS[row.item_key], key:row.item_key,
    price_gold: row.price_gold, stock: row.stock,
  }));
  res.json({ items });
});

// POST /api/shop/buy — comprar item
router.post('/buy', requireAuth, async (req, res) => {
  const { itemKey, partnerId } = req.body;
  if (!itemKey || !partnerId) return res.status(400).json({ error: 'itemKey e partnerId são obrigatórios.' });
  if (!ITEMS[itemKey]) return res.status(400).json({ error: 'Item inválido.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Verifica item disponível
    const iRes = await client.query(
      `SELECT * FROM partner_items WHERE partner_id=$1 AND item_key=$2 AND active=TRUE FOR UPDATE`,
      [partnerId, itemKey]
    );
    if (!iRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error:'Item não disponível.' }); }
    const pItem = iRes.rows[0];
    if (pItem.stock === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error:'Item esgotado.' }); }

    // Verifica gold do jogador
    const cRes = await client.query(`SELECT * FROM characters WHERE id=$1 FOR UPDATE`, [req.charId]);
    const char = cRes.rows[0];
    if (char.gold < pItem.price_gold) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error:`Gold insuficiente. Você tem ${char.gold}g, precisa de ${pItem.price_gold}g.` });
    }

    // Debita gold
    await client.query(`UPDATE characters SET gold=gold-$1 WHERE id=$2`, [pItem.price_gold, req.charId]);

    // Aplica efeito do item
    const item = ITEMS[itemKey];
    if (item.type === 'currency') {
      await client.query(`UPDATE characters SET gold=gold+$1 WHERE id=$2`, [item.effect.gold, req.charId]);
    } else if (item.type === 'consumable' && item.effect.hp) {
      await client.query(`UPDATE characters SET hp=LEAST(hp+$1,hp_max) WHERE id=$2`, [item.effect.hp, req.charId]);
    } else {
      // Adiciona ao inventário
      await client.query(
        `INSERT INTO player_inventory(character_id,item_key,quantity)
         VALUES($1,$2,1)
         ON CONFLICT(character_id,item_key) DO UPDATE SET quantity=player_inventory.quantity+1`,
        [req.charId, itemKey]
      );
    }

    // Reduz estoque se limitado
    if (pItem.stock > 0) {
      await client.query(`UPDATE partner_items SET stock=stock-1 WHERE id=$1`, [pItem.id]);
    }

    await client.query('COMMIT');

    // Retorna personagem atualizado
    const updated = await db.query(`SELECT hp,gold FROM characters WHERE id=$1`, [req.charId]);
    res.json({ ok:true, item, character: updated.rows[0] });

  } catch(e) {
    await client.query('ROLLBACK');
    console.error('[shop/buy]', e.message);
    res.status(500).json({ error: 'Erro ao processar compra.' });
  } finally {
    client.release();
  }
});

module.exports = { router };
