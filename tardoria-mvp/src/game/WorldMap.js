const BIOMES = {
  montanha: { label:'Montanha', mapFile:'montanha.tmj', music:'mountain_wind',  color:0x4a4e69, floorColor:0x6c757d },
  ruinas:   { label:'Ruínas',   mapFile:'ruinas.tmj',   music:'ruins_mystery',  color:0x3d2b1f, floorColor:0x5c4033 },
  floresta: { label:'Floresta', mapFile:'floresta.tmj', music:'forest_ambient', color:0x1b4332, floorColor:0x2d6a4f },
  cidade:   { label:'Cidade',   mapFile:'cidade.tmj',   music:'town_theme',     color:0x343a40, floorColor:0x495057 },
  taverna:  { label:'Taverna',  mapFile:'taverna.tmj',  music:'taverna_theme',  color:0x4a1a00, floorColor:0x7b3800 },
};

const GRID = [
  'montanha','montanha','montanha','montanha','montanha',
  'ruinas',  'cidade',  'floresta','floresta','ruinas',
  'ruinas',  'cidade',  'taverna', 'floresta','ruinas',
  'ruinas',  'floresta','floresta','cidade',  'ruinas',
  'ruinas',  'ruinas',  'ruinas',  'ruinas',  'ruinas',
];

function getConnections(id) {
  const row = Math.floor(id / 5), col = id % 5;
  return {
    norte: row > 0 ? id - 5 : null,
    sul:   row < 4 ? id + 5 : null,
    oeste: col > 0 ? id - 1 : null,
    leste: col < 4 ? id + 1 : null,
  };
}

const ROOMS = GRID.map((biome, id) => ({
  id, biome, ...BIOMES[biome], connections: getConnections(id),
  spawnX: 160, spawnY: 180,
  nome: buildName(biome, id),
}));

function buildName(biome, id) {
  const names = {
    montanha:['Pico Norte-Oeste','Pico Norte','Pico Central','Pico Norte-Leste','Pico Nordeste'],
    taverna: ['Taverna do Centro'],
    cidade:  ['Cidade Oeste','Cidade Mercado','Cidade Sul'],
    floresta:['Floresta Norte','Floresta Nordeste','Floresta Leste','Floresta Sudoeste','Floresta Sul'],
    ruinas:  ['Ruínas','Abismo','Bordas Esquecidas'],
  };
  const list = names[biome] || ['Sala'];
  return list[id % list.length];
}

module.exports = { ROOMS, BIOMES, getConnections };
