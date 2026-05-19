import { useState, useEffect } from 'react';
import TimerRing from './TimerRing';

const OPT_CLASSES = ['opt-A', 'opt-B', 'opt-C', 'opt-D'];
const AVATAR_COLORS = ['#f72585','#7209b7','#4cc9f0','#ffd60a','#06d6a0','#ff6b35'];

export default function PlayerView({ state, playerId, send }) {
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [prevQIdx, setPrevQIdx] = useState(-1);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (state?.questionIndex !== prevQIdx) {
      setChosen(null);
      setPrevQIdx(state?.questionIndex ?? -1);
    }
  }, [state?.questionIndex]);

  useEffect(() => {
    if (state?.status === 'results' && chosen && state?.currentAnswer && chosen !== state.currentAnswer) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [state?.status]);

  const me = state?.players?.find(p => p.id === playerId);
  const myIdx = state?.players?.findIndex(p => p.id === playerId) ?? 0;
  const avatarColor = AVATAR_COLORS[myIdx % 6];

  const handleJoin = () => {
    if (!name.trim()) return;
    send({ type: 'JOIN', name: name.trim() });
    setJoined(true);
  };

  const handleAnswer = (opt) => {
    if (chosen || state?.status !== 'question') return;
    setChosen(opt);
    send({ type: 'ANSWER', answer: opt });
  };

  // ── Grille d'options adaptive selon le nombre ────────────────────────────
  // 2 options → colonne unique (pleine largeur)
  // 3 options → 2 colonnes (3e en bas à gauche)
  // 4 options → 2 colonnes
  const optionsGridStyle = (count) => {
    if (count === 2) return { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 480 };
    return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      width: '100%',
      maxWidth: 480,
    };
  };

  const optionStyle = (count, idx) => {
    // Si 3 options, la 3e prend toute la largeur
    if (count === 3 && idx === 2) return { gridColumn: '1 / -1' };
    return {};
  };

  // ── Pas encore rejoint ───────────────────────────────────────────────────
  if (!joined || !me) {
    return (
      <div className="screen">
        <div className="text-center anim-fade-up">
          <div className="logo">🎯 QuizLive</div>
          <p className="logo-sub">Rejoignez la partie !</p>
        </div>
        <div className="card anim-fade-up flex-col gap-md" style={{ animationDelay: '0.1s' }}>
          <div className="field">
            <label>Votre pseudo</label>
            <input
              type="text" maxLength={20} placeholder="Ex : Capitaine Quiz"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={handleJoin} disabled={!name.trim()}>
            Rejoindre 🎉
          </button>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
          {state?.players?.length ?? 0} joueur(s) dans le lobby
        </div>
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (state?.status === 'lobby') {
    return (
      <div className="screen">
        <div className="text-center anim-pop">
          <div className="logo">🎯 QuizLive</div>
        </div>
        <div className="card text-center flex-col gap-md anim-fade-up">
          <div className="player-avatar" style={{ background: avatarColor, width: 64, height: 64, fontSize: '1.6rem', margin: '0 auto' }}>
            {me.name[0].toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem' }}>{me.name}</div>
          <div className="chip chip-blue anim-pulse" style={{ margin: '0 auto' }}>
            ⏳ En attente du lancement
          </div>
        </div>
        <div className="card flex-col gap-sm anim-fade-up" style={{ animationDelay: '0.15s' }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1rem', color: 'var(--text-muted)' }}>
            Joueurs connectés ({state.players.length})
          </div>
          <div className="flex-col gap-sm stagger">
            {state.players.map((p, i) => (
              <div key={p.id} className="player-badge anim-fade-up">
                <div className="player-avatar" style={{ background: AVATAR_COLORS[i % 6] }}>
                  {p.name[0].toUpperCase()}
                </div>
                <span style={{ fontWeight: 700 }}>{p.name}</span>
                {p.id === playerId && <span className="chip chip-green" style={{ marginLeft: 'auto' }}>Vous</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Question ─────────────────────────────────────────────────────────────
  if (state?.status === 'question' && state.currentQuestion) {
    const q = state.currentQuestion;
    const answeredCount = state.players.filter(p => p.answered).length;
    const optCount = q.options.length;

    return (
      <div className="screen" style={{ gap: 14 }}>
        {/* Header : timer + progression + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 480 }}>
          <TimerRing timerEnd={state.timerEnd} timeLimit={state.timeLimit} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              Q{q.index + 1} / {q.total}
            </div>
            <div className="progress-bar" style={{ marginTop: 6 }}>
              <div className="progress-fill" style={{ width: `${((q.index + 1) / q.total) * 100}%` }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Fredoka One', color: 'var(--gold)', fontSize: '1.1rem' }}>{me.score}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pts</div>
          </div>
        </div>

        {/* Image de la question */}
        {q.image && (
          <div style={{ width: '100%', maxWidth: 480, borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }} className="anim-fade-up">
            <img src={q.image} alt="illustration"
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Texte de la question */}
        <div className="card text-center anim-pop"
          style={{ fontSize: q.image ? '1rem' : '1.1rem', fontWeight: 700, lineHeight: 1.4, padding: '16px 20px' }}>
          {q.text}
        </div>

        {/* Options */}
        <div className={shake ? 'anim-shake' : ''} style={optionsGridStyle(optCount)}>
          {q.options.map((opt, i) => {
            let cls = `option-btn ${OPT_CLASSES[i]}`;
            if (chosen) {
              if (opt === chosen) cls += ' opt-correct';
              else cls += ' opt-neutral';
            }
            return (
              <button
                key={opt}
                className={`${cls} anim-fade-up`}
                style={{ animationDelay: `${0.05 * i}s`, ...optionStyle(optCount, i) }}
                onClick={() => handleAnswer(opt)}
                disabled={!!chosen}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Statut réponse */}
        <div style={{ textAlign: 'center' }}>
          {chosen
            ? <div className="chip chip-green anim-pop">✓ Réponse envoyée !</div>
            : <div className="text-muted">Choisissez votre réponse</div>
          }
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div className="text-muted" style={{ fontSize: '0.8rem' }}>{answeredCount} / {state.players.length} ont répondu</div>
          <div className="answered-list">
            {state.players.map(p => (
              <div key={p.id} className={`answered-dot ${p.answered ? 'done' : 'wait'}`} title={p.name} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Résultats d'une question ─────────────────────────────────────────────
  if (state?.status === 'results') {
    const correctAnswer = state.currentAnswer;
    const wasCorrect = chosen === correctAnswer;

    return (
      <div className="screen">
        <div className="text-center anim-pop">
          <div style={{ fontSize: '4rem', lineHeight: 1 }}>{wasCorrect ? '🎉' : chosen ? '😬' : '⏰'}</div>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.6rem', marginTop: 8 }}>
            {wasCorrect ? 'Bonne réponse !' : chosen ? 'Raté !' : 'Temps écoulé !'}
          </div>
        </div>

        {/* Image affiché également sur l'écran résultats */}
        {state.currentImage && (
          <div style={{ width: '100%', maxWidth: 480, borderRadius: 14, overflow: 'hidden' }} className="anim-fade-up">
            <img src={state.currentImage} alt=""
              style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <div className="card flex-col gap-md anim-fade-up">
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Bonne réponse
          </div>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.3rem', color: 'var(--green)' }}>
            ✓ {correctAnswer}
          </div>
          {state.currentExplanation && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              💡 {state.currentExplanation}
            </div>
          )}
        </div>

        <div className="card flex-col gap-sm anim-fade-up" style={{ animationDelay: '0.1s' }}>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1rem', color: 'var(--text-muted)' }}>🏅 Classement</div>
          {[...state.players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={p.id} className={`score-row ${p.id === playerId ? 'anim-pulse' : ''}`}
              style={{ border: p.id === playerId ? '1px solid var(--accent)' : undefined }}>
              <span className="score-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
              <span className="score-name">{p.name}{p.id === playerId ? ' (vous)' : ''}</span>
              <span className="score-pts">{p.score}</span>
            </div>
          ))}
        </div>

        <div className="chip chip-blue anim-pulse">⏳ En attente de la prochaine question…</div>
      </div>
    );
  }

  // ── Fin de partie ────────────────────────────────────────────────────────
  if (state?.status === 'finished') {
    const sorted = [...(state.players || [])].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.id === playerId) + 1;
    const winner = sorted[0];

    return (
      <div className="screen">
        <div className="text-center anim-pop">
          <div style={{ fontSize: '4rem' }}>🏆</div>
          <div className="logo" style={{ marginTop: 8 }}>Partie terminée !</div>
          {winner && <p style={{ color: 'var(--gold)', fontFamily: 'Fredoka One', fontSize: '1.2rem', marginTop: 8 }}>
            Vainqueur : {winner.name}
          </p>}
        </div>

        <div className="card flex-col gap-sm anim-fade-up">
          <div style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', marginBottom: 4 }}>Classement final</div>
          {sorted.map((p, i) => (
            <div key={p.id} className="score-row" style={{ border: p.id === playerId ? '1px solid var(--gold)' : undefined }}>
              <span className="score-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
              <span className="score-name">{p.name}{p.id === playerId ? ' (vous)' : ''}</span>
              <span className="score-pts">{p.score} pts</span>
            </div>
          ))}
        </div>

        <div className="card text-center anim-fade-up" style={{ animationDelay: '0.15s' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Votre classement</div>
          <div style={{ fontFamily: 'Fredoka One', fontSize: '2rem', color: myRank === 1 ? 'var(--gold)' : 'var(--text)' }}>
            {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`} — {me?.score} pts
          </div>
        </div>

        <div className="chip chip-blue anim-pulse">⏳ En attente de l'admin pour rejouer…</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="text-center text-muted anim-pulse">Connexion<span className="dots"><span>.</span><span>.</span><span>.</span></span></div>
    </div>
  );
}
