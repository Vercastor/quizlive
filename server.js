const express = require('express');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '10mb' })); // limite haute pour les images base64
app.use(express.static(path.join(__dirname, 'client/dist')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ─── Base de données PostgreSQL ──────────────────────────────────────────────
// DATABASE_URL est injectée automatiquement par Render quand on lie une DB
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDB() {
  if (!pool) { console.log('⚠️  Pas de DATABASE_URL — mode mémoire uniquement'); return; }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_config (
      id TEXT PRIMARY KEY,
      questions JSONB NOT NULL DEFAULT '[]',
      time_limit INTEGER NOT NULL DEFAULT 20,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  // Ligne unique de configuration
  await pool.query(`
    INSERT INTO quiz_config (id, questions, time_limit)
    VALUES ('main', '[]', 20)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('✅  Base de données initialisée');
}

async function loadQuestionsFromDB() {
  if (!pool) return null;
  try {
    const res = await pool.query('SELECT questions, time_limit FROM quiz_config WHERE id = $1', ['main']);
    if (res.rows.length) return { questions: res.rows[0].questions, timeLimit: res.rows[0].time_limit };
  } catch (e) { console.error('Erreur lecture DB:', e.message); }
  return null;
}

async function saveQuestionsToDB(questions, timeLimit) {
  if (!pool) return;
  try {
    await pool.query(
      'UPDATE quiz_config SET questions = $1, time_limit = $2, updated_at = now() WHERE id = $3',
      [JSON.stringify(questions), timeLimit, 'main']
    );
  } catch (e) { console.error('Erreur écriture DB:', e.message); }
}

// ─── État global ────────────────────────────────────────────────────────────
let gameState = {
  status: 'lobby',
  questions: [],
  currentQ: -1,
  timeLimit: 20,
  players: {},
  timer: null,
  timerEnd: null,
};

const clients = new Map();

// ─── Utilitaires ────────────────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

function broadcastState() {
  broadcast({ type: 'STATE', payload: publicState() });
}

function publicState() {
  const q = gameState.questions[gameState.currentQ];
  const questionForPlayers = q ? {
    index: gameState.currentQ,
    total: gameState.questions.length,
    text: q.text,
    options: q.options,
    image: q.image || null,
  } : null;

  return {
    status: gameState.status,
    currentQuestion: gameState.status === 'question' ? questionForPlayers : null,
    currentAnswer: gameState.status === 'results' && q ? q.answer : null,
    currentExplanation: gameState.status === 'results' && q ? (q.explanation || null) : null,
    currentImage: gameState.status === 'results' && q ? (q.image || null) : null,
    timerEnd: gameState.timerEnd,
    timeLimit: gameState.timeLimit,
    // Indique si les questions sont chargées (utile côté admin au démarrage)
    questionsCount: gameState.questions.length,
    players: Object.entries(gameState.players).map(([id, p]) => ({
      id, name: p.name, score: p.score, answered: p.answered,
    })),
    questionIndex: gameState.currentQ,
    totalQuestions: gameState.questions.length,
  };
}

// ─── Timer ───────────────────────────────────────────────────────────────────
function startTimer() {
  clearTimeout(gameState.timer);
  gameState.timerEnd = Date.now() + gameState.timeLimit * 1000;
  gameState.timer = setTimeout(revealResults, gameState.timeLimit * 1000);
}

function revealResults() {
  clearTimeout(gameState.timer);
  gameState.status = 'results';
  broadcastState();
}

// ─── Logique de jeu ──────────────────────────────────────────────────────────
function nextQuestion() {
  if (gameState.currentQ + 1 >= gameState.questions.length) {
    gameState.status = 'finished';
    gameState.timerEnd = null;
    broadcastState();
    return;
  }
  gameState.currentQ++;
  gameState.status = 'question';
  Object.values(gameState.players).forEach(p => { p.answered = false; p.lastCorrect = null; });
  startTimer();
  broadcastState();
}

function checkAllAnswered() {
  const players = Object.values(gameState.players);
  if (players.length > 0 && players.every(p => p.answered)) {
    clearTimeout(gameState.timer);
    revealResults();
  }
}

// ─── WebSocket ───────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  const playerId = uuidv4();
  clients.set(ws, playerId);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      case 'JOIN': {
        const name = (msg.name || 'Joueur').slice(0, 20);
        gameState.players[playerId] = { name, score: 0, answered: false, lastCorrect: null };
        ws.send(JSON.stringify({ type: 'WELCOME', playerId }));
        broadcastState();
        break;
      }

      case 'ANSWER': {
        if (gameState.status !== 'question') break;
        const player = gameState.players[playerId];
        if (!player || player.answered) break;
        player.answered = true;
        const q = gameState.questions[gameState.currentQ];
        const correct = msg.answer === q.answer;
        if (correct) {
          const elapsed = (gameState.timeLimit * 1000 - (gameState.timerEnd - Date.now())) / 1000;
          const bonus = Math.max(10, Math.round(100 * (1 - elapsed / gameState.timeLimit)));
          player.score += bonus;
          player.lastCorrect = true;
        } else {
          player.lastCorrect = false;
        }
        broadcastState();
        checkAllAnswered();
        break;
      }

      case 'ADMIN_SET_QUESTIONS': {
        if (gameState.status !== 'lobby') break;
        gameState.questions = msg.questions;
        gameState.timeLimit = msg.timeLimit || 20;
        // 💾 Sauvegarde immédiate en base
        await saveQuestionsToDB(gameState.questions, gameState.timeLimit);
        broadcastState();
        break;
      }

      case 'ADMIN_START': {
        if (gameState.questions.length === 0) break;
        gameState.currentQ = -1;
        Object.values(gameState.players).forEach(p => { p.score = 0; p.answered = false; });
        nextQuestion();
        break;
      }

      case 'ADMIN_NEXT': {
        if (gameState.status !== 'results') break;
        nextQuestion();
        break;
      }

      case 'ADMIN_RESET': {
        clearTimeout(gameState.timer);
        gameState.status = 'lobby';
        gameState.currentQ = -1;
        gameState.timerEnd = null;
        Object.values(gameState.players).forEach(p => { p.score = 0; p.answered = false; });
        broadcastState();
        break;
      }

      case 'ADMIN_GET_QUESTIONS': {
        // Renvoie les questions complètes (avec bonnes réponses) uniquement à l admin
        ws.send(JSON.stringify({
          type: 'STATE',
          payload: { ...publicState(), loadedQuestions: gameState.questions, timeLimit: gameState.timeLimit }
        }));
        break;
      }

      case 'ADMIN_KICK': {
        delete gameState.players[msg.targetId];
        broadcastState();
        break;
      }
    }
  });

  ws.on('close', () => {
    const id = clients.get(ws);
    clients.delete(ws);
    if (id && gameState.players[id]) {
      delete gameState.players[id];
      broadcastState();
    }
  });

  ws.send(JSON.stringify({ type: 'STATE', payload: publicState() }));
});

// ─── API REST ─────────────────────────────────────────────────────────────────
app.get('/api/status', (_, res) => res.json({
  status: gameState.status,
  players: Object.keys(gameState.players).length,
  questions: gameState.questions.length,
  db: !!pool,
}));

// ─── Fallback SPA ─────────────────────────────────────────────────────────────
app.get('/{*splat}', (_, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));

// ─── Démarrage ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function start() {
  await initDB();
  // Charger les questions sauvegardées au démarrage
  const saved = await loadQuestionsFromDB();
  if (saved && saved.questions.length > 0) {
    gameState.questions = saved.questions;
    gameState.timeLimit = saved.timeLimit;
    console.log(`📦  ${saved.questions.length} question(s) chargée(s) depuis la base`);
  }
  server.listen(PORT, () => console.log(`✅  Serveur Quiz démarré sur http://localhost:${PORT}`));
}

start();
