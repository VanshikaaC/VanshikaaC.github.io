import { useState, useEffect, useRef, useCallback } from "react";

const BOARD_SIZE = 500;
const POCKET_RADIUS = 22;
const STRIKER_RADIUS = 18;
const PIECE_RADIUS = 13;
const QUEEN_RADIUS = 14;
const FRICTION = 0.982;
const RESTITUTION = 0.75;
const POCKET_POSITIONS = [
  { x: 44, y: 44 }, { x: BOARD_SIZE - 44, y: 44 },
  { x: 44, y: BOARD_SIZE - 44 }, { x: BOARD_SIZE - 44, y: BOARD_SIZE - 44 }
];

const LESSONS = [
  {
    id: 1, title: "Aim & Shoot", emoji: "🎯",
    desc: "Click and drag on the striker to aim, then release to shoot! Try to hit a piece.",
    hint: "Drag from the striker outward to set direction & power",
    pieces: [{ x: 250, y: 200, color: "#f5f5dc", id: "w1" }],
    goal: "Hit the white piece",
    check: (pocketed) => false,
    goalCheck: (state) => state.hitCount > 0,
  },
  {
    id: 2, title: "Pocket It!", emoji: "🕳️",
    desc: "Aim the piece into a corner pocket to score!",
    hint: "Line up your shot so the piece rolls into a corner",
    pieces: [{ x: 250, y: 170, color: "#f5f5dc", id: "w1" }],
    goal: "Pocket the white piece",
    goalCheck: (state) => state.pocketed.includes("w1"),
  },
  {
    id: 3, title: "The Queen", emoji: "👑",
    desc: "The red queen is the most valuable piece! Pocket it to score big.",
    hint: "Pocket the queen, then cover it with your next piece",
    pieces: [
      { x: 250, y: 160, color: "#ef4444", id: "queen", isQueen: true },
      { x: 250, y: 200, color: "#f5f5dc", id: "w1" },
    ],
    goal: "Pocket the queen",
    goalCheck: (state) => state.pocketed.includes("queen"),
  },
  {
    id: 4, title: "Combo!", emoji: "💥",
    desc: "Knock one piece into another to pocket both at once!",
    hint: "Hit the first piece so it slides into the second",
    pieces: [
      { x: 250, y: 180, color: "#f5f5dc", id: "w1" },
      { x: 250, y: 130, color: "#f5f5dc", id: "w2" },
    ],
    goal: "Pocket 2 pieces in one turn",
    goalCheck: (state) => state.pocketed.length >= 2,
  },
  {
    id: 5, title: "Clear the Board", emoji: "🏆",
    desc: "Pocket ALL pieces to win! Show off your skills.",
    hint: "Plan your shots — clear strategically!",
    pieces: [
      { x: 200, y: 170, color: "#f5f5dc", id: "w1" },
      { x: 300, y: 170, color: "#f5f5dc", id: "w2" },
      { x: 250, y: 200, color: "#1a1a2e", id: "b1" },
      { x: 250, y: 140, color: "#ef4444", id: "queen", isQueen: true },
    ],
    goal: "Pocket all 4 pieces",
    goalCheck: (state) => state.pocketed.length >= 4,
  },
];

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normalize(v) {
  const m = Math.sqrt(v.x ** 2 + v.y ** 2);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
}

export default function CarromGame() {
  const [lesson, setLesson] = useState(0);
  const [gameState, setGameState] = useState(null);
  const [shooting, setShooting] = useState(false);
  const [aimStart, setAimStart] = useState(null);
  const [aimEnd, setAimEnd] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const animRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  const initLesson = useCallback((idx) => {
    const l = LESSONS[idx];
    const state = {
      striker: { x: BOARD_SIZE / 2, y: BOARD_SIZE - 80, vx: 0, vy: 0, moving: false },
      pieces: l.pieces.map(p => ({ ...p, vx: 0, vy: 0, pocketed: false })),
      pocketed: [],
      hitCount: 0,
      turn: "ready",
    };
    setGameState(state);
    stateRef.current = state;
    setCompleted(false);
    setShowCelebration(false);
    setShooting(false);
    setAimStart(null);
    setAimEnd(null);
  }, []);

  useEffect(() => { initLesson(lesson); }, [lesson, initLesson]);

  const shoot = useCallback((power, angle) => {
    if (!stateRef.current) return;
    const speed = Math.min(power * 0.18, 22);
    const s = { ...stateRef.current };
    s.striker.vx = Math.cos(angle) * speed;
    s.striker.vy = Math.sin(angle) * speed;
    s.striker.moving = true;
    s.turn = "shooting";
    stateRef.current = s;
    setGameState({ ...s });
  }, []);

  useEffect(() => {
    if (!gameState || gameState.turn !== "shooting") return;
    const step = () => {
      const s = JSON.parse(JSON.stringify(stateRef.current));
      const { striker, pieces } = s;

      // Move striker
      striker.x += striker.vx;
      striker.y += striker.vy;
      striker.vx *= FRICTION;
      striker.vy *= FRICTION;

      // Board walls
      const R = STRIKER_RADIUS;
      const wall = 36;
      if (striker.x - R < wall) { striker.x = wall + R; striker.vx = Math.abs(striker.vx) * RESTITUTION; }
      if (striker.x + R > BOARD_SIZE - wall) { striker.x = BOARD_SIZE - wall - R; striker.vx = -Math.abs(striker.vx) * RESTITUTION; }
      if (striker.y - R < wall) { striker.y = wall + R; striker.vy = Math.abs(striker.vy) * RESTITUTION; }
      if (striker.y + R > BOARD_SIZE - wall) { striker.y = BOARD_SIZE - wall - R; striker.vy = -Math.abs(striker.vy) * RESTITUTION; }

      // Move pieces
      for (const p of pieces) {
        if (p.pocketed) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        const pw = 36, pr = PIECE_RADIUS;
        if (p.x - pr < pw) { p.x = pw + pr; p.vx = Math.abs(p.vx) * RESTITUTION; }
        if (p.x + pr > BOARD_SIZE - pw) { p.x = BOARD_SIZE - pw - pr; p.vx = -Math.abs(p.vx) * RESTITUTION; }
        if (p.y - pr < pw) { p.y = pw + pr; p.vy = Math.abs(p.vy) * RESTITUTION; }
        if (p.y + pr > BOARD_SIZE - pw) { p.y = BOARD_SIZE - pw - pr; p.vy = -Math.abs(p.vy) * RESTITUTION; }
      }

      // Striker-piece collisions
      for (const p of pieces) {
        if (p.pocketed) continue;
        const d = dist(striker, p);
        const minD = STRIKER_RADIUS + PIECE_RADIUS;
        if (d < minD && d > 0) {
          s.hitCount++;
          const nx = (p.x - striker.x) / d;
          const ny = (p.y - striker.y) / d;
          const dvx = striker.vx - p.vx;
          const dvy = striker.vy - p.vy;
          const imp = (dvx * nx + dvy * ny) * RESTITUTION;
          striker.vx -= imp * nx * 0.5;
          striker.vy -= imp * ny * 0.5;
          p.vx += imp * nx * 0.8;
          p.vy += imp * ny * 0.8;
          const overlap = minD - d;
          striker.x -= nx * overlap * 0.5;
          striker.y -= ny * overlap * 0.5;
          p.x += nx * overlap * 0.5;
          p.y += ny * overlap * 0.5;
        }
      }

      // Piece-piece collisions
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          if (pieces[i].pocketed || pieces[j].pocketed) continue;
          const d = dist(pieces[i], pieces[j]);
          const minD = PIECE_RADIUS * 2;
          if (d < minD && d > 0) {
            const nx = (pieces[j].x - pieces[i].x) / d;
            const ny = (pieces[j].y - pieces[i].y) / d;
            const dvx = pieces[i].vx - pieces[j].vx;
            const dvy = pieces[i].vy - pieces[j].vy;
            const imp = (dvx * nx + dvy * ny) * RESTITUTION;
            pieces[i].vx -= imp * nx * 0.5;
            pieces[i].vy -= imp * ny * 0.5;
            pieces[j].vx += imp * nx * 0.5;
            pieces[j].vy += imp * ny * 0.5;
            const overlap = minD - d;
            pieces[i].x -= nx * overlap * 0.5;
            pieces[i].y -= ny * overlap * 0.5;
            pieces[j].x += nx * overlap * 0.5;
            pieces[j].y += ny * overlap * 0.5;
          }
        }
      }

      // Pocket checks
      for (const p of pieces) {
        if (p.pocketed) continue;
        for (const pocket of POCKET_POSITIONS) {
          if (dist(p, pocket) < POCKET_RADIUS) {
            p.pocketed = true;
            p.vx = 0; p.vy = 0;
            if (!s.pocketed.includes(p.id)) s.pocketed.push(p.id);
          }
        }
      }

      // Striker pocket (foul)
      for (const pocket of POCKET_POSITIONS) {
        if (dist(striker, pocket) < POCKET_RADIUS) {
          striker.x = BOARD_SIZE / 2;
          striker.y = BOARD_SIZE - 80;
          striker.vx = 0; striker.vy = 0;
        }
      }

      // Check if everything stopped
      const allStopped = Math.abs(striker.vx) < 0.15 && Math.abs(striker.vy) < 0.15 &&
        pieces.every(p => p.pocketed || (Math.abs(p.vx) < 0.15 && Math.abs(p.vy) < 0.15));

      if (allStopped) {
        striker.vx = 0; striker.vy = 0;
        striker.moving = false;
        pieces.forEach(p => { if (!p.pocketed) { p.vx = 0; p.vy = 0; } });
        s.turn = "ready";
      }

      stateRef.current = s;
      setGameState({ ...s });

      // Check lesson goal
      const l = LESSONS[lesson];
      if (l.goalCheck(s)) {
        setCompleted(true);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2500);
        return;
      }

      if (allStopped) return;
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState?.turn, lesson]);

  const handleMouseDown = (e) => {
    if (!gameState || gameState.turn !== "ready" || completed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const s = stateRef.current;
    if (dist({ x: mx, y: my }, s.striker) < STRIKER_RADIUS + 12) {
      setShooting(true);
      setAimStart({ x: s.striker.x, y: s.striker.y });
      setAimEnd({ x: mx, y: my });
    }
  };

  const handleMouseMove = (e) => {
    if (!shooting) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setAimEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => {
    if (!shooting || !aimStart || !aimEnd) return;
    setShooting(false);
    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.sqrt(dx ** 2 + dy ** 2);
    if (power > 5) {
      const angle = Math.atan2(dy, dx);
      shoot(power, angle);
    }
    setAimStart(null);
    setAimEnd(null);
  };

  const nextLesson = () => {
    if (lesson < LESSONS.length - 1) {
      setLesson(l => l + 1);
    } else {
      setAllDone(true);
    }
  };

  const currentLesson = LESSONS[lesson];
  const gs = gameState;

  const getAimLine = () => {
    if (!shooting || !aimStart || !aimEnd) return null;
    const dx = aimStart.x - aimEnd.x;
    const dy = aimStart.y - aimEnd.y;
    const power = Math.min(Math.sqrt(dx ** 2 + dy ** 2), 120);
    const angle = Math.atan2(dy, dx);
    return {
      x2: aimStart.x + Math.cos(angle) * power,
      y2: aimStart.y + Math.sin(angle) * power,
      power,
      angle,
    };
  };

  const aimLine = getAimLine();

  if (allDone) {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Georgia', serif", color: "#fff"
      }}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <div style={{ fontSize: 80 }}>🏆</div>
          <h1 style={{ fontSize: 42, color: "#ffd700", margin: "12px 0", textShadow: "0 0 30px #ffd700" }}>
            Carrom Master!
          </h1>
          <p style={{ fontSize: 20, color: "#e8d5b7", maxWidth: 360, margin: "0 auto 28px" }}>
            You've completed all lessons! You're ready for a real game. 🎉
          </p>
          <button onClick={() => { setAllDone(false); setLesson(0); }} style={{
            background: "linear-gradient(135deg, #ffd700, #ff8c00)",
            border: "none", borderRadius: 50, padding: "14px 36px",
            fontSize: 18, fontWeight: "bold", color: "#1a0a2e", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(255,215,0,0.5)"
          }}>
            Play Again ↩
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a0a2e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "16px",
      fontFamily: "'Georgia', serif",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <h1 style={{
          color: "#ffd700", fontSize: 28, margin: 0,
          textShadow: "0 0 20px rgba(255,215,0,0.6)",
          letterSpacing: 2,
        }}>
          🎯 Carrom Academy
        </h1>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
          {LESSONS.map((l, i) => (
            <div key={i} style={{
              width: i === lesson ? 22 : 10, height: 10, borderRadius: 5,
              background: i < lesson ? "#ffd700" : i === lesson ? "#ffd700" : "rgba(255,255,255,0.2)",
              transition: "all 0.3s",
              boxShadow: i === lesson ? "0 0 8px #ffd700" : "none"
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
        {/* Board */}
        <div style={{ position: "relative" }}>
          <svg
            width={BOARD_SIZE} height={BOARD_SIZE}
            style={{
              borderRadius: 12,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), inset 0 0 0 3px rgba(255,215,0,0.3)",
              cursor: shooting ? "crosshair" : "default",
              display: "block",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Board background */}
            <defs>
              <radialGradient id="boardGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#c8a97a" />
                <stop offset="100%" stopColor="#a07840" />
              </radialGradient>
              <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="softShadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
              </filter>
            </defs>

            <rect width={BOARD_SIZE} height={BOARD_SIZE} fill="url(#boardGrad)" rx={12} />
            {/* Wood grain lines */}
            {[...Array(12)].map((_, i) => (
              <line key={i} x1={0} y1={i * 42} x2={BOARD_SIZE} y2={i * 42}
                stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            ))}

            {/* Border frame */}
            <rect x={28} y={28} width={BOARD_SIZE - 56} height={BOARD_SIZE - 56}
              fill="none" stroke="#6b3d00" strokeWidth={8} rx={4} />
            <rect x={34} y={34} width={BOARD_SIZE - 68} height={BOARD_SIZE - 68}
              fill="none" stroke="rgba(255,200,100,0.4)" strokeWidth={1} rx={2} />

            {/* Striker line zones */}
            <line x1={130} y1={BOARD_SIZE - 55} x2={370} y2={BOARD_SIZE - 55}
              stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeDasharray="4,4" />

            {/* Center circle */}
            <circle cx={BOARD_SIZE / 2} cy={BOARD_SIZE / 2} r={55}
              fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} />
            <circle cx={BOARD_SIZE / 2} cy={BOARD_SIZE / 2} r={12}
              fill="rgba(239,68,68,0.4)" stroke="rgba(239,68,68,0.6)" strokeWidth={2} />

            {/* Diagonal lines */}
            <line x1={62} y1={62} x2={BOARD_SIZE / 2 - 40} y2={BOARD_SIZE / 2 - 40}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <line x1={BOARD_SIZE - 62} y1={62} x2={BOARD_SIZE / 2 + 40} y2={BOARD_SIZE / 2 - 40}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <line x1={62} y1={BOARD_SIZE - 62} x2={BOARD_SIZE / 2 - 40} y2={BOARD_SIZE / 2 + 40}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <line x1={BOARD_SIZE - 62} y1={BOARD_SIZE - 62} x2={BOARD_SIZE / 2 + 40} y2={BOARD_SIZE / 2 + 40}
              stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

            {/* Pockets */}
            {POCKET_POSITIONS.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={POCKET_RADIUS}
                  fill="#2a1505" stroke="#4a2810" strokeWidth={2} />
                <circle cx={p.x} cy={p.y} r={POCKET_RADIUS - 4}
                  fill="#1a0a02" />
              </g>
            ))}

            {/* Aim line */}
            {aimLine && (
              <g>
                <line
                  x1={aimStart.x} y1={aimStart.y}
                  x2={aimLine.x2} y2={aimLine.y2}
                  stroke="rgba(255,220,0,0.7)" strokeWidth={2.5}
                  strokeDasharray="6,4"
                />
                <circle cx={aimLine.x2} cy={aimLine.y2} r={5}
                  fill="#ffd700" opacity={0.8} />
                {/* Power indicator */}
                <rect x={aimStart.x - 30} y={aimStart.y - 36} width={60} height={8}
                  rx={4} fill="rgba(0,0,0,0.4)" />
                <rect x={aimStart.x - 30} y={aimStart.y - 36}
                  width={Math.min((aimLine.power / 120) * 60, 60)} height={8}
                  rx={4} fill={`hsl(${120 - (aimLine.power / 120) * 120}, 90%, 55%)`} />
              </g>
            )}

            {/* Pieces */}
            {gs && gs.pieces.map(p => !p.pocketed && (
              <g key={p.id} filter="url(#softShadow)">
                <circle cx={p.x} cy={p.y}
                  r={p.isQueen ? QUEEN_RADIUS : PIECE_RADIUS}
                  fill={p.color}
                  stroke={p.isQueen ? "#ffd700" : p.color === "#1a1a2e" ? "#4444aa" : "#ccc"}
                  strokeWidth={p.isQueen ? 2.5 : 1.5}
                />
                {p.isQueen && (
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={14} fill="#ffd700">♛</text>
                )}
                {!p.isQueen && (
                  <circle cx={p.x} cy={p.y} r={5}
                    fill={p.color === "#1a1a2e" ? "rgba(100,100,200,0.5)" : "rgba(255,255,255,0.4)"} />
                )}
              </g>
            ))}

            {/* Striker */}
            {gs && (
              <g filter="url(#softShadow)">
                <circle cx={gs.striker.x} cy={gs.striker.y} r={STRIKER_RADIUS + 4}
                  fill="rgba(255,215,0,0.15)"
                  stroke="rgba(255,215,0,0.4)" strokeWidth={1.5}
                  strokeDasharray="4,3"
                />
                <circle cx={gs.striker.x} cy={gs.striker.y} r={STRIKER_RADIUS}
                  fill="url(#strikerGrad)"
                  stroke="#ffd700" strokeWidth={2}
                />
                <defs>
                  <radialGradient id="strikerGrad" cx="35%" cy="30%">
                    <stop offset="0%" stopColor="#ffe566" />
                    <stop offset="100%" stopColor="#cc8800" />
                  </radialGradient>
                </defs>
                <circle cx={gs.striker.x - 5} cy={gs.striker.y - 5} r={5}
                  fill="rgba(255,255,255,0.35)" />
              </g>
            )}

            {/* Celebration overlay */}
            {showCelebration && (
              <g>
                <rect width={BOARD_SIZE} height={BOARD_SIZE} fill="rgba(255,215,0,0.1)" rx={12} />
                {[...Array(12)].map((_, i) => (
                  <circle key={i}
                    cx={Math.random() * BOARD_SIZE}
                    cy={Math.random() * BOARD_SIZE}
                    r={6 + Math.random() * 8}
                    fill={["#ffd700", "#ff4466", "#44ffaa", "#4488ff"][i % 4]}
                    opacity={0.7}
                  >
                    <animate attributeName="cy" values={`${Math.random() * 200 + 100};-20`}
                      dur={`${0.8 + Math.random() * 0.8}s`} fill="freeze" />
                    <animate attributeName="opacity" values="0.7;0" dur="1s" fill="freeze" />
                  </circle>
                ))}
              </g>
            )}
          </svg>
        </div>

        {/* Sidebar */}
        <div style={{ width: 200, color: "#fff" }}>
          {/* Lesson Card */}
          <div style={{
            background: "rgba(255,255,255,0.07)",
            borderRadius: 16, padding: "18px",
            border: "1px solid rgba(255,215,0,0.2)",
            backdropFilter: "blur(10px)",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>{currentLesson.emoji}</div>
            <div style={{ fontSize: 11, color: "#ffd700", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
              Lesson {lesson + 1} of {LESSONS.length}
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#fff" }}>{currentLesson.title}</h2>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#c8b89a", lineHeight: 1.5 }}>
              {currentLesson.desc}
            </p>
            <div style={{
              background: "rgba(255,215,0,0.1)", borderRadius: 8, padding: "8px 10px",
              fontSize: 12, color: "#ffd700", borderLeft: "3px solid #ffd700"
            }}>
              💡 {currentLesson.hint}
            </div>
          </div>

          {/* Goal */}
          <div style={{
            background: completed ? "rgba(80,200,120,0.15)" : "rgba(255,255,255,0.05)",
            borderRadius: 12, padding: "12px 14px",
            border: `1px solid ${completed ? "rgba(80,200,120,0.5)" : "rgba(255,255,255,0.1)"}`,
            marginBottom: 14, transition: "all 0.4s"
          }}>
            <div style={{ fontSize: 11, color: completed ? "#80ff9a" : "#aaa", letterSpacing: 1, marginBottom: 4 }}>
              🎯 GOAL
            </div>
            <div style={{ fontSize: 13, color: completed ? "#80ff9a" : "#ddd" }}>
              {completed ? "✅ " : ""}{currentLesson.goal}
            </div>
          </div>

          {/* Score */}
          {gs && gs.pocketed.length > 0 && (
            <div style={{
              background: "rgba(255,215,0,0.1)", borderRadius: 12,
              padding: "10px 14px", border: "1px solid rgba(255,215,0,0.3)",
              marginBottom: 14, fontSize: 13, color: "#ffd700"
            }}>
              🕳️ Pocketed: {gs.pocketed.length} piece{gs.pocketed.length !== 1 ? "s" : ""}
            </div>
          )}

          {/* Buttons */}
          <button onClick={() => initLesson(lesson)} style={{
            width: "100%", background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10,
            padding: "10px", color: "#fff", cursor: "pointer", fontSize: 13,
            marginBottom: 8, transition: "all 0.2s",
          }}
            onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.18)"}
            onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.1)"}
          >
            ↺ Retry
          </button>

          {completed && (
            <button onClick={nextLesson} style={{
              width: "100%",
              background: "linear-gradient(135deg, #ffd700, #ff8c00)",
              border: "none", borderRadius: 10, padding: "12px",
              color: "#1a0a2e", cursor: "pointer", fontSize: 14,
              fontWeight: "bold", boxShadow: "0 4px 16px rgba(255,215,0,0.4)",
              animation: "pulse 1.5s infinite",
            }}>
              {lesson < LESSONS.length - 1 ? "Next Lesson →" : "🏆 Finish!"}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(255,215,0,0.4); }
          50% { transform: scale(1.03); box-shadow: 0 6px 24px rgba(255,215,0,0.7); }
        }
      `}</style>
    </div>
  );
}
