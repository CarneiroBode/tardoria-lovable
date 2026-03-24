import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { DemoScene } from '@/game/DemoScene';
import { PW, PH, ROOMS, type RoomData } from '@/game/config';

const CHAT_MESSAGES = [
  { name: 'Sistema', msg: '⚔ Bem-vindo a Tardoria!', ch: 'system' },
  { name: 'Sistema', msg: 'Use WASD ou setas para mover.', ch: 'system' },
  { name: 'Sistema', msg: 'Modo demo — explore o mundo!', ch: 'loot' },
];

const Index = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<DemoScene | null>(null);

  const [screen, setScreen] = useState<'auth' | 'game'>('auth');
  const [playerName, setPlayerName] = useState('');
  const [currentRoom, setCurrentRoom] = useState<RoomData>(ROOMS[12]);
  const [hp] = useState({ current: 100, max: 100 });
  const [gold] = useState(50);
  const [chatMessages, setChatMessages] = useState(CHAT_MESSAGES);
  const [chatInput, setChatInput] = useState('');

  // Joystick state
  const joyRef = useRef({ active: false, vx: 0, vy: 0, originX: 0, originY: 0 });
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

  const startGame = useCallback(() => {
    if (!playerName.trim()) return;
    setScreen('game');
    setChatMessages(prev => [...prev, { name: 'Sistema', msg: `${playerName} entrou no mundo!`, ch: 'loot' }]);
  }, [playerName]);

  // Init Phaser
  useEffect(() => {
    if (screen !== 'game' || !gameRef.current || phaserRef.current) return;

    const W = Math.min(PW, window.innerWidth);
    const H = Math.min(PH, window.innerHeight - 36);

    const scene = new DemoScene();
    scene.setPlayerName(playerName || 'Aventureiro');
    scene.onRoomChange = (room) => {
      setCurrentRoom(room);
      setChatMessages(prev => [...prev, { name: 'Sistema', msg: `Entrou em ${room.label} (Sala ${room.id})`, ch: 'system' }]);
    };
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: W,
      height: H,
      parent: gameRef.current,
      backgroundColor: '#0d1117',
      pixelArt: true,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    phaserRef.current = game;

    return () => {
      game.destroy(true);
      phaserRef.current = null;
      sceneRef.current = null;
    };
  }, [screen, playerName]);

  // Chat send
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const ch = chatInput.startsWith('!g ') ? 'global' : 'local';
    const msg = ch === 'global' ? chatInput.slice(3) : chatInput;
    setChatMessages(prev => [...prev, { name: playerName, msg, ch }]);
    setChatInput('');
  };

  // Joystick handlers
  const onJoyStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    joyRef.current.originX = touch.clientX - rect.left;
    joyRef.current.originY = touch.clientY - rect.top;
    joyRef.current.active = true;
    if (sceneRef.current) sceneRef.current.joy.active = true;
  };

  const onJoyMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joyRef.current.active) return;
    e.preventDefault();
    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = touch.clientX - rect.left - joyRef.current.originX;
    const dy = touch.clientY - rect.top - joyRef.current.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const R = 55;
    const clamped = Math.min(dist, R);
    const angle = Math.atan2(dy, dx);

    if (dist < 8) {
      joyRef.current.vx = 0;
      joyRef.current.vy = 0;
    } else {
      joyRef.current.vx = (Math.cos(angle) * clamped) / R;
      joyRef.current.vy = (Math.sin(angle) * clamped) / R;
    }

    if (sceneRef.current) {
      sceneRef.current.joy.vx = joyRef.current.vx;
      sceneRef.current.joy.vy = joyRef.current.vy;
    }
  };

  const onJoyEnd = () => {
    joyRef.current.active = false;
    joyRef.current.vx = 0;
    joyRef.current.vy = 0;
    if (sceneRef.current) {
      sceneRef.current.joy.active = false;
      sceneRef.current.joy.vx = 0;
      sceneRef.current.joy.vy = 0;
    }
  };

  // ── AUTH SCREEN ──
  if (screen === 'auth') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background z-50 p-5">
        <h1 className="text-4xl font-bold tracking-[8px] text-primary uppercase">⚔ Tardoria</h1>
        <p className="text-muted-foreground text-xs tracking-[3px]">Entre no mundo</p>
        <input
          type="text"
          placeholder="Nome do Personagem"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && startGame()}
          className="w-[280px] p-2.5 px-3.5 bg-card border border-border rounded-md text-foreground font-mono text-sm focus:outline-none focus:border-primary"
          autoFocus
        />
        <button
          onClick={startGame}
          className="w-[280px] p-2.5 bg-primary text-primary-foreground border-none rounded-md font-mono text-sm tracking-[2px] cursor-pointer uppercase hover:opacity-90 transition-opacity"
        >
          Jogar (Demo)
        </button>
        <p className="text-muted-foreground text-[10px] mt-2 text-center max-w-[300px] leading-relaxed">
          Modo demonstração — explore o mundo 5×5 com 25 salas e 5 biomas.
          <br />Backend não conectado.
        </p>
      </div>
    );
  }

  // ── GAME SCREEN ──
  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      {/* HUD */}
      <div className="fixed top-0 left-0 right-0 h-9 bg-background/95 border-b border-border z-50 flex items-center px-3 gap-3.5 text-xs font-mono">
        <span className="text-primary font-bold tracking-wider">{playerName}</span>
        <span className="text-[hsl(var(--hp))]">❤ {hp.current}/{hp.max}</span>
        <span className="text-[hsl(var(--gold))]">💰 {gold}g</span>
        <span className="text-muted-foreground ml-auto text-[11px]">
          {currentRoom.label} — Sala {String(currentRoom.id).padStart(2, '0')}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[9px]">DEMO</span>
      </div>

      {/* Game Canvas */}
      <div ref={gameRef} className="fixed top-9 left-0 right-0 bottom-0" />

      {/* Actions */}
      <div className="fixed bottom-28 right-2 z-50 flex flex-col gap-1.5">
        {['😴 Dormir', '🗡 Roubar', '🤝 Trocar'].map(label => (
          <button
            key={label}
            onClick={() => setChatMessages(prev => [...prev, { name: 'Sistema', msg: `${label.slice(2)} requer servidor online.`, ch: 'system' }])}
            className="px-2.5 py-1.5 bg-background/90 border border-border rounded-md text-foreground text-[11px] font-mono cursor-pointer hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="fixed bottom-0 left-0 w-[min(340px,100vw)] bg-background/95 border-t border-r border-border z-50 font-mono">
        <div className="h-[90px] overflow-y-auto p-1.5 px-2 text-[11px] leading-relaxed">
          {chatMessages.map((m, i) => (
            <div key={i} className={
              m.ch === 'system' ? 'text-muted-foreground italic' :
              m.ch === 'global' ? 'text-[hsl(var(--mana))]' :
              m.ch === 'loot' ? 'text-[hsl(var(--hp))]' :
              'text-foreground'
            }>
              {m.name ? `[${m.name}] ${m.msg}` : m.msg}
            </div>
          ))}
        </div>
        <div className="flex border-t border-border/50">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder="Mensagem… !g = global"
            maxLength={200}
            className="flex-1 bg-transparent border-none p-1.5 px-2 text-foreground font-mono text-xs focus:outline-none"
          />
          <button
            onClick={sendChat}
            className="px-2.5 py-1.5 bg-primary border-none text-primary-foreground cursor-pointer text-[11px]"
          >▶</button>
        </div>
      </div>

      {/* Joystick (mobile) */}
      {isMobile && (
        <div
          className="fixed bottom-0 left-0 w-[55vw] h-[55vw] max-w-[260px] max-h-[260px] z-50"
          style={{ touchAction: 'none', userSelect: 'none' }}
          onTouchStart={onJoyStart}
          onTouchMove={onJoyMove}
          onTouchEnd={onJoyEnd}
          onTouchCancel={onJoyEnd}
          onMouseDown={onJoyStart}
          onMouseMove={onJoyMove}
          onMouseUp={onJoyEnd}
          onMouseLeave={onJoyEnd}
        />
      )}

      {/* Mini-map */}
      <div className="fixed top-11 right-2 z-50 bg-background/80 border border-border rounded p-1">
        <div className="grid grid-cols-5 gap-px">
          {ROOMS.map(room => (
            <div
              key={room.id}
              className={`w-2.5 h-2.5 rounded-[2px] ${room.id === currentRoom.id ? 'ring-1 ring-primary' : ''}`}
              style={{
                backgroundColor:
                  room.biome === 'taverna' ? '#7b2d00' :
                  room.biome === 'floresta' ? '#1b4332' :
                  room.biome === 'cidade' ? '#343a40' :
                  room.biome === 'montanha' ? '#3d415e' :
                  '#3d2b1f',
                opacity: room.id === currentRoom.id ? 1 : 0.5,
              }}
              title={`${room.label} (${room.id})`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
