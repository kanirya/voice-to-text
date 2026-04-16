'use client';

import { useState, useEffect, useRef } from 'react';

// ── Mic Button — circle that morphs to pill ──────────────────────────────────

function MicButton({ isRecording, onClick }: {
  isRecording: boolean;
  onClick: () => void;
}) {
  const [bars, setBars] = useState<number[]>([4, 4, 4, 4, 4]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      analyserRef.current = null;
      setBars([4, 4, 4, 4, 4]);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const animate = () => {
          if (!mounted) return;
          animRef.current = requestAnimationFrame(animate);
          analyser.getByteFrequencyData(data);
          const newBars = [0, 1, 2, 3, 4].map(i => {
            const idx = Math.floor((i / 5) * 20) + 3;
            const v = (data[idx] || 0) / 255;
            return Math.max(4, v * 28 + 4);
          });
          setBars(newBars);
        };
        animate();
      } catch {}
    })();

    return () => { mounted = false; cancelAnimationFrame(animRef.current); };
  }, [isRecording]);

  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center justify-center cursor-pointer
        transition-[width,height,border-radius] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${isRecording
          ? 'w-48 h-14 rounded-full bg-white/[0.08] border border-white/[0.1]'
          : 'w-16 h-16 rounded-full bg-white/[0.1] border border-white/[0.08] hover:bg-white/[0.14] active:scale-95'
        }
      `}
      aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
    >
      {/* Mic icon — visible when idle */}
      <svg
        width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`absolute transition-all duration-500 ${
          isRecording ? 'opacity-0 scale-50' : 'opacity-70 scale-100'
        }`}
      >
        <rect x="9" y="2" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="8" y1="22" x2="16" y2="22" />
      </svg>

      {/* Waveform bars — visible when recording */}
      <div className={`flex items-center gap-[5px] transition-all duration-500 ${
        isRecording ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      }`}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-[3px] bg-white/60 rounded-full transition-[height] duration-100"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>

      {/* Stop icon */}
      <div className={`absolute right-4 w-3.5 h-3.5 bg-white/25 rounded-[3px] transition-all duration-500 ${
        isRecording ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      }`} />
    </button>
  );
}

// ── Clipboard icon ────────────────────────────────────────────────────────────

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function VoiceToTextPage() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsRecording(false);
      setHistory(prev => [text, ...prev].slice(0, 50));
      await copyToClipboard(text);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
        {/* Button */}
        <MicButton isRecording={isRecording} onClick={handleVoiceToggle} />

        {/* Status */}
        <p className={`mt-5 text-[13px] font-medium tracking-wide transition-all duration-500 ${
          isRecording ? 'text-violet-400' : 'text-white/25'
        }`}>
          {isRecording ? 'Listening…' : 'Tap to speak'}
        </p>

        {/* Copied badge */}
        <div className={`mt-2 h-6 transition-all duration-300 ${copied ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-xs text-emerald-400/80 bg-emerald-400/10 px-3 py-1 rounded-full">
            ✓ Copied to clipboard
          </span>
        </div>

        {/* Latest transcript */}
        {transcript && (
          <div className="mt-8 w-full max-w-md">
            <div
              onClick={() => copyToClipboard(transcript)}
              className="group bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] rounded-xl px-5 py-4 cursor-pointer transition-all duration-200"
            >
              <p className="text-[15px] text-white/80 leading-relaxed">{transcript}</p>
              <div className="flex items-center gap-1.5 mt-3 text-white/20 group-hover:text-white/40 transition-colors">
                <ClipboardIcon />
                <span className="text-[11px]">Click to copy</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="px-6 pb-8 pt-4 max-w-md mx-auto w-full">
          <p className="text-[11px] text-white/20 uppercase tracking-widest mb-3">History</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
            {history.slice(1).map((h, i) => (
              <div
                key={i}
                onClick={() => copyToClipboard(h)}
                className="group flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] rounded-lg px-4 py-2.5 cursor-pointer transition-all duration-200"
              >
                <p className="text-sm text-white/40 group-hover:text-white/60 truncate pr-3 transition-colors">{h}</p>
                <ClipboardIcon className="text-white/10 group-hover:text-white/30 shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
