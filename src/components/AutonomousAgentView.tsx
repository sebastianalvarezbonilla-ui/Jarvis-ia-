import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Gamepad2,
  Globe,
  Layers,
  Loader2,
  Monitor,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import type {
  AppStatus,
  AutonomousStepLog,
  AutonomousTaskType,
  ConnectedAppRecord,
  PublishedAppRecord,
} from '../types/jarvis';

interface AutonomousAgentViewProps {
  connectedApps: ConnectedAppRecord[];
  publishedApps: PublishedAppRecord[];
  onApplyAppStatusChanges: (
    changes: Array<{
      kind: 'connected' | 'published';
      identifier: string;
      status: AppStatus;
    }>
  ) => Promise<void>;
  onRunAutonomousStep: (payload: {
    goal: string;
    taskType: AutonomousTaskType;
    stepIndex: number;
    previousLog: Array<{ action: string; outcome: string }>;
    gameState?: Record<string, unknown>;
    screenImageBase64?: string;
    screenMimeType?: string;
  }) => Promise<{
    action: string;
    observation: string;
    outcome: string;
    move?: string;
    sources?: Array<{ title: string; url: string }>;
    statusChanges?: Array<{
      kind: 'connected' | 'published';
      identifier: string;
      status: AppStatus;
    }>;
    spokenLine?: string;
    companionScript?: string;
    model: string;
    latencyMs: number;
  }>;
  onSpeakText: (text: string) => void;
}

type ArcadeGameId = 'snake' | 'pong' | 'breakout';

export const AutonomousAgentView: React.FC<AutonomousAgentViewProps> = ({
  connectedApps,
  publishedApps,
  onApplyAppStatusChanges,
  onRunAutonomousStep,
  onSpeakText,
}) => {
  const [taskType, setTaskType] = useState<AutonomousTaskType>('play_game');
  const [goal, setGoal] = useState('');
  const [logs, setLogs] = useState<AutonomousStepLog[]>([]);
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>(
    []
  );
  const [companionScript, setCompanionScript] = useState('');
  const [isRunningTask, setIsRunningTask] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Arcade Game Arena state (Spectator + Autonomous AI Player)
  const [gameId, setGameId] = useState<ArcadeGameId>('snake');
  const [isAutoPilot, setIsAutoPilot] = useState(true);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameScore, setGameScore] = useState(0);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // External Reels / Browser Screen Share state for web_workflow
  const [isSharingTab, setIsSharingTab] = useState(false);
  const [autoAssistScreen, setAutoAssistScreen] = useState(false);
  const tabVideoRef = useRef<HTMLVideoElement | null>(null);
  const tabStreamRef = useRef<MediaStream | null>(null);

  // Mutable live game state refs for 60fps/tick stability
  const snakeRef = useRef<{
    body: Array<{ x: number; y: number }>;
    dir: { x: number; y: number };
    food: { x: number; y: number };
  }>({
    body: [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ],
    dir: { x: 1, y: 0 },
    food: { x: 15, y: 10 },
  });

  const pongRef = useRef({
    ballX: 240,
    ballY: 160,
    vx: 3.4,
    vy: 2.6,
    aiY: 130,
    leftY: 130,
  });

  const breakoutRef = useRef({
    ballX: 240,
    ballY: 240,
    vx: 3.2,
    vy: -3.2,
    paddleX: 200,
    bricks: Array.from({ length: 24 }, (_, i) => ({
      x: (i % 6) * 76 + 14,
      y: Math.floor(i / 6) * 24 + 26,
      alive: true,
    })),
  });

  const appendLog = (entry: Omit<AutonomousStepLog, 'id' | 'timestamp'>) => {
    setLogs((prev) => [
      {
        ...entry,
        id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...prev,
    ].slice(0, 30));
  };

  const resetGame = (selected: ArcadeGameId = gameId) => {
    setGameScore(0);
    if (selected === 'snake') {
      snakeRef.current = {
        body: [
          { x: 10, y: 10 },
          { x: 9, y: 10 },
          { x: 8, y: 10 },
        ],
        dir: { x: 1, y: 0 },
        food: { x: 16, y: 8 },
      };
    } else if (selected === 'pong') {
      pongRef.current = {
        ballX: 240,
        ballY: 160,
        vx: 3.6,
        vy: 2.8,
        aiY: 130,
        leftY: 130,
      };
    } else {
      breakoutRef.current = {
        ballX: 240,
        ballY: 230,
        vx: 3.3,
        vy: -3.3,
        paddleX: 200,
        bricks: Array.from({ length: 24 }, (_, i) => ({
          x: (i % 6) * 76 + 14,
          y: Math.floor(i / 6) * 24 + 26,
          alive: true,
        })),
      };
    }
  };

  // Manual keyboard controls when AutoPilot is off
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!gameRunning || isAutoPilot) return;
      if (gameId === 'snake') {
        const d = snakeRef.current.dir;
        if (e.key === 'ArrowUp' && d.y !== 1) snakeRef.current.dir = { x: 0, y: -1 };
        if (e.key === 'ArrowDown' && d.y !== -1) snakeRef.current.dir = { x: 0, y: 1 };
        if (e.key === 'ArrowLeft' && d.x !== 1) snakeRef.current.dir = { x: -1, y: 0 };
        if (e.key === 'ArrowRight' && d.x !== -1) snakeRef.current.dir = { x: 1, y: 0 };
      } else if (gameId === 'pong') {
        if (e.key === 'ArrowUp') pongRef.current.aiY = Math.max(0, pongRef.current.aiY - 22);
        if (e.key === 'ArrowDown') pongRef.current.aiY = Math.min(260, pongRef.current.aiY + 22);
      } else if (gameId === 'breakout') {
        if (e.key === 'ArrowLeft')
          breakoutRef.current.paddleX = Math.max(0, breakoutRef.current.paddleX - 28);
        if (e.key === 'ArrowRight')
          breakoutRef.current.paddleX = Math.min(390, breakoutRef.current.paddleX + 28);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameRunning, isAutoPilot, gameId]);

  // Real Game Loop + Autonomous Tactical Driver
  useEffect(() => {
    if (!gameRunning || taskType !== 'play_game') return;

    const intervalMs = gameId === 'snake' ? 115 : 24;
    const timer = window.setInterval(() => {
      const canvas = gameCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, W, H);

      if (gameId === 'snake') {
        const s = snakeRef.current;
        const head = s.body[0];

        if (isAutoPilot) {
          // Safe shortest-path heuristic avoiding walls and own body
          const candidates = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
          ].filter(
            (c) =>
              !(c.x === -s.dir.x && c.y === -s.dir.y) &&
              head.x + c.x >= 0 &&
              head.x + c.x < 24 &&
              head.y + c.y >= 0 &&
              head.y + c.y < 16 &&
              !s.body.some((seg) => seg.x === head.x + c.x && seg.y === head.y + c.y)
          );
          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              const da =
                Math.abs(head.x + a.x - s.food.x) +
                Math.abs(head.y + a.y - s.food.y);
              const db =
                Math.abs(head.x + b.x - s.food.x) +
                Math.abs(head.y + b.y - s.food.y);
              return da - db;
            });
            s.dir = candidates[0];
          }
        }

        const next = { x: head.x + s.dir.x, y: head.y + s.dir.y };
        if (
          next.x < 0 ||
          next.x >= 24 ||
          next.y < 0 ||
          next.y >= 16 ||
          s.body.some((seg) => seg.x === next.x && seg.y === next.y)
        ) {
          appendLog({
            step: logs.length + 1,
            action: 'Reinicio automático en Serpiente',
            observation: 'Colisión detectada en la arena',
            outcome: 'Nueva partida iniciada por el piloto autónomo.',
            status: 'warning',
          });
          resetGame('snake');
        } else {
          s.body.unshift(next);
          if (next.x === s.food.x && next.y === s.food.y) {
            setGameScore((sc) => sc + 10);
            s.food = {
              x: Math.floor(Math.random() * 24),
              y: Math.floor(Math.random() * 16),
            };
          } else {
            s.body.pop();
          }
        }

        // Draw Snake
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(s.food.x * 20 + 2, s.food.y * 20 + 2, 16, 16);
        s.body.forEach((seg, idx) => {
          ctx.fillStyle = idx === 0 ? '#3B82F6' : '#60A5FA';
          ctx.fillRect(seg.x * 20 + 1, seg.y * 20 + 1, 18, 18);
        });
      } else if (gameId === 'pong') {
        const p = pongRef.current;
        p.ballX += p.vx;
        p.ballY += p.vy;
        if (p.ballY <= 8 || p.ballY >= H - 8) p.vy *= -1;

        // Left wall auto-sparring paddle
        p.leftY += (p.ballY - 30 - p.leftY) * 0.14;
        if (p.ballX <= 24 && p.ballY >= p.leftY && p.ballY <= p.leftY + 60) {
          p.vx = Math.abs(p.vx);
        }

        // Right autonomous agent paddle
        if (isAutoPilot) {
          const targetY = p.ballY - 30;
          if (p.aiY < targetY - 4) p.aiY += 4.2;
          else if (p.aiY > targetY + 4) p.aiY -= 4.2;
        }
        p.aiY = Math.max(0, Math.min(H - 60, p.aiY));

        if (p.ballX >= W - 24 && p.ballY >= p.aiY && p.ballY <= p.aiY + 60) {
          p.vx = -Math.abs(p.vx);
          setGameScore((sc) => sc + 5);
        }

        if (p.ballX < 0 || p.ballX > W) {
          p.ballX = W / 2;
          p.ballY = H / 2;
        }

        ctx.fillStyle = '#334155';
        ctx.fillRect(W / 2 - 1, 0, 2, H);
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(14, p.leftY, 10, 60);
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(W - 24, p.aiY, 10, 60);
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(p.ballX, p.ballY, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const b = breakoutRef.current;
        b.ballX += b.vx;
        b.ballY += b.vy;
        if (b.ballX <= 8 || b.ballX >= W - 8) b.vx *= -1;
        if (b.ballY <= 8) b.vy = Math.abs(b.vy);

        if (isAutoPilot) {
          const targetX = b.ballX - 45;
          if (b.paddleX < targetX - 4) b.paddleX += 5;
          else if (b.paddleX > targetX + 4) b.paddleX -= 5;
          b.paddleX = Math.max(0, Math.min(W - 90, b.paddleX));
        }

        if (
          b.ballY >= H - 28 &&
          b.ballY <= H - 14 &&
          b.ballX >= b.paddleX &&
          b.ballX <= b.paddleX + 90
        ) {
          b.vy = -Math.abs(b.vy);
        }

        for (const br of b.bricks) {
          if (
            br.alive &&
            b.ballX >= br.x &&
            b.ballX <= br.x + 68 &&
            b.ballY >= br.y &&
            b.ballY <= br.y + 16
          ) {
            br.alive = false;
            b.vy *= -1;
            setGameScore((sc) => sc + 15);
          }
        }

        if (b.ballY > H || b.bricks.every((br) => !br.alive)) {
          resetGame('breakout');
        }

        b.bricks.forEach((br) => {
          if (!br.alive) return;
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(br.x, br.y, 68, 16);
        });
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(b.paddleX, H - 22, 90, 10);
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(b.ballX, b.ballY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRunning, taskType, gameId, isAutoPilot]);

  // Periodic Gemini Tactical Commentary while Autonomous Game runs
  const handleAskAgentMoveComment = async () => {
    if (!gameCanvasRef.current) return;
    try {
      const dataUrl = gameCanvasRef.current.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1] || '';
      const res = await onRunAutonomousStep({
        goal: `Jugar ${gameId} con puntuación actual ${gameScore}`,
        taskType: 'play_game',
        stepIndex: logs.length + 1,
        previousLog: logs.slice(0, 4).map((l) => ({
          action: l.action,
          outcome: l.outcome,
        })),
        gameState: {
          gameId,
          score: gameScore,
          isAutoPilot,
        },
        screenImageBase64: base64,
        screenMimeType: 'image/jpeg',
      });
      appendLog({
        step: logs.length + 1,
        action: res.action,
        observation: res.observation,
        outcome: res.outcome,
        status: 'ok',
      });
    } catch {
      // ignore transient tactical commentary skip
    }
  };

  const startTabShareForReels = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setErrorMsg('Tu navegador no admite captura de pantalla compartida.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      tabStreamRef.current = stream;
      if (tabVideoRef.current) {
        tabVideoRef.current.srcObject = stream;
        await tabVideoRef.current.play().catch(() => {});
      }
      stream.getVideoTracks()[0].onended = () => {
        setIsSharingTab(false);
        setAutoAssistScreen(false);
      };
      setIsSharingTab(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Captura cancelada por el usuario.'
      );
    }
  };

  const handleExecuteAutonomousGoal = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isRunningTask) return;
    setErrorMsg(null);
    setIsRunningTask(true);
    setSources([]);
    setCompanionScript('');

    try {
      let screenBase64 = '';
      if (
        taskType === 'web_workflow' &&
        isSharingTab &&
        tabVideoRef.current &&
        tabVideoRef.current.videoWidth > 0
      ) {
        const c = document.createElement('canvas');
        c.width = Math.min(1280, tabVideoRef.current.videoWidth);
        c.height = Math.round(
          tabVideoRef.current.videoHeight * (c.width / tabVideoRef.current.videoWidth)
        );
        c.getContext('2d')?.drawImage(tabVideoRef.current, 0, 0, c.width, c.height);
        screenBase64 = c.toDataURL('image/jpeg', 0.78).split(',')[1] || '';
      }

      const res = await onRunAutonomousStep({
        goal:
          goal.trim() ||
          (taskType === 'google_research'
            ? 'Buscar novedades prácticas sobre IA local y productividad web'
            : taskType === 'manage_apps'
              ? 'Verificar estado de todas mis apps conectadas y optimizarlas'
              : 'Observar el contenido en pantalla y resumir qué está ocurriendo'),
        taskType,
        stepIndex: logs.length + 1,
        previousLog: logs.slice(0, 4).map((l) => ({
          action: l.action,
          outcome: l.outcome,
        })),
        screenImageBase64: screenBase64 || undefined,
        screenMimeType: screenBase64 ? 'image/jpeg' : undefined,
      });

      if (res.statusChanges && res.statusChanges.length > 0) {
        await onApplyAppStatusChanges(res.statusChanges);
      }
      if (res.sources) setSources(res.sources);
      if (res.companionScript) setCompanionScript(res.companionScript);

      appendLog({
        step: logs.length + 1,
        action: res.action,
        observation: res.observation,
        outcome: res.outcome,
        status: 'ok',
      });

      if (res.spokenLine) {
        onSpeakText(res.spokenLine);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo ejecutar el paso autónomo.'
      );
    } finally {
      setIsRunningTask(false);
    }
  };

  useEffect(() => {
    if (!autoAssistScreen || !isSharingTab || taskType !== 'web_workflow') return;
    const t = window.setInterval(() => {
      void handleExecuteAutonomousGoal();
    }, 10000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAssistScreen, isSharingTab, taskType, goal]);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-medium underline shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Agente Autónomo y Arena de Espectador
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ejecuta tareas paso a paso: jugar videojuegos en vivo, investigar en Google, administrar tus apps o asistir Reels y flujos en tu pantalla compartida.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto no-scrollbar">
            {[
              { id: 'play_game' as const, label: 'Videojuegos en vivo' },
              { id: 'google_research' as const, label: 'Buscar en Google' },
              { id: 'manage_apps' as const, label: 'Administrar Apps' },
              { id: 'web_workflow' as const, label: 'Reels / Pantalla externa' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTaskType(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  taskType === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {taskType !== 'play_game' && (
          <form
            onSubmit={(e) => void handleExecuteAutonomousGoal(e)}
            className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
          >
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={
                taskType === 'google_research'
                  ? 'Ej. Busca en Google las mejores prácticas de Wi-Fi 7 y resúmelas con fuentes'
                  : taskType === 'manage_apps'
                    ? 'Ej. Revisa todas mis apps conectadas, verifica cuáles están en línea y pausa las que fallen'
                    : 'Ej. Observa los Reels en mi pantalla compartida y dime un resumen de cada video'
              }
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={isRunningTask}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-45 text-white transition-colors whitespace-nowrap shrink-0"
            >
              {isRunningTask ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Ejecutando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Ejecutar objetivo autónomo</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Main Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Viewport: Game Arena OR External Screen OR Research Summary */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          {taskType === 'play_game' ? (
            <div>
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <select
                    aria-label="Seleccionar videojuego"
                    value={gameId}
                    onChange={(e) => {
                      const next = e.target.value as ArcadeGameId;
                      setGameId(next);
                      resetGame(next);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="snake">Serpiente Clásica</option>
                    <option value="pong">Pong Arcade</option>
                    <option value="breakout">Rompebloques</option>
                  </select>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    Puntos: {gameScore}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAutoPilot((v) => !v)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      isAutoPilot
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isAutoPilot ? 'Piloto IA: Activado' : 'Control Manual (Flechas)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameRunning((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white whitespace-nowrap"
                  >
                    {gameRunning ? (
                      <>
                        <Square className="w-3.5 h-3.5" />
                        <span>Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Iniciar juego</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleAskAgentMoveComment()}
                    disabled={!gameRunning}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap"
                  >
                    Comentar jugada
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950 flex justify-center">
                <canvas
                  ref={gameCanvasRef}
                  width={480}
                  height={320}
                  className="rounded-lg border border-slate-800 bg-slate-950 max-w-full"
                />
              </div>
            </div>
          ) : taskType === 'web_workflow' ? (
            <div>
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Espectador de Reels / Apps Externas
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void startTabShareForReels()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white whitespace-nowrap"
                  >
                    {isSharingTab ? 'Cambiar pestaña compartida' : 'Compartir pestaña (Instagram / Web)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoAssistScreen((v) => !v)}
                    disabled={!isSharingTab}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-45 whitespace-nowrap ${
                      autoAssistScreen
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {autoAssistScreen ? 'Auto-asistencia: Sí (10s)' : 'Auto-asistencia: No'}
                  </button>
                </div>
              </div>

              <div className="aspect-video bg-slate-950 flex items-center justify-center p-4">
                <video
                  ref={tabVideoRef}
                  muted
                  playsInline
                  className={`w-full h-full object-contain ${isSharingTab ? 'block' : 'hidden'}`}
                />
                {!isSharingTab && (
                  <div className="text-center space-y-2 max-w-md">
                    <p className="text-sm font-medium text-slate-200">
                      Asistente autónomo en pantalla compartida
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Por seguridad del navegador, plataformas privadas como Instagram bloquean sesiones automáticas ocultas. Abre tus Reels o app en otra pestaña y compártela aquí: OpenJarvis verá cada pantalla en vivo, narrará lo que ocurre y generará scripts locales para automatizar desplazamientos en tu pestaña.
                    </p>
                  </div>
                )}
              </div>

              {companionScript && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Script auxiliar sugerido para consola local del navegador
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono overflow-x-auto">
                    <code>{companionScript}</code>
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                {taskType === 'google_research' ? (
                  <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {taskType === 'google_research'
                    ? 'Investigación Autónoma en Google'
                    : `Supervisión Autónoma de Apps (${connectedApps.length} conectadas · ${publishedApps.length} publicadas)`}
                </h3>
              </div>

              {logs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Escribe un objetivo arriba y pulsa «Ejecutar objetivo autónomo» para iniciar búsquedas reales en Google, lectura de fuentes o auditoría y control automático sobre tus aplicaciones conectadas y publicadas.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {logs[0].outcome}
                  </div>
                  {sources.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Fuentes verificadas por el agente
                      </div>
                      <ul className="space-y-1">
                        {sources.map((s, idx) => (
                          <li key={idx}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                            >
                              {s.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Autonomous Step-by-Step Timeline */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Registro Autónomo en Vivo
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {logs.length} pasos
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Cada decisión, búsqueda, cambio de estado en apps o jugada autónoma aparecerá registrada aquí en tiempo real.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[440px] overflow-y-auto">
              {logs.map((entry) => (
                <li key={entry.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Paso {entry.step} · {entry.action}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {entry.timestamp}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Observación: {entry.observation}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-4">
                    {entry.outcome}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSpeakText(entry.outcome.slice(0, 260))}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Escuchar resumen</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
