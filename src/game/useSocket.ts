import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://185.135.159.74';

export interface PlayerState {
  socketId: string;
  charId: string;
  userId: string;
  name: string;
  class: string;
  sprite: string;
  hp: number;
  hpMax: number;
  gold: number;
  level: number;
  roomId: number;
  x: number;
  y: number;
  isSleeping: boolean;
  direction: string;
  moving: boolean;
}

export interface ChatMsg {
  charId?: string;
  name: string;
  message: string;
  channel: string;
  ts?: number;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [others, setOthers] = useState<PlayerState[]>([]);
  const [room, setRoom] = useState<any>(null);
  const [gold, setGold] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback((token: string) => {
    if (socketRef.current) return;

    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setConnected(false);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('init', (data: { player: PlayerState; room: any; others: PlayerState[] }) => {
      setPlayer(data.player);
      setRoom(data.room);
      setOthers(data.others);
      setGold(data.player.gold);
    });

    socket.on('player:join', (p: PlayerState) => {
      setOthers(prev => [...prev.filter(o => o.charId !== p.charId), p]);
    });

    socket.on('player:leave', ({ charId }: { charId: string }) => {
      setOthers(prev => prev.filter(o => o.charId !== charId));
    });

    socket.on('tick', (list: any[]) => {
      setOthers(prev => {
        const map = new Map(prev.map(p => [p.charId, p]));
        for (const u of list) {
          const existing = map.get(u.charId);
          if (existing) {
            map.set(u.charId, { ...existing, ...u });
          }
        }
        return Array.from(map.values());
      });
    });

    socket.on('roomChanged', (data: { room: any; others: PlayerState[]; player: PlayerState }) => {
      setPlayer(data.player);
      setRoom(data.room);
      setOthers(data.others);
    });

    socket.on('chat', (msg: ChatMsg) => {
      setChatMessages(prev => [...prev.slice(-100), { name: msg.name, message: msg.message, channel: msg.channel }]);
    });

    socket.on('goldUpdate', ({ gold: g }: { gold: number }) => {
      setGold(g);
    });

    socket.on('stealResult', (result: any) => {
      const msg = result.success
        ? `Roubou ${result.amount}g com sucesso!`
        : `Roubo falhou: ${result.reason}`;
      setChatMessages(prev => [...prev, { name: 'Sistema', message: msg, channel: 'system' }]);
    });

    socket.on('stolen', ({ by, amount }: { by: string; amount: number }) => {
      setChatMessages(prev => [...prev, { name: 'Sistema', message: `${by} roubou ${amount}g de você!`, channel: 'system' }]);
    });

    socket.on('player:sleep', ({ charId }: { charId: string }) => {
      setOthers(prev => prev.map(p => p.charId === charId ? { ...p, isSleeping: true } : p));
    });

    socket.on('player:wake', ({ charId }: { charId: string }) => {
      setOthers(prev => prev.map(p => p.charId === charId ? { ...p, isSleeping: false } : p));
    });

    socket.on('sleepOk', () => {
      setPlayer(prev => prev ? { ...prev, isSleeping: true } : prev);
    });

    socket.on('wakeOk', () => {
      setPlayer(prev => prev ? { ...prev, isSleeping: false } : prev);
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
    setPlayer(null);
    setOthers([]);
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return { connected, player, others, room, gold, chatMessages, error, connect, disconnect, emit, setChatMessages };
}
