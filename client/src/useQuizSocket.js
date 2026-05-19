import { useState, useEffect, useRef, useCallback } from 'react';

export function useQuizSocket() {
  const [state, setState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const pendingRef = useRef([]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      pendingRef.current.push(data);
    }
  }, []);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      pendingRef.current.forEach(m => ws.send(JSON.stringify(m)));
      pendingRef.current = [];
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'STATE')   setState(msg.payload);
      if (msg.type === 'WELCOME') setPlayerId(msg.playerId);
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => { }, 2000);
    };

    return () => ws.close();
  }, []);

  return { state, playerId, connected, send };
}
