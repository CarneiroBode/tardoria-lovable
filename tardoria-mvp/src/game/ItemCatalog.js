const ITEMS = {
  moedas_50:     { name:'50 Moedas',          type:'currency',  rarity:'comum',    icon:'💰', effect:{ gold:50 },         desc:'Um bolso cheio de moedas.' },
  moedas_200:    { name:'200 Moedas',          type:'currency',  rarity:'incomum',  icon:'💰', effect:{ gold:200 },        desc:'Uma bolsa pesada de moedas.' },
  pocao_vida:    { name:'Poção de Vida',       type:'consumable',rarity:'comum',    icon:'🧪', effect:{ hp:50 },           desc:'Restaura 50 HP instantaneamente.' },
  pocao_forca:   { name:'Poção de Força',      type:'consumable',rarity:'incomum',  icon:'⚗️', effect:{ atk:10, dur:3600 },desc:'Aumenta ATK por 1 hora.' },
  espada_simples:{ name:'Espada Simples',      type:'weapon',    rarity:'comum',    icon:'⚔️', effect:{ atk:5 },           desc:'Uma espada básica mas confiável.' },
  escudo_madeira:{ name:'Escudo de Madeira',   type:'armor',     rarity:'comum',    icon:'🛡️', effect:{ def:3 },           desc:'Proteção básica de madeira.' },
  amuleto_sorte: { name:'Amuleto da Sorte',    type:'accessory', rarity:'incomum',  icon:'🪬', effect:{ luck:5 },          desc:'Aumenta chance de roubo bem-sucedido.' },
  botas_velozes: { name:'Botas Velozes',       type:'armor',     rarity:'incomum',  icon:'👟', effect:{ spd:2 },           desc:'Movimento 20% mais rápido.' },
  anel_magico:   { name:'Anel Mágico',         type:'accessory', rarity:'raro',     icon:'💍', effect:{ mp:20 },           desc:'Aumenta poder mágico.' },
  elmo_ferro:    { name:'Elmo de Ferro',       type:'armor',     rarity:'incomum',  icon:'⛑️', effect:{ def:5 },           desc:'Proteção sólida para a cabeça.' },
  mapa_tesouro:  { name:'Mapa do Tesouro',     type:'special',   rarity:'raro',     icon:'🗺️', effect:{ reveal:true },     desc:'Revela um baú escondido no mapa.' },
  chave_secreta: { name:'Chave Secreta',       type:'special',   rarity:'lendario', icon:'🗝️', effect:{ unlock:true },     desc:'Abre passagens ocultas.' },
};

const RARITY_COLORS = {
  comum:    '#adb5bd',
  incomum:  '#52b788',
  raro:     '#79c0ff',
  lendario: '#e76f51',
};

module.exports = { ITEMS, RARITY_COLORS };
