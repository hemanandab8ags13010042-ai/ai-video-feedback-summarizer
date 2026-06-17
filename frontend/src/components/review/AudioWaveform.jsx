import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

export default function AudioWaveform({ audioUrl, isDark }) {
  const containerRef = useRef(null);
  const waveSurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [duration, setDuration] = useState('00:00');

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isDark ? '#334155' : '#E2E8F0', // slate-700 / slate-200
      progressColor: '#8B5CF6', // violet-500
      cursorColor: '#8B5CF6',
      height: 28,
      responsive: true,
      barWidth: 2,
      barGap: 3,
      barRadius: 2,
      url: audioUrl,
    });

    waveSurferRef.current = ws;

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    
    const formatTime = (time) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    ws.on('ready', () => {
      setDuration(formatTime(ws.getDuration()));
    });

    ws.on('audioprocess', () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    ws.on('interaction', () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    return () => {
      ws.destroy();
    };
  }, [audioUrl, isDark]);

  const handlePlayPause = (e) => {
    e.stopPropagation(); // Stop click from bubbling up to comment click seek
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
    }
  };

  return (
    <div className="flex items-center gap-3 w-full bg-slate-500/5 p-2 rounded-lg mt-2 select-none border border-slate-500/10">
      <button
        onClick={handlePlayPause}
        className="w-7 h-7 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center flex-shrink-0 transition-colors shadow"
      >
        {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
      </div>
      <div className="text-[10px] font-mono text-slate-500 font-bold flex-shrink-0 whitespace-nowrap">
        {currentTime} / {duration}
      </div>
    </div>
  );
}
