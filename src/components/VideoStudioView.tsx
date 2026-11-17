import React, { useEffect, useRef, useState } from 'react';
import {
  Captions,
  Download,
  Film,
  Loader2,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
  Video,
  Volume2,
} from 'lucide-react';
import type {
  SubtitleCue,
  VideoAspectRatio,
  VideoProjectPlan,
  VideoSubtitleTheme,
  VoiceId,
} from '../types/jarvis';

interface VideoStudioViewProps {
  activeVoice: VoiceId;
  onGenerateVideoPlan: (payload: {
    topic: string;
    style: string;
    aspectRatio: VideoAspectRatio;
    durationSec: number;
    subtitleTheme: VideoSubtitleTheme;
  }) => Promise<VideoProjectPlan>;
  onAutoSubtitles: (payload: {
    audioBase64?: string;
    mimeType?: string;
    scriptText?: string;
    totalDurationSec: number;
  }) => Promise<{ transcript: string; subtitles: SubtitleCue[] }>;
  onSynthesizeVoiceover: (
    text: string,
    voiceName: VoiceId
  ) => Promise<{ audioBase64: string; mimeType: string }>;
}

function formatSrtTime(sec: number): string {
  const s = Math.max(0, sec);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

function formatVttTime(sec: number): string {
  return formatSrtTime(sec).replace(',', '.');
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const VideoStudioView: React.FC<VideoStudioViewProps> = ({
  activeVoice,
  onGenerateVideoPlan,
  onAutoSubtitles,
  onSynthesizeVoiceover,
}) => {
  const [topic, setTopic] = useState('');
  const [videoStyle, setVideoStyle] = useState<
    'editorial' | 'documentary' | 'product_launch' | 'social_vertical'
  >('editorial');
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('16:9');
  const [durationSec, setDurationSec] = useState<number>(18);
  const [subtitleTheme, setSubtitleTheme] =
    useState<VideoSubtitleTheme>('cinematic_bottom');
  const [voiceForVideo, setVoiceForVideo] = useState<VoiceId>(activeVoice);

  const [plan, setPlan] = useState<VideoProjectPlan | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>([]);
  const [narrationScript, setNarrationScript] = useState('');
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);

  // Uploaded local video or image backdrop support
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const uploadedVideoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlanning, setIsPlanning] = useState(false);
  const [isSynthesizingAudio, setIsSynthesizingAudio] = useState(false);
  const [isSubtitling, setIsSubtitling] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartMsRef = useRef<number>(0);

  const totalDuration = uploadedVideoUrl && uploadedVideoRef.current?.duration
    ? uploadedVideoRef.current.duration
    : plan?.scenes.reduce((acc, s) => acc + (Number(s.durationSec) || 4), 0) ||
      durationSec;

  const dimensions =
    aspectRatio === '9:16'
      ? { w: 720, h: 1280 }
      : aspectRatio === '1:1'
        ? { w: 960, h: 960 }
        : { w: 1280, h: 720 };

  const drawFrameAt = (tSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);

    // 1. Background layer (Uploaded video OR dynamic editorial scene canvas)
    const vidEl = uploadedVideoRef.current;
    if (uploadedVideoUrl && vidEl && vidEl.readyState >= 2) {
      const vRatio = vidEl.videoWidth / Math.max(1, vidEl.videoHeight);
      const cRatio = w / h;
      let drawW = w;
      let drawH = h;
      let dx = 0;
      let dy = 0;
      if (vRatio > cRatio) {
        drawW = h * vRatio;
        dx = (w - drawW) / 2;
      } else {
        drawH = w / vRatio;
        dy = (h - drawH) / 2;
      }
      ctx.drawImage(vidEl, dx, dy, drawW, drawH);
      // Subtle contrast vignette for legible subtitles
      const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.68)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      const bgHex = plan?.palette.bgHex || '#0F172A';
      const accentHex = plan?.palette.accentHex || '#2563EB';
      const textHex = plan?.palette.textHex || '#F8FAFC';

      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, w, h);

      // Subtle architectural grid lines & slow pan motion
      const scenes = plan?.scenes || [];
      let accum = 0;
      let activeScene = scenes[0];
      let sceneProgress = 0;
      for (const sc of scenes) {
        const dur = Math.max(1, Number(sc.durationSec) || 4);
        if (tSec >= accum && tSec <= accum + dur) {
          activeScene = sc;
          sceneProgress = (tSec - accum) / dur;
          break;
        }
        accum += dur;
      }
      if (!activeScene && scenes.length > 0) {
        activeScene = scenes[scenes.length - 1];
        sceneProgress = 1;
      }

      // Subtle ambient radial glow
      const glowX =
        activeScene?.motionType === 'pan_left'
          ? w * (0.7 - sceneProgress * 0.3)
          : activeScene?.motionType === 'pan_right'
            ? w * (0.3 + sceneProgress * 0.3)
            : w * 0.5;
      const rad = ctx.createRadialGradient(glowX, h * 0.38, 40, glowX, h * 0.38, w * 0.65);
      rad.addColorStop(0, `${accentHex}33`);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, w, h);

      // Fine architectural grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Scene typography with smooth zoom settle
      const zoomScale =
        activeScene?.motionType === 'zoom_in'
          ? 1 + sceneProgress * 0.04
          : 1;
      ctx.save();
      ctx.translate(w / 2, h * 0.42);
      ctx.scale(zoomScale, zoomScale);

      // Top accent rule
      ctx.fillStyle = accentHex;
      ctx.fillRect(-48, -110, 96, 4);

      // Headline
      ctx.fillStyle = textHex;
      const headSize = aspectRatio === '9:16' ? 46 : 54;
      ctx.font = `700 ${headSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const headLines = wrapCanvasLines(
        ctx,
        activeScene?.headline || plan?.title || 'Estudio de Video OpenJarvis',
        w * 0.78
      );
      headLines.slice(0, 3).forEach((line, idx) => {
        ctx.fillText(line, 0, -40 + idx * (headSize * 1.18));
      });

      // Secondary captionText
      if (activeScene?.captionText) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
        const subSize = aspectRatio === '9:16' ? 24 : 26;
        ctx.font = `400 ${subSize}px "DM Sans", sans-serif`;
        const subLines = wrapCanvasLines(ctx, activeScene.captionText, w * 0.72);
        subLines.slice(0, 2).forEach((line, idx) => {
          ctx.fillText(
            line,
            0,
            headLines.length * (headSize * 0.65) + 34 + idx * (subSize * 1.3)
          );
        });
      }
      ctx.restore();
    }

    // 2. Burned-in Subtitles Layer
    const activeCue = subtitles.find(
      (c) => tSec >= c.startSec && tSec <= c.endSec
    );
    if (activeCue && activeCue.text.trim()) {
      const fontSize =
        subtitleTheme === 'viral_bold'
          ? aspectRatio === '9:16'
            ? 38
            : 40
          : aspectRatio === '9:16'
            ? 30
            : 32;
      ctx.font = `${subtitleTheme === 'viral_bold' ? '700' : '600'} ${fontSize}px "DM Sans", sans-serif`;
      const lines = wrapCanvasLines(ctx, activeCue.text, w * 0.8);
      const lineHeight = fontSize * 1.32;
      const boxHeight = lines.length * lineHeight + 24;
      const yBase =
        subtitleTheme === 'viral_bold' ? h * 0.76 : h * 0.85;
      const maxLineW = Math.max(
        ...lines.map((l) => ctx.measureText(l).width),
        120
      );

      if (subtitleTheme !== 'viral_bold') {
        ctx.fillStyle =
          subtitleTheme === 'editorial_card'
            ? 'rgba(15, 23, 42, 0.92)'
            : 'rgba(0, 0, 0, 0.72)';
        const boxW = Math.min(w * 0.88, maxLineW + 44);
        const rx = (w - boxW) / 2;
        const ry = yBase - boxHeight / 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, boxW, boxHeight, 10);
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, idx) => {
        const ly =
          yBase - ((lines.length - 1) * lineHeight) / 2 + idx * lineHeight;
        if (subtitleTheme === 'viral_bold') {
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
          ctx.strokeText(line, w / 2, ly);
          ctx.fillStyle = '#FACC15';
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.fillText(line, w / 2, ly);
      });
    }

    // 3. Subtle timeline bar at bottom edge
    const pct = Math.min(1, Math.max(0, tSec / Math.max(1, totalDuration)));
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, h - 4, w, 4);
    ctx.fillStyle = plan?.palette.accentHex || '#2563EB';
    ctx.fillRect(0, h - 4, w * pct, 4);
  };

  useEffect(() => {
    drawFrameAt(currentTimeSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plan,
    subtitles,
    aspectRatio,
    subtitleTheme,
    currentTimeSec,
    uploadedVideoUrl,
  ]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
      if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlanVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isPlanning) return;
    setErrorMsg(null);
    setExportedVideoUrl(null);
    setIsPlanning(true);
    try {
      const result = await onGenerateVideoPlan({
        topic: topic.trim(),
        style: videoStyle,
        aspectRatio,
        durationSec,
        subtitleTheme,
      });
      setPlan(result);
      setSubtitles(result.subtitles || []);
      setNarrationScript(result.narrationScript || '');
      setCurrentTimeSec(0);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo generar el plan de video.'
      );
    } finally {
      setIsPlanning(false);
    }
  };

  const handleGenerateVoiceover = async () => {
    if (!narrationScript.trim() || isSynthesizingAudio) return;
    setErrorMsg(null);
    setIsSynthesizingAudio(true);
    try {
      const res = await onSynthesizeVoiceover(
        narrationScript.trim(),
        voiceForVideo
      );
      const bin = atob(res.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      if (voiceAudioUrl) URL.revokeObjectURL(voiceAudioUrl);
      setVoiceAudioUrl(url);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo generar la locución neuronal.'
      );
    } finally {
      setIsSynthesizingAudio(false);
    }
  };

  const handleUploadLocalVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    const url = URL.createObjectURL(file);
    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    setUploadedVideoUrl(url);
    setUploadedFileName(file.name);
    setCurrentTimeSec(0);
  };

  const handleAutoSyncSubtitlesFromScript = async () => {
    if (!narrationScript.trim() || isSubtitling) return;
    setErrorMsg(null);
    setIsSubtitling(true);
    try {
      const res = await onAutoSubtitles({
        scriptText: narrationScript.trim(),
        totalDurationSec: totalDuration,
      });
      setSubtitles(res.subtitles);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron sincronizar los subtítulos.'
      );
    } finally {
      setIsSubtitling(false);
    }
  };

  const startPlayback = () => {
    if (isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      voiceAudioRef.current?.pause();
      uploadedVideoRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const startOffset =
      currentTimeSec >= totalDuration - 0.1 ? 0 : currentTimeSec;
    playStartMsRef.current = performance.now() - startOffset * 1000;

    if (voiceAudioRef.current && voiceAudioUrl) {
      voiceAudioRef.current.currentTime = startOffset;
      void voiceAudioRef.current.play().catch(() => {});
    }
    if (uploadedVideoRef.current && uploadedVideoUrl) {
      uploadedVideoRef.current.currentTime = startOffset;
      void uploadedVideoRef.current.play().catch(() => {});
    }

    const tick = () => {
      const elapsed = (performance.now() - playStartMsRef.current) / 1000;
      if (elapsed >= totalDuration) {
        setCurrentTimeSec(totalDuration);
        drawFrameAt(totalDuration);
        voiceAudioRef.current?.pause();
        uploadedVideoRef.current?.pause();
        setIsPlaying(false);
        return;
      }
      setCurrentTimeSec(elapsed);
      drawFrameAt(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleExportWebm = async () => {
    if (!canvasRef.current || isExporting) return;
    setErrorMsg(null);
    setIsExporting(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);

    try {
      const canvas = canvasRef.current;
      const stream = canvas.captureStream(30);

      // Mix audio stream if voiceover or uploaded video has audio
      let audioCtx: AudioContext | null = null;
      const audioDest = (() => {
        if (!voiceAudioUrl) return null;
        audioCtx = new AudioContext();
        return audioCtx.createMediaStreamDestination();
      })();

      if (audioCtx && audioDest && voiceAudioRef.current && voiceAudioUrl) {
        const audioEl = new Audio(voiceAudioUrl);
        audioEl.crossOrigin = 'anonymous';
        const srcNode = audioCtx.createMediaElementSource(audioEl);
        srcNode.connect(audioDest);
        srcNode.connect(audioCtx.destination);
        audioDest.stream
          .getAudioTracks()
          .forEach((t) => stream.addTrack(t));
        void audioEl.play().catch(() => {});
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3_500_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const exportDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      if (uploadedVideoRef.current && uploadedVideoUrl) {
        uploadedVideoRef.current.currentTime = 0;
        void uploadedVideoRef.current.play().catch(() => {});
      }

      recorder.start();
      const recStart = performance.now();

      await new Promise<void>((resolve) => {
        const renderStep = () => {
          const elapsed = (performance.now() - recStart) / 1000;
          setCurrentTimeSec(elapsed);
          drawFrameAt(elapsed);
          if (elapsed >= totalDuration) {
            resolve();
            return;
          }
          requestAnimationFrame(renderStep);
        };
        requestAnimationFrame(renderStep);
      });

      recorder.stop();
      uploadedVideoRef.current?.pause();
      if (audioCtx) void audioCtx.close().catch(() => {});

      const blob = await exportDone;
      const url = URL.createObjectURL(blob);
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
      setExportedVideoUrl(url);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo renderizar el archivo de video WebM.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSubtitles = (format: 'srt' | 'vtt') => {
    if (subtitles.length === 0) return;
    const content =
      format === 'srt'
        ? subtitles
            .map(
              (c, i) =>
                `${i + 1}\n${formatSrtTime(c.startSec)} --> ${formatSrtTime(c.endSec)}\n${c.text}\n`
            )
            .join('\n')
        : `WEBVTT\n\n` +
          subtitles
            .map(
              (c, i) =>
                `${i + 1}\n${formatVttTime(c.startSec)} --> ${formatVttTime(c.endSec)}\n${c.text}\n`
            )
            .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitulos-openjarvis.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

      {/* Hidden video/audio elements for compositing */}
      {uploadedVideoUrl && (
        <video
          ref={uploadedVideoRef}
          src={uploadedVideoUrl}
          muted
          playsInline
          className="hidden"
        />
      )}
      {voiceAudioUrl && (
        <audio ref={voiceAudioRef} src={voiceAudioUrl} className="hidden" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Production Form & Subtitles Editor */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={(e) => void handlePlanVideo(e)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Dirección de Video y Guión
              </h2>
            </div>

            <div>
              <label
                htmlFor="video-topic-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Tema o guión del video
              </label>
              <textarea
                id="video-topic-input"
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ej. Lanzamiento de un reloj minimalista de titanio con enfoque en diseño suizo y autonomía de 14 días..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="video-style-select"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Estilo visual
                </label>
                <select
                  id="video-style-select"
                  value={videoStyle}
                  onChange={(e) =>
                    setVideoStyle(e.target.value as typeof videoStyle)
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="editorial">Editorial Sobrio</option>
                  <option value="documentary">Documental</option>
                  <option value="product_launch">Lanzamiento Producto</option>
                  <option value="social_vertical">Reels / Shorts</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="video-aspect-select"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Formato
                </label>
                <select
                  id="video-aspect-select"
                  value={aspectRatio}
                  onChange={(e) =>
                    setAspectRatio(e.target.value as VideoAspectRatio)
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="16:9">16:9 Panorámico</option>
                  <option value="9:16">9:16 Vertical Reels</option>
                  <option value="1:1">1:1 Cuadrado</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="video-duration-select"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Duración
                </label>
                <select
                  id="video-duration-select"
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value={12}>12 segundos</option>
                  <option value={18}>18 segundos</option>
                  <option value={24}>24 segundos</option>
                  <option value={30}>30 segundos</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="video-sub-theme"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Estilo de subtítulos
                </label>
                <select
                  id="video-sub-theme"
                  value={subtitleTheme}
                  onChange={(e) =>
                    setSubtitleTheme(e.target.value as VideoSubtitleTheme)
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="cinematic_bottom">Cinematográfico</option>
                  <option value="viral_bold">Impacto Reels (Amarillo)</option>
                  <option value="editorial_card">Editorial Oscuro</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={!topic.trim() || isPlanning}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 text-white transition-colors whitespace-nowrap"
              >
                {isPlanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creando guión y escenas...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    <span>Generar video y subtítulos</span>
                  </>
                )}
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir clip</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleUploadLocalVideo}
                  className="hidden"
                />
              </label>
            </div>

            {uploadedFileName && (
              <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300 truncate">
                Clip cargado: {uploadedFileName}
              </div>
            )}
          </form>

          {/* Voiceover & Narration Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="video-narration-script"
                className="text-xs font-semibold text-slate-900 dark:text-white"
              >
                Guión de locución neuronal
              </label>
              <select
                aria-label="Voz para locución"
                value={voiceForVideo}
                onChange={(e) => setVoiceForVideo(e.target.value as VoiceId)}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
              >
                <option value="Charon">Charon</option>
                <option value="Kore">Kore</option>
                <option value="Zephyr">Zephyr</option>
                <option value="Puck">Puck</option>
                <option value="Fenrir">Fenrir</option>
              </select>
            </div>

            <textarea
              id="video-narration-script"
              rows={3}
              value={narrationScript}
              onChange={(e) => setNarrationScript(e.target.value)}
              placeholder="Escribe o genera el texto que leerá la voz en off..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleGenerateVoiceover()}
                disabled={!narrationScript.trim() || isSynthesizingAudio}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap"
              >
                {isSynthesizingAudio ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>Generar voz en off</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAutoSyncSubtitlesFromScript()}
                disabled={!narrationScript.trim() || isSubtitling}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap"
              >
                <Captions className="w-3.5 h-3.5 text-blue-600" />
                <span>Sincronizar subtítulos</span>
              </button>
            </div>
          </div>

          {/* Interactive Subtitles Timeline Editor */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Captions className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Subtítulos sincronizados ({subtitles.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const lastEnd =
                    subtitles.length > 0
                      ? subtitles[subtitles.length - 1].endSec
                      : 0;
                  setSubtitles((prev) => [
                    ...prev,
                    {
                      index: prev.length + 1,
                      startSec: Number(lastEnd.toFixed(1)),
                      endSec: Number((lastEnd + 3).toFixed(1)),
                      text: 'Nuevo subtítulo',
                    },
                  ]);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir línea</span>
              </button>
            </div>

            {subtitles.length === 0 ? (
              <div className="p-5 text-xs text-slate-500 dark:text-slate-400">
                Genera un plan de video o añade líneas manualmente para quemarlas en el video y exportar .SRT / .VTT.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[260px] overflow-y-auto">
                {subtitles.map((cue, idx) => (
                  <li key={idx} className="p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        aria-label={`Inicio subtítulo ${idx + 1}`}
                        value={cue.startSec}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSubtitles((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, startSec: val } : item
                            )
                          );
                        }}
                        className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono tabular-nums"
                      />
                      <span className="text-xs text-slate-400">→</span>
                      <input
                        type="number"
                        step="0.5"
                        aria-label={`Fin subtítulo ${idx + 1}`}
                        value={cue.endSec}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSubtitles((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, endSec: val } : item
                            )
                          );
                        }}
                        className="w-16 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSubtitles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label="Eliminar subtítulo"
                        className="ml-auto p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={cue.text}
                      onChange={(e) => {
                        const txt = e.target.value;
                        setSubtitles((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, text: txt } : item
                          )
                        );
                      }}
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Real-Time Canvas Video Monitor & Exporters */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {plan?.title || 'Monitor de Composición y Subtítulos'}
              </h3>
              <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {currentTimeSec.toFixed(1)}s / {totalDuration.toFixed(1)}s · {aspectRatio}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={startPlayback}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 whitespace-nowrap"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Reproducir</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleExportWebm()}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Renderizando WebM...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Renderizar Video (.webm)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSubtitles('srt')}
                disabled={subtitles.length === 0}
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45"
              >
                .SRT
              </button>
              <button
                type="button"
                onClick={() => handleDownloadSubtitles('vtt')}
                disabled={subtitles.length === 0}
                className="px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45"
              >
                .VTT
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950 flex items-center justify-center min-h-[420px]">
            <canvas
              ref={canvasRef}
              width={dimensions.w}
              height={dimensions.h}
              className="max-w-full max-h-[460px] rounded-lg border border-slate-800 object-contain"
            />
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <input
              type="range"
              aria-label="Posición de tiempo del video"
              min={0}
              max={totalDuration}
              step={0.1}
              value={currentTimeSec}
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrentTimeSec(t);
                if (uploadedVideoRef.current && uploadedVideoUrl) {
                  uploadedVideoRef.current.currentTime = t;
                }
              }}
              className="flex-1 accent-blue-600"
            />
            {exportedVideoUrl && (
              <a
                href={exportedVideoUrl}
                download="video-openjarvis-subtitulado.webm"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .WebM listo</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
