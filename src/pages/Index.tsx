import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { DemoScene } from '@/game/DemoScene';
import { PW, PH, ROOMS, type RoomData } from '@/game/config';
import { useSocket } from '@/game/useSocket';

const SERVER_URL = 'http://185.135.159.74';

const Index = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<DemoScene | null>(null);

  const [screen, setScreen] = useState<'login' | 'register' | 'chars' | 'game'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [charName, setCharName] = useState('');
  const [charClass, setCharClass] = useState('guerreiro');
  const [characters, setCharacters] = useState<any[]>([]);
  const [authToken, setAuthToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  const { connected, player, others, room, gold, chatMessages, error: socketError, connect, emit, setChatMessages } = useSocket();

  const [chatInput, setChatInput] = useState('');
  const [currentRoom, setCurrentRoom] = useState<RoomData>(ROOMS[12]);

  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const joyRef = useRef({ active: false, vx: 0, vy: 0, originX: 0, originY: 0 });

  // ── API calls ──
  const apiCall = async (path: string, body: any) => {
    const res = await fetch(`${SERVER_URL}/api/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const doLogin = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const data = await apiCall('/login', { email, password });
      if (data.error) { setAuthError(data.error); return; }
      setCharacters(data.characters || []);
      setAuthToken(data.token || '');
      setScreen('chars');
    } catch (e: any) {
      setAuthError('Servidor offline ou erro de rede.');
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const data = await apiCall('/register', { email, password });
      if (data.error) { setAuthError(data.error); return; }
      setAuthError('');
      setScreen('login');
      setChatMessages(prev => [...prev, { name: 'Sistema', message: 'Conta criada! Faça login.', channel: 'system' }]);
    } catch {
      setAuthError('Erro ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  const selectChar = async (charId: string) => {
    setLoading(true);
    try {
      const data = await apiCall('/select', { userId: characters[0]?.user_id, charId });
      if (data.token) {
        setAuthToken(data.token);
        connect(data.token);
        setScreen('game');
      }
    } catch {
      setAuthError('Erro ao selecionar personagem.');
    } finally {
      setLoading(false);
    }
  };

  const createChar = async () => {
    if (!charName.trim()) return;
    setLoading(true);
    try {
      const data = await apiCall('/character', { token: authToken, name: charName, class: charClass });
      if (data.error) { setAuthError(data.error); return; }
      if (data.character) {
        setCharacters(prev => [...prev, data.character]);
        setCharName('');
      }
    } catch {
      setAuthError('Erro ao criar personagem.');
    } finally {
      setLoading(false);
    }
  };

  // ── Phaser init ──
  useEffect(() => {
    if (screen !== 'game' || !gameRef.current || phaserRef.current) return;

    const W = Math.min(PW, window.innerWidth);
    const H = Math.min(PH, window.innerHeight - 36);

    const scene = new DemoScene();
    scene.setPlayerName(player?.name || 'Aventureiro');
    scene.onRoomChange = (r) => {
      setCurrentRoom(r);
      if (connected) {
        emit('changeRoom', { roomId: r.id, x: r.spawnX, y: r.spawnY });
      }
    };
    sceneRef.current = scene;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: W, height: H,
      parent: gameRef.current,
      backgroundColor: '#0d1117',
      pixelArt: true,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });

    phaserRef.current = game;
    return () => { game.destroy(true); phaserRef.current = null; sceneRef.current = null; };
  }, [screen]);

  // ── Send movement to server ──
  useEffect(() => {
    if (!connected || !sceneRef.current) return;
    const interval = setInterval(() => {
      const s = sceneRef.current as any;
      if (s?.mySprite) {
        emit('move', {
          x: Math.round(s.mySprite.x),
          y: Math.round(s.mySprite.y),
          direction: s.lastDir || 'down',
          moving: s.mySprite.body?.velocity?.length() > 0,
        });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [connected, emit]);

  // ── Chat ──
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const channel = chatInput.startsWith('!g ') ? 'global' : 'local';
    const message = channel === 'global' ? chatInput.slice(3) : chatInput;
    if (connected) {
      emit('chat', { message, channel });
    } else {
      setChatMessages(prev => [...prev, { name: player?.name || 'Você', message, channel }]);
    }
    setChatInput('');
  };

  // ── Actions ──
  const doSleep = () => connected && emit('sleep');
  const doWake = () => connected && emit('wake');

  // Joystick handlers
  const onJoyStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    joyRef.current = { active: true, vx: 0, vy: 0, originX: touch.clientX - rect.left, originY: touch.clientY - rect.top };
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
    joyRef.current.vx = dist < 8 ? 0 : (Math.cos(angle) * clamped) / R;
    joyRef.current.vy = dist < 8 ? 0 : (Math.sin(angle) * clamped) / R;
    if (sceneRef.current) {
      sceneRef.current.joy.vx = joyRef.current.vx;
      sceneRef.current.joy.vy = joyRef.current.vy;
    }
  };

  const onJoyEnd = () => {
    joyRef.current = { active: false, vx: 0, vy: 0, originX: 0, originY: 0 };
    if (sceneRef.current) { sceneRef.current.joy.active = false; sceneRef.current.joy.vx = 0; sceneRef.current.joy.vy = 0; }
  };

  // ── LOGIN SCREEN ──
  if (screen === 'login' || screen === 'register') {
    const isLogin = screen === 'login';
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background z-50 p-5">
        <h1 className="text-4xl font-bold tracking-[8px] text-primary uppercase">⚔ Tardoria</h1>
        <p className="text-muted-foreground text-xs tracking-[3px]">{isLogin ? 'Entrar' : 'Criar Conta'}</p>

        {authError && <p className="text-destructive text-xs max-w-[280px] text-center">{authError}</p>}
        {socketError && <p className="text-destructive text-xs max-w-[280px] text-center">Socket: {socketError}</p>}

        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-[280px] p-2.5 px-3.5 bg-card border border-border rounded-md text-foreground font-mono text-sm focus:outline-none focus:border-primary" />
        <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (isLogin ? doLogin() : doRegister())}
          className="w-[280px] p-2.5 px-3.5 bg-card border border-border rounded-md text-foreground font-mono text-sm focus:outline-none focus:border-primary" />

        <button onClick={isLogin ? doLogin : doRegister} disabled={loading}
          className="w-[280px] p-2.5 bg-primary text-primary-foreground border-none rounded-md font-mono text-sm tracking-[2px] cursor-pointer uppercase hover:opacity-90 transition-opacity disabled:opacity-50">
          {loading ? '...' : isLogin ? 'Entrar' : 'Registrar'}
        </button>

        <button onClick={() => { setScreen(isLogin ? 'register' : 'login'); setAuthError(''); }}
          className="text-muted-foreground text-xs underline cursor-pointer bg-transparent border-none">
          {isLogin ? 'Criar conta' : 'Já tenho conta'}
        </button>

        <p className="text-muted-foreground text-[10px] mt-2 text-center max-w-[300px] leading-relaxed">
          Conectando a {SERVER_URL}
        </p>
      </div>
    );
  }

  // ── CHAR SELECT ──
  if (screen === 'chars') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background z-50 p-5">
        <h1 className="text-2xl font-bold tracking-[4px] text-primary uppercase">Personagens</h1>

        {authError && <p className="text-destructive text-xs">{authError}</p>}

        <div className="flex flex-col gap-2 w-[300px] max-h-[200px] overflow-y-auto">
          {characters.map((c: any) => (
            <button key={c.id} onClick={() => selectChar(c.id)} disabled={loading}
              className="p-3 bg-card border border-border rounded-md text-foreground font-mono text-sm cursor-pointer hover:border-primary transition-colors text-left disabled:opacity-50">
              <span className="text-primary font-bold">{c.name}</span>
              <span className="text-muted-foreground ml-2">Lv.{c.level} {c.class}</span>
              <span className="text-[hsl(var(--gold))] ml-2">{c.gold}g</span>
            </button>
          ))}
          {characters.length === 0 && <p className="text-muted-foreground text-xs text-center">Nenhum personagem. Crie um abaixo.</p>}
        </div>

        <div className="flex gap-2 w-[300px]">
          <input type="text" placeholder="Nome" value={charName} onChange={e => setCharName(e.target.value)}
            className="flex-1 p-2 bg-card border border-border rounded-md text-foreground font-mono text-sm focus:outline-none focus:border-primary" />
          <select value={charClass} onChange={e => setCharClass(e.target.value)}
            className="p-2 bg-card border border-border rounded-md text-foreground font-mono text-xs">
            <option value="guerreiro">Guerreiro</option>
            <option value="mago">Mago</option>
            <option value="ladino">Ladino</option>
          </select>
        </div>
        <button onClick={createChar} disabled={loading}
          className="w-[300px] p-2 bg-primary text-primary-foreground border-none rounded-md font-mono text-sm tracking-[2px] cursor-pointer uppercase hover:opacity-90 disabled:opacity-50">
          {loading ? '...' : 'Criar Personagem'}
        </button>
      </div>
    );
  }

  // ── GAME SCREEN ──
  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      {/* HUD */}
      <div className="fixed top-0 left-0 right-0 h-9 bg-background/95 border-b border-border z-50 flex items-center px-3 gap-3.5 text-xs font-mono">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-primary font-bold tracking-wider">{player?.name || 'Carregando...'}</span>
        <span className="text-[hsl(var(--hp))]">❤ {player?.hp || 0}/{player?.hpMax || 100}</span>
        <span className="text-[hsl(var(--gold))]">💰 {gold}g</span>
        <span className="text-muted-foreground ml-auto text-[11px]">
          {currentRoom.label} — Sala {String(currentRoom.id).padStart(2, '0')}
        </span>
        <span className="text-muted-foreground text-[10px]">{others.length} online</span>
      </div>

      {/* Game Canvas */}
      <div ref={gameRef} className="fixed top-9 left-0 right-0 bottom-0" />

      {/* Actions */}
      <div className="fixed bottom-28 right-2 z-50 flex flex-col gap-1.5">
        <button onClick={player?.isSleeping ? doWake : doSleep}
          className="px-2.5 py-1.5 bg-background/90 border border-border rounded-md text-foreground text-[11px] font-mono cursor-pointer hover:border-primary hover:text-primary transition-colors">
          {player?.isSleeping ? '☀ Acordar' : '😴 Dormir'}
        </button>
      </div>

      {/* Chat */}
      <div className="fixed bottom-0 left-0 w-[min(340px,100vw)] bg-background/95 border-t border-r border-border z-50 font-mono">
        <div className="h-[90px] overflow-y-auto p-1.5 px-2 text-[11px] leading-relaxed">
          {chatMessages.map((m, i) => (
            <div key={i} className={
              m.channel === 'system' ? 'text-muted-foreground italic' :
              m.channel === 'global' ? 'text-[hsl(var(--mana))]' :
              'text-foreground'
            }>
              {m.name ? `[${m.name}] ${m.message}` : m.message}
            </div>
          ))}
        </div>
        <div className="flex border-t border-border/50">
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Mensagem… !g = global" maxLength={200}
            className="flex-1 bg-transparent border-none p-1.5 px-2 text-foreground font-mono text-xs focus:outline-none" />
          <button onClick={sendChat} className="px-2.5 py-1.5 bg-primary border-none text-primary-foreground cursor-pointer text-[11px]">▶</button>
        </div>
      </div>

      {/* Joystick (mobile) */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 w-[55vw] h-[55vw] max-w-[260px] max-h-[260px] z-50"
          style={{ touchAction: 'none', userSelect: 'none' }}
          onTouchStart={onJoyStart} onTouchMove={onJoyMove} onTouchEnd={onJoyEnd} onTouchCancel={onJoyEnd}
          onMouseDown={onJoyStart} onMouseMove={onJoyMove} onMouseUp={onJoyEnd} onMouseLeave={onJoyEnd} />
      )}

      {/* Mini-map */}
      <div className="fixed top-11 right-2 z-50 bg-background/80 border border-border rounded p-1">
        <div className="grid grid-cols-5 gap-px">
          {ROOMS.map(r => (
            <div key={r.id}
              className={`w-2.5 h-2.5 rounded-[2px] ${r.id === currentRoom.id ? 'ring-1 ring-primary' : ''}`}
              style={{
                backgroundColor: r.biome === 'taverna' ? '#7b2d00' : r.biome === 'floresta' ? '#1b4332' : r.biome === 'cidade' ? '#343a40' : r.biome === 'montanha' ? '#3d415e' : '#3d2b1f',
                opacity: r.id === currentRoom.id ? 1 : 0.5,
              }}
              title={`${r.label} (${r.id})`} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
