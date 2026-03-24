import Phaser from 'phaser';
import { TS, SCALE, PW, PH, SPEED, BIOME_CFG, ROOMS, type RoomData } from './config';

// All available sprite images from public/assets/sprites/
const SPRITE_IMAGES = [
  'tile_grass', 'tile_stone', 'tile_path', 'TX_Player',
  'tree_1', 'tree_2', 'tree_3',
  'bush_1', 'bush_2', 'bush_3', 'bush_4', 'bush_5',
  'prop_chest', 'prop_door', 'prop_rocks', 'prop_sign',
  'prop_sofa', 'prop_statue', 'prop_vase', 'prop_well',
  'wall_arch', 'wall_brick_1', 'wall_brick_2', 'wall_brick_3',
  'wall_door', 'wall_solid', 'wall_stair_l', 'wall_stair_r', 'wall_window',
  'grass_sprites', 'sprite_tree_1',
];

// Tileset images from public/assets/tilesets/
const TILESET_IMAGES = [
  { key: 'ts_grass', file: 'TX_Tileset_Grass.png' },
  { key: 'ts_stone', file: 'TX_Tileset_Stone_Ground.png' },
  { key: 'ts_wall',  file: 'TX_Tileset_Wall.png' },
  { key: 'ts_props', file: 'TX_Props.png' },
  { key: 'ts_plant', file: 'TX_Plant.png' },
  { key: 'ts_struct',file: 'TX_Struct.png' },
];

// Biome decoration configs using real sprites
const BIOME_DECOR: Record<string, Array<{ s: string; x: number; y: number; sc: number; depth: number }>> = {
  floresta: [
    { s: 'tree_1', x: 0.10, y: 0.15, sc: 2.0, depth: 5 },
    { s: 'tree_2', x: 0.85, y: 0.12, sc: 1.8, depth: 5 },
    { s: 'tree_3', x: 0.50, y: 0.10, sc: 2.0, depth: 5 },
    { s: 'tree_1', x: 0.15, y: 0.72, sc: 1.6, depth: 5 },
    { s: 'tree_2', x: 0.82, y: 0.70, sc: 1.8, depth: 5 },
    { s: 'bush_3', x: 0.30, y: 0.32, sc: 2.2, depth: 4 },
    { s: 'bush_4', x: 0.65, y: 0.38, sc: 2.0, depth: 4 },
    { s: 'bush_2', x: 0.22, y: 0.55, sc: 2.0, depth: 4 },
    { s: 'bush_5', x: 0.72, y: 0.58, sc: 1.8, depth: 4 },
    { s: 'bush_1', x: 0.45, y: 0.67, sc: 2.2, depth: 4 },
  ],
  taverna: [
    { s: 'prop_chest', x: 0.15, y: 0.20, sc: 2.5, depth: 4 },
    { s: 'prop_chest', x: 0.82, y: 0.20, sc: 2.5, depth: 4 },
    { s: 'prop_sofa', x: 0.20, y: 0.38, sc: 2.5, depth: 4 },
    { s: 'prop_sofa', x: 0.65, y: 0.38, sc: 2.5, depth: 4 },
    { s: 'prop_vase', x: 0.48, y: 0.22, sc: 2.5, depth: 4 },
    { s: 'prop_sign', x: 0.50, y: 0.78, sc: 2.2, depth: 4 },
    { s: 'prop_door', x: 0.50, y: 0.92, sc: 2.5, depth: 4 },
  ],
  cidade: [
    { s: 'wall_brick_1', x: 0.10, y: 0.28, sc: 2.2, depth: 4 },
    { s: 'wall_brick_2', x: 0.10, y: 0.55, sc: 2.2, depth: 4 },
    { s: 'wall_brick_3', x: 0.88, y: 0.28, sc: 2.2, depth: 4 },
    { s: 'wall_brick_1', x: 0.88, y: 0.55, sc: 2.2, depth: 4 },
    { s: 'tree_2', x: 0.50, y: 0.18, sc: 1.6, depth: 5 },
    { s: 'bush_3', x: 0.30, y: 0.78, sc: 2.0, depth: 4 },
    { s: 'bush_4', x: 0.65, y: 0.78, sc: 2.0, depth: 4 },
    { s: 'prop_well', x: 0.50, y: 0.50, sc: 2.5, depth: 4 },
    { s: 'prop_statue', x: 0.25, y: 0.22, sc: 2.2, depth: 4 },
    { s: 'prop_statue', x: 0.72, y: 0.22, sc: 2.2, depth: 4 },
  ],
  montanha: [
    { s: 'prop_rocks', x: 0.15, y: 0.28, sc: 2.5, depth: 4 },
    { s: 'prop_rocks', x: 0.65, y: 0.22, sc: 2.0, depth: 4 },
    { s: 'prop_rocks', x: 0.40, y: 0.45, sc: 3.0, depth: 4 },
    { s: 'bush_4', x: 0.80, y: 0.58, sc: 1.8, depth: 4 },
    { s: 'bush_5', x: 0.20, y: 0.62, sc: 1.8, depth: 4 },
    { s: 'wall_arch', x: 0.50, y: 0.35, sc: 2.0, depth: 4 },
  ],
  ruinas: [
    { s: 'wall_brick_1', x: 0.12, y: 0.18, sc: 2.5, depth: 4 },
    { s: 'wall_brick_2', x: 0.12, y: 0.52, sc: 2.5, depth: 4 },
    { s: 'wall_brick_3', x: 0.85, y: 0.18, sc: 2.5, depth: 4 },
    { s: 'wall_brick_1', x: 0.85, y: 0.52, sc: 2.5, depth: 4 },
    { s: 'prop_vase', x: 0.22, y: 0.68, sc: 2.2, depth: 4 },
    { s: 'prop_rocks', x: 0.60, y: 0.68, sc: 2.2, depth: 4 },
    { s: 'bush_2', x: 0.40, y: 0.22, sc: 1.8, depth: 4 },
  ],
};

export class DemoScene extends Phaser.Scene {
  private mySprite!: Phaser.Physics.Arcade.Sprite;
  private myLabel!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private currentRoom: RoomData;
  private lastDir = 'down';
  private wallRects: Phaser.GameObjects.GameObject[] = [];
  private layers: Phaser.GameObjects.GameObject[] = [];
  private decorItems: Phaser.GameObjects.GameObject[] = [];
  private transitioning = false;
  private hasRealPlayer = false;

  public joy = { active: false, vx: 0, vy: 0 };
  public onRoomChange?: (room: RoomData) => void;
  public onPositionUpdate?: (x: number, y: number) => void;

  private playerName: string;

  constructor() {
    super({ key: 'DemoScene' });
    this.currentRoom = ROOMS[12];
    this.playerName = 'Aventureiro';
  }

  setPlayerName(name: string) {
    this.playerName = name;
  }

  preload() {
    // Load all sprite images
    SPRITE_IMAGES.forEach(key => {
      this.load.image(key, `/assets/sprites/${key}.png`);
    });

    // Load TX_Player as spritesheet (16x16 frames)
    this.load.spritesheet('player_sheet', '/assets/sprites/TX_Player.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // Load tilesets
    TILESET_IMAGES.forEach(({ key, file }) => {
      this.load.image(key, `/assets/tilesets/${file}`);
    });

    // Load Tiled JSON maps
    ['taverna', 'floresta', 'montanha', 'ruinas', 'cidade'].forEach(name => {
      this.load.tilemapTiledJSON(name, `/assets/maps/${name}.tmj`);
    });

    // Silence load errors (some assets may not exist)
    this.load.on('loaderror', () => {});
  }

  create() {
    this.genFallbackTextures();

    this.hasRealPlayer = this.textures.exists('player_sheet');

    this.keys = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      arrowUp:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      arrowDown:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      arrowLeft:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      arrowRight: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    this.physics.world.setBounds(0, 0, PW, PH);
    this.buildRoom(this.currentRoom);
    this.spawnPlayer();
    this.cameras.main.startFollow(this.mySprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(Math.min(this.scale.width / PW, this.scale.height / PH));
  }

  update() {
    if (!this.mySprite) return;

    let vx = 0, vy = 0;
    if (this.joy.active && (Math.abs(this.joy.vx) > 0.05 || Math.abs(this.joy.vy) > 0.05)) {
      vx = this.joy.vx * SPEED;
      vy = this.joy.vy * SPEED;
    } else {
      if (this.keys.left?.isDown || this.keys.arrowLeft?.isDown) vx = -SPEED;
      if (this.keys.right?.isDown || this.keys.arrowRight?.isDown) vx = SPEED;
      if (this.keys.up?.isDown || this.keys.arrowUp?.isDown) vy = -SPEED;
      if (this.keys.down?.isDown || this.keys.arrowDown?.isDown) vy = SPEED;
    }

    this.mySprite.setVelocity(vx, vy);

    let dir = this.lastDir;
    if (Math.abs(vx) >= Math.abs(vy)) {
      if (vx < -5) dir = 'left';
      else if (vx > 5) dir = 'right';
    } else {
      if (vy < -5) dir = 'up';
      else if (vy > 5) dir = 'down';
    }

    const moving = Math.abs(vx) > 2 || Math.abs(vy) > 2;
    const anim = moving ? `walk_${dir}` : `idle_${dir}`;
    try {
      if (this.mySprite.anims.currentAnim?.key !== anim) this.mySprite.play(anim, true);
    } catch {}
    this.lastDir = dir;

    if (this.myLabel) this.myLabel.setPosition(this.mySprite.x, this.mySprite.y - 18);
    this.onPositionUpdate?.(this.mySprite.x / SCALE, this.mySprite.y / SCALE);
    this.checkTransition();
  }

  // ── Fallback textures when real assets fail to load ──
  private genFallbackTextures() {
    if (!this.textures.exists('char_demo')) {
      const canvas = document.createElement('canvas');
      canvas.width = 16 * 8; canvas.height = 16 * 4;
      const ctx = canvas.getContext('2d')!;
      const dirs = ['down', 'up', 'left', 'right'];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          const x = col * 16, y = row * 16;
          ctx.fillStyle = '#e76f51';
          ctx.fillRect(x + 3, y + 2, 10, 12);
          ctx.fillStyle = '#ffddd2';
          ctx.fillRect(x + 4, y + 1, 8, 7);
          ctx.fillStyle = '#1a1a2e';
          if (dirs[row] === 'down') { ctx.fillRect(x + 5, y + 4, 2, 2); ctx.fillRect(x + 9, y + 4, 2, 2); }
          else if (dirs[row] === 'up') { ctx.fillStyle = '#8b4513'; ctx.fillRect(x + 5, y + 1, 6, 3); }
          else if (dirs[row] === 'left') { ctx.fillRect(x + 4, y + 4, 2, 2); }
          else { ctx.fillRect(x + 10, y + 4, 2, 2); }
          ctx.fillStyle = '#2a0f00';
          if (col % 3 === 1) { ctx.fillRect(x + 4, y + 12, 3, 3); ctx.fillRect(x + 9, y + 13, 3, 2); }
          else if (col % 3 === 2) { ctx.fillRect(x + 4, y + 13, 3, 2); ctx.fillRect(x + 9, y + 12, 3, 3); }
          else { ctx.fillRect(x + 4, y + 12, 3, 3); ctx.fillRect(x + 9, y + 12, 3, 3); }
        }
      }
      this.textures.addSpriteSheet('char_demo', canvas as any, { frameWidth: 16, frameHeight: 16 });
    }

    if (!this.textures.exists('px_wall')) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      this.textures.addCanvas('px_wall', c);
    }
  }

  // ── Spawn player with real or fallback sprite ──
  private spawnPlayer() {
    const x = this.currentRoom.spawnX * SCALE;
    const y = this.currentRoom.spawnY * SCALE;
    const texKey = this.hasRealPlayer ? 'player_sheet' : 'char_demo';

    this.mySprite = this.physics.add.sprite(x, y, texKey).setScale(SCALE).setDepth(10);
    this.mySprite.setCollideWorldBounds(true);
    (this.mySprite.body as Phaser.Physics.Arcade.Body).setSize(10, 12);

    // Animations — TX_Player.png layout: 8 cols × 8 rows of 16×16
    // Row 0 (down): walk 0,1,2 | idle 3
    // Row 1 (up): walk 8,9,10 | idle 11
    // Row 2 (left): walk 16,17,18 | idle 20
    // Row 3 (right): walk 24,25,26 | idle 28
    const anims = [
      { key: 'walk_down',  frames: [0, 1, 2],    rate: 8 },
      { key: 'idle_down',  frames: [3],           rate: 1 },
      { key: 'walk_up',    frames: [8, 9, 10],    rate: 8 },
      { key: 'idle_up',    frames: [11],          rate: 1 },
      { key: 'walk_left',  frames: [16, 17, 18],  rate: 8 },
      { key: 'idle_left',  frames: [20],          rate: 1 },
      { key: 'walk_right', frames: [24, 25, 26],  rate: 8 },
      { key: 'idle_right', frames: [28],          rate: 1 },
    ];

    anims.forEach(({ key, frames, rate }) => {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frameRate: rate,
          repeat: rate > 1 ? -1 : 0,
          frames: frames.map(f => ({ key: texKey, frame: f })),
        });
      }
    });

    this.mySprite.play('idle_down', true);

    this.myLabel = this.add.text(x, y - 18, this.playerName, {
      fontSize: `${7 * SCALE}px`,
      color: '#fff',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(11);

    this.wallRects.forEach(r => this.physics.add.collider(this.mySprite, r));
  }

  // ── Build room with real tile floor + real sprite decorations ──
  private buildRoom(room: RoomData) {
    const cfg = BIOME_CFG[room.biome] || BIOME_CFG.floresta;

    // Cleanup
    this.layers.forEach(l => (l as any).destroy?.());
    this.layers = [];
    this.wallRects.forEach(r => (r as any).destroy?.());
    this.wallRects = [];
    this.decorItems.forEach(d => (d as any).destroy?.());
    this.decorItems = [];

    // ── Floor ──
    // Try to use real tile textures for the floor
    const floorMap: Record<string, string> = {
      floresta: 'tile_grass',
      taverna: 'tile_stone',
      cidade: 'tile_stone',
      montanha: 'tile_path',
      ruinas: 'tile_path',
    };
    const floorKey = floorMap[room.biome] || 'tile_grass';
    const hasFloorTex = this.textures.exists(floorKey);

    if (hasFloorTex) {
      const src = this.textures.get(floorKey).source[0];
      const fl = this.add.tileSprite(0, 0, PW, PH, floorKey).setOrigin(0).setDepth(0);
      fl.setTileScale(SCALE * (TS / src.width));
      this.layers.push(fl);
    } else {
      const bg = this.add.rectangle(PW / 2, PH / 2, PW, PH, cfg.bg).setDepth(0);
      this.layers.push(bg);
      // Grid
      const grid = this.add.graphics().setDepth(1);
      grid.lineStyle(1, cfg.floor, 0.2);
      for (let x = 0; x <= PW; x += TS * SCALE) grid.lineBetween(x, 0, x, PH);
      for (let y = 0; y <= PH; y += TS * SCALE) grid.lineBetween(0, y, PW, y);
      this.layers.push(grid);
    }

    // ── Border walls with exit gaps ──
    const border = this.add.graphics().setDepth(2);
    border.fillStyle(cfg.wall);
    const BW = TS * SCALE;
    const conn = room.connections;
    const midX = PW / 2, midY = PH / 2;
    const gap = BW * 3;

    // Top
    if (conn.norte === null) border.fillRect(0, 0, PW, BW);
    else {
      border.fillRect(0, 0, midX - gap / 2, BW);
      border.fillRect(midX + gap / 2, 0, PW - (midX + gap / 2), BW);
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(midX - gap / 2, 0, gap, BW);
      border.fillStyle(cfg.wall);
    }
    // Bottom
    if (conn.sul === null) border.fillRect(0, PH - BW, PW, BW);
    else {
      border.fillRect(0, PH - BW, midX - gap / 2, BW);
      border.fillRect(midX + gap / 2, PH - BW, PW - (midX + gap / 2), BW);
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(midX - gap / 2, PH - BW, gap, BW);
      border.fillStyle(cfg.wall);
    }
    // Left
    if (conn.oeste === null) border.fillRect(0, 0, BW, PH);
    else {
      border.fillRect(0, 0, BW, midY - gap / 2);
      border.fillRect(0, midY + gap / 2, BW, PH - (midY + gap / 2));
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(0, midY - gap / 2, BW, gap);
      border.fillStyle(cfg.wall);
    }
    // Right
    if (conn.leste === null) border.fillRect(PW - BW, 0, BW, PH);
    else {
      border.fillRect(PW - BW, 0, BW, midY - gap / 2);
      border.fillRect(PW - BW, midY + gap / 2, BW, PH - (midY + gap / 2));
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(PW - BW, midY - gap / 2, BW, gap);
    }
    this.layers.push(border);

    // ── Wall colliders ──
    const addWall = (x: number, y: number, w: number, h: number) => {
      const r = this.physics.add.staticImage(x + w / 2, y + h / 2, 'px_wall')
        .setDisplaySize(w, h).refreshBody().setAlpha(0);
      this.wallRects.push(r);
    };
    addWall(0, 0, BW, PH);
    addWall(PW - BW, 0, BW, PH);
    addWall(0, 0, PW, BW);
    addWall(0, PH - BW, PW, BW);

    // ── Real sprite decorations ──
    const decor = BIOME_DECOR[room.biome] || [];
    decor.forEach(d => {
      if (this.textures.exists(d.s)) {
        const img = this.add.image(d.x * PW, d.y * PH, d.s)
          .setScale(d.sc)
          .setDepth(d.depth)
          .setOrigin(0.5, 1);
        this.decorItems.push(img);

        // Add collision for walls and large props
        if (d.s.startsWith('wall_') || d.s === 'prop_well' || d.s === 'prop_statue') {
          const tex = this.textures.get(d.s).source[0];
          const w = tex.width * d.sc * 0.5;
          const h = tex.height * d.sc * 0.5;
          const z = this.add.zone(d.x * PW, d.y * PH - h / 2, w, h);
          this.physics.add.existing(z, true);
          this.wallRects.push(z);
        }
      }
    });

    // ── If no real sprites loaded, draw fallback graphics ──
    if (this.decorItems.length === 0) {
      this.drawFallbackDecor(cfg, room.biome);
    }

    // Room label
    const label = this.add.text(PW / 2, BW + 12, `${room.label} (Sala ${room.id})`, {
      fontSize: '12px',
      color: `#${cfg.accent.toString(16).padStart(6, '0')}`,
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(15).setAlpha(0.7);
    this.layers.push(label);
  }

  // Fallback decorations when real sprites are missing
  private drawFallbackDecor(cfg: typeof BIOME_CFG[string], biome: string) {
    const g = this.add.graphics().setDepth(3);
    switch (biome) {
      case 'taverna': {
        g.fillStyle(cfg.wall);
        g.fillRect(7 * TS * SCALE, 4 * TS * SCALE, 6 * TS * SCALE, 2.5 * TS * SCALE);
        g.fillStyle(cfg.accent, 0.8);
        g.fillRect(7.2 * TS * SCALE, 4.2 * TS * SCALE, 5.6 * TS * SCALE, 2.1 * TS * SCALE);
        g.fillStyle(cfg.accent, 0.4);
        [[3, 3], [15, 3], [3, 10], [15, 10], [9, 9]].forEach(([tx, ty]) => {
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 0.9);
        });
        g.fillStyle(0xe76f51, 0.8);
        g.fillRect(9 * TS * SCALE, 1.2 * TS * SCALE, 2 * TS * SCALE, TS * SCALE);
        break;
      }
      case 'floresta': {
        [[3, 3], [17, 3], [4, 6], [16, 6], [5, 10], [15, 10], [3, 13], [18, 13]].forEach(([tx, ty]) => {
          g.fillStyle(0x1b4332);
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 1.3);
          g.fillStyle(0x2d6a4f);
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 0.9);
        });
        break;
      }
      case 'montanha': {
        g.fillStyle(0x6c757d);
        g.fillTriangle(4 * TS * SCALE, 8 * TS * SCALE, 10 * TS * SCALE, 2 * TS * SCALE, 16 * TS * SCALE, 8 * TS * SCALE);
        g.fillStyle(0x9a8c98);
        g.fillTriangle(8 * TS * SCALE, 9 * TS * SCALE, 14 * TS * SCALE, 3 * TS * SCALE, 20 * TS * SCALE, 9 * TS * SCALE);
        g.fillStyle(0xffffff, 0.4);
        g.fillTriangle(10 * TS * SCALE, 2 * TS * SCALE, 9 * TS * SCALE, 3.5 * TS * SCALE, 11 * TS * SCALE, 3.5 * TS * SCALE);
        break;
      }
      case 'cidade': {
        [[2, 2, 4, 4], [14, 2, 4, 4], [2, 9, 4, 4], [14, 9, 4, 4]].forEach(([tx, ty, tw, th]) => {
          g.fillStyle(cfg.wall);
          g.fillRect(tx * TS * SCALE, ty * TS * SCALE, tw * TS * SCALE, th * TS * SCALE);
          g.fillStyle(0xffe066, 0.3);
          for (let wy = 1; wy < th - 1; wy++) for (let wx = 1; wx < tw - 1; wx += 2)
            g.fillRect((tx + wx) * TS * SCALE + 2, (ty + wy) * TS * SCALE + 2, TS * SCALE - 4, TS * SCALE - 4);
        });
        break;
      }
      case 'ruinas': {
        [[3, 2, 2, 3], [16, 2, 2, 3], [5, 5, 3, 4], [12, 5, 3, 4]].forEach(([tx, ty, tw, th]) => {
          g.fillStyle(cfg.wall, 0.6);
          g.fillRect(tx * TS * SCALE, ty * TS * SCALE, tw * TS * SCALE, th * TS * SCALE);
        });
        g.fillStyle(0x8b5e3c);
        g.fillRect(9 * TS * SCALE, 7 * TS * SCALE, 3 * TS * SCALE, 1.5 * TS * SCALE);
        break;
      }
    }
    this.layers.push(g);
  }

  private checkTransition() {
    if (!this.mySprite || !this.currentRoom?.connections || this.transitioning) return;
    const mx = this.mySprite.x, my = this.mySprite.y;
    const M = TS * SCALE * 1.5;
    const { norte, sul, oeste, leste } = this.currentRoom.connections;
    const midX = PW / 2, midY = PH / 2;

    if (norte !== null && my < M && Math.abs(mx - midX) < TS * SCALE * 3) this.goRoom(norte, midX, PH - 3 * TS * SCALE);
    if (sul !== null && my > PH - M && Math.abs(mx - midX) < TS * SCALE * 3) this.goRoom(sul, midX, 2 * TS * SCALE);
    if (oeste !== null && mx < M && Math.abs(my - midY) < TS * SCALE * 3) this.goRoom(oeste, PW - 3 * TS * SCALE, midY);
    if (leste !== null && mx > PW - M && Math.abs(my - midY) < TS * SCALE * 3) this.goRoom(leste, 2 * TS * SCALE, midY);
  }

  private goRoom(roomId: number, entryX: number, entryY: number) {
    this.transitioning = true;
    this.currentRoom = ROOMS[roomId];
    this.buildRoom(this.currentRoom);
    this.mySprite.setPosition(entryX, entryY);
    this.myLabel.setPosition(entryX, entryY - 18);
    this.wallRects.forEach(r => this.physics.add.collider(this.mySprite, r));
    this.onRoomChange?.(this.currentRoom);
    this.time.delayedCall(400, () => { this.transitioning = false; });
  }
}
