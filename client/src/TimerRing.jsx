import { useState, useEffect } from 'react';

const COLORS = { high: '#4cc9f0', mid: '#ffd60a', low: '#f72585' };

export default function TimerRing({ timerEnd, timeLimit }) {
  const [remaining, setRemaining] = useState(timeLimit);

  useEffect(() => {
    if (!timerEnd) return;
    const tick = () => {
      const r = Math.max(0, (timerEnd - Date.now()) / 1000);
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [timerEnd]);

  const pct = remaining / timeLimit;
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct > 0.5 ? COLORS.high : pct > 0.25 ? COLORS.mid : COLORS.low;
  const secs = Math.ceil(remaining);

  return (
    <div className="timer-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle className="timer-track" cx="40" cy="40" r={r} />
        <circle
          className="timer-fill"
          cx="40" cy="40" r={r}
          style={{
            stroke: color,
            strokeDasharray: circ,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="timer-number" style={{ color }}>{secs}</div>
    </div>
  );
}
