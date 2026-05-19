import { useState, useEffect, useRef } from 'react';

const AVATAR_COLORS = ['#f72585','#7209b7','#4cc9f0','#ffd60a','#06d6a0','#ff6b35'];

const EMPTY_Q = () => ({
  text: '',
  options: ['', ''],   // 2 options par défaut
  answer: '',
  explanation: '',
  image: null,         // base64 string ou null
});

const DEFAULT_QUESTIONS = [
  {
    text: "Quelle est la capitale de l'Australie ?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    answer: "Canberra",
    explanation: "Beaucoup pensent à Sydney, mais Canberra est la capitale depuis 1927.",
    image: null,
  },
  {
    text: "Vrai ou faux : le soleil est une étoile.",
    options: ["Vrai", "Faux"],
    answer: "Vrai",
    explanation: "Le soleil est bien une étoile, une naine jaune de type G.",
    image: null,
  },
];

// Compresse une image en base64 (max 800px, qualité 0.75)
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AdminPanel({ state, send }) {
  const [tab, setTab] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [timeLimit, setTimeLimit] = useState(20);
  const [editIdx, setEditIdx] = useState(null);
  const [editQ, setEditQ] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const fileRef = useRef();

  // ── Charge les questions depuis le serveur (DB) au premier rendu ──────────
  useEffect(() => {
    if (!dbLoaded && state && state.questionsCount > 0 && questions.length === 0) {
      // Le serveur a des questions en mémoire (rechargées depuis la DB)
      // On demande au serveur de nous les renvoyer via un message spécial
      send({ type: 'ADMIN_GET_QUESTIONS' });
      setDbLoaded(true);
    } else if (!dbLoaded && state) {
      setDbLoaded(true);
    }
  }, [state]);

  // ── Reçoit les questions depuis le serveur ────────────────────────────────
  useEffect(() => {
    if (state?.loadedQuestions) {
      setQuestions(state.loadedQuestions);
      setTimeLimit(state.timeLimit || 20);
    }
  }, [state?.loadedQuestions]);

  const saveAndSend = (qs, tl) => {
    send({ type: 'ADMIN_SET_QUESTIONS', questions: qs, timeLimit: tl });
  };

  const handleAddQ = () => {
    const newQ = EMPTY_Q();
    const next = [...questions, newQ];
    setQuestions(next);
    setEditIdx(next.length - 1);
    setEditQ({ ...newQ, options: [...newQ.options] });
  };

  // ── Gestion du nombre d'options ──────────────────────────────────────────
  const addOption = () => {
    if (editQ.options.length >= 4) return;
    setEditQ({ ...editQ, options: [...editQ.options, ''] });
  };

  const removeOption = (i) => {
    if (editQ.options.length <= 2) return;
    const opts = editQ.options.filter((_, idx) => idx !== i);
    // Si la bonne réponse était celle supprimée, reset
    const answer = editQ.answer === editQ.options[i] ? '' : editQ.answer;
    setEditQ({ ...editQ, options: opts, answer });
  };

  // ── Gestion de l'image ───────────────────────────────────────────────────
  const handleImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImgLoading(true);
    try {
      const b64 = await compressImage(file);
      setEditQ(q => ({ ...q, image: b64 }));
    } catch (e) {
      alert('Erreur lors du chargement de l\'image');
    }
    setImgLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  // ── Sauvegarde ───────────────────────────────────────────────────────────
  const handleEditSave = () => {
    if (!editQ.text || !editQ.answer) return;
    const validOpts = editQ.options.filter(o => o.trim());
    if (validOpts.length < 2) return;
    const saved = { ...editQ, options: validOpts };
    const next = questions.map((q, i) => i === editIdx ? saved : q);
    setQuestions(next);
    saveAndSend(next, timeLimit);
    setEditIdx(null);
    setEditQ(null);
  };

  const handleDelete = (i) => {
    const next = questions.filter((_, idx) => idx !== i);
    setQuestions(next);
    saveAndSend(next, timeLimit);
  };

  const handleTimeLimitChange = (v) => {
    setTimeLimit(v);
    saveAndSend(questions, v);
  };

  const players = state?.players || [];
  const isLobby = state?.status === 'lobby';
  const isResults = state?.status === 'results';
  const isFinished = state?.status === 'finished';

  const OPT_LABELS = ['A', 'B', 'C', 'D'];

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 480 }}>
        <div className="logo" style={{ fontSize: '1.8rem' }}>🎯 QuizAdmin</div>
        <div style={{ flex: 1 }} />
        <span className={`chip ${state?.status === 'question' ? 'chip-pink' : state?.status === 'lobby' ? 'chip-blue' : 'chip-green'}`}>
          {state?.status || '…'}
        </span>
      </div>

      <div className="tabs">
        {['questions', 'joueurs', 'contrôle'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'questions' ? '❓ Questions' : t === 'joueurs' ? '👥 Joueurs' : '🎮 Contrôle'}
          </button>
        ))}
      </div>

      {/* ── TAB Questions ── */}
      {tab === 'questions' && (
        <div className="flex-col gap-md w-full max-w anim-fade-up">
          <div className="flex-col gap-sm">
            <label>⏱ Temps par question (secondes)</label>
            <input
              type="number" min="5" max="120" value={timeLimit}
              onChange={e => handleTimeLimitChange(+e.target.value)}
            />
          </div>

          {questions.map((q, i) => (
            <div key={i} className="card" style={{ padding: '16px' }}>
              {editIdx === i ? (
                /* ── Formulaire d'édition ── */
                <div className="flex-col gap-sm">

                  {/* Texte de la question */}
                  <div className="field">
                    <label>Question</label>
                    <textarea value={editQ.text} onChange={e => setEditQ({ ...editQ, text: e.target.value })} />
                  </div>

                  {/* Zone image */}
                  <div className="field">
                    <label>🖼 Image (optionnel)</label>
                    <div
                      onDrop={handleDrop}
                      onDragOver={e => e.preventDefault()}
                      onClick={() => fileRef.current.click()}
                      style={{
                        border: '2px dashed var(--border)',
                        borderRadius: 12,
                        padding: editQ.image ? 0 : '20px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.02)',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      {imgLoading ? (
                        <div className="text-muted anim-pulse" style={{ padding: 16 }}>Chargement…</div>
                      ) : editQ.image ? (
                        <div style={{ position: 'relative' }}>
                          <img src={editQ.image} alt="preview"
                            style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', borderRadius: 10 }} />
                          <button
                            onClick={e => { e.stopPropagation(); setEditQ({ ...editQ, image: null }); }}
                            style={{
                              position: 'absolute', top: 8, right: 8,
                              background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                              width: 28, height: 28, color: '#fff', cursor: 'pointer', fontSize: '0.9rem'
                            }}>✕</button>
                        </div>
                      ) : (
                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                          📁 Cliquez ou glissez une image ici
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleImageFile(e.target.files[0])} />
                  </div>

                  {/* Options de réponse */}
                  <label style={{ marginBottom: 0 }}>Réponses ({editQ.options.length}/4)</label>
                  {editQ.options.map((opt, oi) => (
                    <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontFamily: 'Fredoka One', fontSize: '0.9rem', minWidth: 24,
                        color: ['var(--accent)','var(--accent3)','var(--gold)','var(--green)'][oi]
                      }}>{OPT_LABELS[oi]}</span>
                      <input
                        value={opt}
                        placeholder={`Option ${OPT_LABELS[oi]}`}
                        onChange={e => {
                          const opts = [...editQ.options];
                          opts[oi] = e.target.value;
                          // Si c'était la bonne réponse, on la met à jour
                          const answer = editQ.answer === editQ.options[oi] ? e.target.value : editQ.answer;
                          setEditQ({ ...editQ, options: opts, answer });
                        }}
                        style={{ flex: 1 }}
                      />
                      {editQ.options.length > 2 && (
                        <button onClick={() => removeOption(oi)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {editQ.options.length < 4 && (
                    <button className="btn btn-secondary" style={{ padding: '8px', fontSize: '0.85rem' }} onClick={addOption}>
                      + Ajouter une option
                    </button>
                  )}

                  {/* Bonne réponse */}
                  <div className="field">
                    <label>✓ Bonne réponse</label>
                    <select value={editQ.answer} onChange={e => setEditQ({ ...editQ, answer: e.target.value })}>
                      <option value="">— choisir —</option>
                      {editQ.options.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Explication */}
                  <div className="field">
                    <label>💡 Explication (optionnel)</label>
                    <textarea value={editQ.explanation || ''} onChange={e => setEditQ({ ...editQ, explanation: e.target.value })} />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-green" style={{ flex: 1 }} onClick={handleEditSave}>✓ Sauvegarder</button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditIdx(null); setEditQ(null); }}>Annuler</button>
                  </div>
                </div>
              ) : (
                /* ── Aperçu de la question ── */
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {q.image && (
                    <img src={q.image} alt=""
                      style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      Q{i + 1}. {q.text || <em style={{ color: 'var(--text-muted)' }}>Sans titre</em>}
                    </div>
                    <div style={{ color: 'var(--green)', fontSize: '0.85rem' }}>✓ {q.answer}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>
                      {q.options.length} options{q.image ? ' · 🖼 image' : ''}
                    </div>
                  </div>
                  <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem' }}
                    onClick={() => { setEditIdx(i); setEditQ({ ...q, options: [...q.options] }); }}>✏️</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(i)}>🗑</button>
                </div>
              )}
            </div>
          ))}

          <button className="btn btn-secondary" onClick={handleAddQ}>+ Ajouter une question</button>
          <button className="btn btn-primary" onClick={() => saveAndSend(questions, timeLimit)}>
            💾 Enregistrer le quiz
          </button>
        </div>
      )}

      {/* ── TAB Joueurs ── */}
      {tab === 'joueurs' && (
        <div className="flex-col gap-sm w-full max-w anim-fade-up stagger">
          {players.length === 0 ? (
            <div className="card text-center">
              <p className="text-muted">En attente de joueurs<span className="dots"><span>.</span><span>.</span><span>.</span></span></p>
            </div>
          ) : players.map((p, i) => (
            <div key={p.id} className="player-badge anim-fade-up">
              <div className="player-avatar" style={{ background: AVATAR_COLORS[i % 6] }}>
                {p.name[0].toUpperCase()}
              </div>
              <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
              <span style={{ color: 'var(--gold)', fontFamily: 'Fredoka One', marginRight: 8 }}>{p.score} pts</span>
              <button className="btn btn-danger" onClick={() => send({ type: 'ADMIN_KICK', targetId: p.id })}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB Contrôle ── */}
      {tab === 'contrôle' && (
        <div className="flex-col gap-md w-full max-w anim-fade-up">
          <div className="card text-center">
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>État actuel</div>
            <div style={{ fontFamily: 'Fredoka One', fontSize: '1.4rem' }}>
              {state?.status === 'lobby'    && '🏠 Lobby'}
              {state?.status === 'question' && `❓ Question ${(state?.questionIndex ?? 0) + 1} / ${state?.totalQuestions}`}
              {state?.status === 'results'  && '📊 Résultats'}
              {state?.status === 'finished' && '🏆 Terminé'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
              {players.length} joueur{players.length > 1 ? 's' : ''} connecté{players.length > 1 ? 's' : ''}
            </div>
          </div>

          {isLobby && (
            <button className="btn btn-primary"
              disabled={questions.length === 0 || players.length === 0}
              onClick={() => send({ type: 'ADMIN_START' })}>
              🚀 Lancer le quiz
            </button>
          )}
          {isResults && (
            <button className="btn btn-green" onClick={() => send({ type: 'ADMIN_NEXT' })}>
              ➡️ Question suivante
            </button>
          )}
          {isFinished && (
            <button className="btn btn-gold" onClick={() => send({ type: 'ADMIN_RESET' })}>
              🔄 Rejouer
            </button>
          )}
          {!isLobby && !isFinished && (
            <button className="btn btn-secondary" onClick={() => send({ type: 'ADMIN_RESET' })}>
              ⏹ Arrêter la partie
            </button>
          )}

          {players.length > 0 && (
            <div className="card flex-col gap-sm">
              <div style={{ fontFamily: 'Fredoka One', fontSize: '1.1rem', marginBottom: 4 }}>🏅 Classement</div>
              {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="score-row">
                  <span className="score-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}</span>
                  <span className="score-name">{p.name}</span>
                  <span className="score-pts">{p.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
