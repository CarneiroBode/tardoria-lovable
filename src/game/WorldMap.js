// src/game/WorldMap.js — Definição das 25 salas (5x5)
// sala_id = row * 5 + col  (0–24)

const BIOMES = {
  montanha: { label: 'Montanha', mapFile: 'montanha.tmj', music: 'mountain_wind',  ambiance: 'outdoor_wind'       },
  ruinas:   { label: 'Ruínas',   mapFile: 'ruinas.tmj',   music: 'ruins_mystery',  ambiance: 'outdoor_eerie'      },
  floresta: { label: 'Floresta', mapFile: 'floresta.tmj', music: 'forest_ambient', ambiance: 'outdoor_birds'      },
  cidade:   { label: 'Cidade',   mapFile: 'cidade.tmj',   music: 'town_theme',     ambiance: 'outdoor_town'       },
  taverna:  { label: 'Taverna',  mapFile: 'taverna.tmj',  music: 'taverna_theme',  ambiance: 'indoor_fireplace'   },
};

// Grid 5x5 — índice = id da sala
const WORLD_GRID = [
//  col 0         col 1         col 2         col 3         col 4
  'montanha',   'montanha',   'montanha',   'montanha',   'montanha',   // row 0
  'ruinas',     'cidade',     'floresta',   'floresta',   'ruinas',     // row 1
  'ruinas',     'cidade',     'taverna',    'floresta',   'ruinas',     // row 2  ← Taverna = sala 12
  'ruinas',     'floresta',   'floresta',   'cidade',     'ruinas',     // row 3
  'ruinas',     'ruinas',     'ruinas',     'ruinas',     'ruinas',     // row 4
];

// Calcula conexões automáticas entre salas
function getConnections(id) {
  const row = Math.floor(id / 5);
  const col = id % 5;
  return {
    norte: row > 0 ? id - 5 : null,
    sul:   row < 4 ? id + 5 : null,
    oeste: col > 0 ? id - 1 : null,
    leste: col < 4 ? id + 1 : null,
  };
}

const ROOMS = WORLD_GRID.map((biome, id) => ({
  id,
  biome,
  ...BIOMES[biome],
  connections: getConnections(id),
  spawnX: 160,
  spawnY: 180,
}));

// Sobrescreve spawns específicos
ROOMS[12].spawnX = 160;  // Taverna — centro
ROOMS[12].spawnY = 180;

module.exports = { ROOMS, BIOMES, getConnections };
