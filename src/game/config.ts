// Game constants
export const TS = 16;       // tile size px
export const SCALE = 3;     // zoom pixel art
export const RW = 20;       // room width tiles
export const RH = 15;       // room height tiles
export const PW = RW * TS * SCALE;  // 960px
export const PH = RH * TS * SCALE;  // 720px
export const SPEED = 100;

export const BIOME_CFG: Record<string, { bg: number; floor: number; wall: number; accent: number; label: string }> = {
  montanha: { bg: 0x2c2f4a, floor: 0x3d415e, wall: 0x6c757d, accent: 0x9a8c98, label: 'Montanha' },
  ruinas:   { bg: 0x1e150d, floor: 0x3d2b1f, wall: 0x6b4226, accent: 0x8b5e3c, label: 'Ruínas' },
  floresta: { bg: 0x0d2218, floor: 0x1b4332, wall: 0x2d6a4f, accent: 0x52b788, label: 'Floresta' },
  cidade:   { bg: 0x1c1f24, floor: 0x343a40, wall: 0x495057, accent: 0xadb5bd, label: 'Cidade' },
  taverna:  { bg: 0x2a0f00, floor: 0x4a1a00, wall: 0x7b2d00, accent: 0xe76f51, label: 'Taverna' },
};

// World grid 5x5
export const WORLD_GRID = [
  'montanha','montanha','montanha','montanha','montanha',
  'ruinas','cidade','floresta','floresta','ruinas',
  'ruinas','cidade','taverna','floresta','ruinas',
  'ruinas','floresta','floresta','cidade','ruinas',
  'ruinas','ruinas','ruinas','ruinas','ruinas',
];

export interface RoomData {
  id: number;
  biome: string;
  label: string;
  connections: { norte: number | null; sul: number | null; oeste: number | null; leste: number | null };
  spawnX: number;
  spawnY: number;
}

function getConnections(id: number) {
  const row = Math.floor(id / 5);
  const col = id % 5;
  return {
    norte: row > 0 ? id - 5 : null,
    sul:   row < 4 ? id + 5 : null,
    oeste: col > 0 ? id - 1 : null,
    leste: col < 4 ? id + 1 : null,
  };
}

export const ROOMS: RoomData[] = WORLD_GRID.map((biome, id) => ({
  id,
  biome,
  label: BIOME_CFG[biome]?.label || biome,
  connections: getConnections(id),
  spawnX: 160,
  spawnY: 180,
}));
