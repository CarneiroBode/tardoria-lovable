import Phaser from 'phaser';
import { TS, SCALE, PW, PH, SPEED, BIOME_CFG, ROOMS, type RoomData } from './config';

export class DemoScene extends Phaser.Scene {
  private mySprite!: Phaser.Physics.Arcade.Sprite;
  private myLabel!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private currentRoom: RoomData;
  private lastDir = 'down';
  private wallRects: Phaser.GameObjects.GameObject[] = [];
  private layers: Phaser.GameObjects.GameObject[] = [];
  private transitioning = false;

  // joystick state (set from React)
  public joy = { active: false, vx: 0, vy: 0 };

  // callbacks
  public onRoomChange?: (room: RoomData) => void;
  public onPositionUpdate?: (x: number, y: number) => void;

  private playerName: string;

  constructor() {
    super({ key: 'DemoScene' });
    this.currentRoom = ROOMS[12]; // Taverna
    this.playerName = 'Aventureiro';
  }

  setPlayerName(name: string) {
    this.playerName = name;
  }

  create() {
    this.genTextures();

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

  private genTextures() {
    // Character texture (simple colored square with face)
    if (!this.textures.exists('char_demo')) {
      const canvas = document.createElement('canvas');
      canvas.width = 16 * 8; canvas.height = 16 * 4;
      const ctx = canvas.getContext('2d')!;

      const dirs = ['down', 'up', 'left', 'right'];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          const x = col * 16, y = row * 16;
          // Body
          ctx.fillStyle = '#e76f51';
          ctx.fillRect(x + 3, y + 2, 10, 12);
          // Head
          ctx.fillStyle = '#ffddd2';
          ctx.fillRect(x + 4, y + 1, 8, 7);
          // Eyes based on direction
          ctx.fillStyle = '#1a1a2e';
          if (dirs[row] === 'down') {
            ctx.fillRect(x + 5, y + 4, 2, 2);
            ctx.fillRect(x + 9, y + 4, 2, 2);
          } else if (dirs[row] === 'up') {
            // no eyes visible from back
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(x + 5, y + 1, 6, 3);
          } else if (dirs[row] === 'left') {
            ctx.fillRect(x + 4, y + 4, 2, 2);
          } else {
            ctx.fillRect(x + 10, y + 4, 2, 2);
          }
          // Legs animation offset
          if (col % 3 === 1) {
            ctx.fillStyle = '#2a0f00';
            ctx.fillRect(x + 4, y + 12, 3, 3);
            ctx.fillRect(x + 9, y + 13, 3, 2);
          } else if (col % 3 === 2) {
            ctx.fillStyle = '#2a0f00';
            ctx.fillRect(x + 4, y + 13, 3, 2);
            ctx.fillRect(x + 9, y + 12, 3, 3);
          } else {
            ctx.fillStyle = '#2a0f00';
            ctx.fillRect(x + 4, y + 12, 3, 3);
            ctx.fillRect(x + 9, y + 12, 3, 3);
          }
        }
      }
      this.textures.addSpriteSheet('char_demo', canvas as any, { frameWidth: 16, frameHeight: 16 });
    }

    // Invisible wall texture
    if (!this.textures.exists('px_wall')) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      this.textures.addCanvas('px_wall', c);
    }
  }

  private spawnPlayer() {
    const x = this.currentRoom.spawnX * SCALE;
    const y = this.currentRoom.spawnY * SCALE;

    this.mySprite = this.physics.add.sprite(x, y, 'char_demo').setScale(SCALE).setDepth(10);
    this.mySprite.setCollideWorldBounds(true);
    this.mySprite.body!.setSize(10, 12);

    // Animations: 8 cols x 4 rows
    const anims = [
      { key: 'walk_down',  frames: [0,1,2],   rate: 8 },
      { key: 'idle_down',  frames: [3],        rate: 1 },
      { key: 'walk_up',    frames: [8,9,10],   rate: 8 },
      { key: 'idle_up',    frames: [11],       rate: 1 },
      { key: 'walk_left',  frames: [16,17,18], rate: 8 },
      { key: 'idle_left',  frames: [20],       rate: 1 },
      { key: 'walk_right', frames: [24,25,26], rate: 8 },
      { key: 'idle_right', frames: [28],       rate: 1 },
    ];

    anims.forEach(({ key, frames, rate }) => {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frameRate: rate,
          repeat: rate > 1 ? -1 : 0,
          frames: frames.map(f => ({ key: 'char_demo', frame: f })),
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

    // Collide with walls
    this.wallRects.forEach(r => this.physics.add.collider(this.mySprite, r));
  }

  private buildRoom(room: RoomData) {
    const cfg = BIOME_CFG[room.biome] || BIOME_CFG.floresta;

    // Clean up old objects
    this.layers.forEach(l => (l as any).destroy?.());
    this.layers = [];
    this.wallRects.forEach(r => (r as any).destroy?.());
    this.wallRects = [];

    // Background
    const bg = this.add.rectangle(PW / 2, PH / 2, PW, PH, cfg.bg).setDepth(0);
    this.layers.push(bg);

    // Grid lines
    const grid = this.add.graphics().setDepth(1);
    grid.lineStyle(1, cfg.floor, 0.2);
    for (let x = 0; x <= PW; x += TS * SCALE) grid.lineBetween(x, 0, x, PH);
    for (let y = 0; y <= PH; y += TS * SCALE) grid.lineBetween(0, y, PW, y);
    this.layers.push(grid);

    // Border walls
    const border = this.add.graphics().setDepth(2);
    border.fillStyle(cfg.wall);
    const BW = TS * SCALE;
    const conn = room.connections;
    const midX = PW / 2, midY = PH / 2;
    const gap = BW * 3;

    // Top
    if (conn.norte === null) {
      border.fillRect(0, 0, PW, BW);
    } else {
      border.fillRect(0, 0, midX - gap / 2, BW);
      border.fillRect(midX + gap / 2, 0, PW - (midX + gap / 2), BW);
      // Exit indicator
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(midX - gap / 2, 0, gap, BW);
      border.fillStyle(cfg.wall);
    }
    // Bottom
    if (conn.sul === null) {
      border.fillRect(0, PH - BW, PW, BW);
    } else {
      border.fillRect(0, PH - BW, midX - gap / 2, BW);
      border.fillRect(midX + gap / 2, PH - BW, PW - (midX + gap / 2), BW);
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(midX - gap / 2, PH - BW, gap, BW);
      border.fillStyle(cfg.wall);
    }
    // Left
    if (conn.oeste === null) {
      border.fillRect(0, 0, BW, PH);
    } else {
      border.fillRect(0, 0, BW, midY - gap / 2);
      border.fillRect(0, midY + gap / 2, BW, PH - (midY + gap / 2));
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(0, midY - gap / 2, BW, gap);
      border.fillStyle(cfg.wall);
    }
    // Right
    if (conn.leste === null) {
      border.fillRect(PW - BW, 0, BW, PH);
    } else {
      border.fillRect(PW - BW, 0, BW, midY - gap / 2);
      border.fillRect(PW - BW, midY + gap / 2, BW, PH - (midY + gap / 2));
      border.fillStyle(0x52b788, 0.4);
      border.fillRect(PW - BW, midY - gap / 2, BW, gap);
    }
    this.layers.push(border);

    // Wall colliders (full edges)
    const addWall = (x: number, y: number, w: number, h: number) => {
      const r = this.physics.add.staticImage(x + w / 2, y + h / 2, 'px_wall')
        .setDisplaySize(w, h).refreshBody().setAlpha(0);
      this.wallRects.push(r);
    };
    addWall(0, 0, BW, PH);
    addWall(PW - BW, 0, BW, PH);
    addWall(0, 0, PW, BW);
    addWall(0, PH - BW, PW, BW);

    // Biome decorations
    this.drawBiomeDecor(cfg, room.biome);

    // Room label
    const label = this.add.text(PW / 2, BW + 12, `${room.label} (Sala ${room.id})`, {
      fontSize: '12px',
      color: `#${cfg.accent.toString(16).padStart(6, '0')}`,
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(15).setAlpha(0.7);
    this.layers.push(label);
  }

  private drawBiomeDecor(cfg: typeof BIOME_CFG[string], biome: string) {
    const g = this.add.graphics().setDepth(3);

    switch (biome) {
      case 'taverna': {
        // Bar counter
        g.fillStyle(cfg.wall);
        g.fillRect(7 * TS * SCALE, 4 * TS * SCALE, 6 * TS * SCALE, 2.5 * TS * SCALE);
        g.fillStyle(cfg.accent, 0.8);
        g.fillRect(7.2 * TS * SCALE, 4.2 * TS * SCALE, 5.6 * TS * SCALE, 2.1 * TS * SCALE);
        // Tables
        g.fillStyle(cfg.accent, 0.4);
        [[3, 3], [15, 3], [3, 10], [15, 10], [9, 9]].forEach(([tx, ty]) => {
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 0.9);
        });
        // Fireplace
        g.fillStyle(0xe76f51, 0.8);
        g.fillRect(9 * TS * SCALE, 1.2 * TS * SCALE, 2 * TS * SCALE, TS * SCALE);
        g.fillStyle(0xf4d03f, 0.5);
        g.fillCircle(10 * TS * SCALE, 1.5 * TS * SCALE, TS * SCALE * 0.4);
        break;
      }
      case 'floresta': {
        const trees = [[3, 3], [17, 3], [4, 6], [16, 6], [5, 10], [15, 10], [3, 13], [18, 13], [7, 4], [14, 4]];
        trees.forEach(([tx, ty]) => {
          g.fillStyle(0x1b4332);
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 1.3);
          g.fillStyle(0x2d6a4f);
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 0.9);
          g.fillStyle(0x52b788, 0.5);
          g.fillCircle(tx * TS * SCALE, ty * TS * SCALE, TS * SCALE * 0.45);
        });
        // Trunk hints
        g.fillStyle(0x5c4033);
        trees.forEach(([tx, ty]) => {
          g.fillRect(tx * TS * SCALE - 3, ty * TS * SCALE, 6, TS * SCALE * 0.6);
        });
        break;
      }
      case 'montanha': {
        g.fillStyle(0x6c757d);
        g.fillTriangle(4 * TS * SCALE, 8 * TS * SCALE, 10 * TS * SCALE, 2 * TS * SCALE, 16 * TS * SCALE, 8 * TS * SCALE);
        g.fillStyle(0x9a8c98);
        g.fillTriangle(8 * TS * SCALE, 9 * TS * SCALE, 14 * TS * SCALE, 3 * TS * SCALE, 20 * TS * SCALE, 9 * TS * SCALE);
        // Snow caps
        g.fillStyle(0xffffff, 0.4);
        g.fillTriangle(10 * TS * SCALE, 2 * TS * SCALE, 9 * TS * SCALE, 3.5 * TS * SCALE, 11 * TS * SCALE, 3.5 * TS * SCALE);
        g.fillTriangle(14 * TS * SCALE, 3 * TS * SCALE, 13 * TS * SCALE, 4.5 * TS * SCALE, 15 * TS * SCALE, 4.5 * TS * SCALE);
        break;
      }
      case 'cidade': {
        [[2, 2, 4, 4], [14, 2, 4, 4], [2, 9, 4, 4], [14, 9, 4, 4]].forEach(([tx, ty, tw, th]) => {
          g.fillStyle(cfg.wall);
          g.fillRect(tx * TS * SCALE, ty * TS * SCALE, tw * TS * SCALE, th * TS * SCALE);
          g.fillStyle(0xffe066, 0.3);
          for (let wy = 1; wy < th - 1; wy++) {
            for (let wx = 1; wx < tw - 1; wx += 2) {
              g.fillRect((tx + wx) * TS * SCALE + 2, (ty + wy) * TS * SCALE + 2, TS * SCALE - 4, TS * SCALE - 4);
            }
          }
        });
        // Road
        g.fillStyle(0x495057, 0.3);
        g.fillRect(6 * TS * SCALE, 0, 8 * TS * SCALE, PH);
        g.fillRect(0, 6 * TS * SCALE, PW, 3 * TS * SCALE);
        break;
      }
      case 'ruinas': {
        [[3, 2, 2, 3], [16, 2, 2, 3], [5, 5, 3, 4], [12, 5, 3, 4], [8, 8, 4, 3]].forEach(([tx, ty, tw, th]) => {
          g.fillStyle(cfg.wall, 0.6);
          g.fillRect(tx * TS * SCALE, ty * TS * SCALE, tw * TS * SCALE, th * TS * SCALE);
          g.fillStyle(0x000000, 0.3);
          g.fillRect(tx * TS * SCALE + 2, ty * TS * SCALE + 2, tw * TS * SCALE - 4, Math.floor(th / 2) * TS * SCALE);
        });
        // Altar
        g.fillStyle(0x8b5e3c);
        g.fillRect(9 * TS * SCALE, 7 * TS * SCALE, 3 * TS * SCALE, 1.5 * TS * SCALE);
        g.fillStyle(0xe76f51, 0.4);
        g.fillCircle(10.5 * TS * SCALE, 7 * TS * SCALE, TS * SCALE * 0.3);
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

    // Rebuild room
    this.buildRoom(this.currentRoom);

    // Reposition player
    this.mySprite.setPosition(entryX, entryY);
    this.myLabel.setPosition(entryX, entryY - 18);

    // Re-add colliders
    this.wallRects.forEach(r => this.physics.add.collider(this.mySprite, r));

    this.onRoomChange?.(this.currentRoom);

    this.time.delayedCall(400, () => { this.transitioning = false; });
  }
}
