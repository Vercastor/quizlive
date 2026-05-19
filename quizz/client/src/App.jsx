import { useState } from 'react';
import './index.css';
import { useQuizSocket } from './useQuizSocket';
import AdminPanel from './AdminPanel';
import PlayerView from './PlayerView';

export default function App() {
  const { state, playerId, connected, send } = useQuizSocket();
  const [mode, setMode] = useState(null); // null | 'admin' | 'player'

  // ── Écran de sélection du mode ───────────────────────────────────────────
  if (!mode) {
    return (
      <div className="screen">
        <div className="text-center anim-fade-up">
          <div className="logo">🎯 QuizLive</div>
          <p className="logo-sub">Quiz multijoueur en temps réel</p>
        </div>

        <div className="card flex-col gap-md anim-fade-up" style={{ animationDelay: '0.1s' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 4 }}>
            Comment souhaitez-vous rejoindre ?
          </div>
          <button className="btn btn-primary" onClick={() => setMode('player')}>
            🎮 Je suis joueur
          </button>
          <button className="btn btn-secondary" onClick={() => setMode('admin')}>
            ⚙️ Je suis l'animateur
          </button>
        </div>

        <div className="anim-fade-up" style={{ animationDelay: '0.2s', textAlign: 'center' }}>
          <div className={`chip ${connected ? 'chip-green' : 'chip-pink'}`}>
            {connected ? '🟢 Serveur connecté' : '🔴 Connexion…'}
          </div>
        </div>
      </div>
    );
  }

  // ── Chargement ────────────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="screen">
        <div className="text-muted anim-pulse">Chargement<span className="dots"><span>.</span><span>.</span><span>.</span></span></div>
      </div>
    );
  }

  // ── Vues ─────────────────────────────────────────────────────────────────
  if (mode === 'admin') return <AdminPanel state={state} send={send} />;
  return <PlayerView state={state} playerId={playerId} send={send} />;
}
