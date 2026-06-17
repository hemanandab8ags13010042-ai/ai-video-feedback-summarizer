import React, { useRef, useEffect } from 'react';
import { useReviewStore } from '../../store/useReviewStore';
import { 
  Play, Pause, Volume2, Maximize, Clock 
} from 'lucide-react';

export default function VideoPlayerSection({
  versionId,
  isDark,
  BASE_URL,
  videoRef,
  compareVideoRef,
  canvasRef,
  playerContainerRef,
  socketRef
}) {
  const store = useReviewStore();
  const isDrawing = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  // Playback sync when comparing cuts
  useEffect(() => {
    if (store.isComparing && compareVideoRef.current && videoRef.current) {
      compareVideoRef.current.playbackRate = videoRef.current.playbackRate;
      
      if (store.isPlaying) {
        compareVideoRef.current.play().catch(() => {});
      } else {
        compareVideoRef.current.pause();
      }

      compareVideoRef.current.currentTime = videoRef.current.currentTime;
    }
  }, [store.isPlaying, store.isComparing, store.playbackSpeed, store.compareVersionId]);

  // Canvas Resize Redraws
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
      store.setIsFullscreen(!!document.fullscreenElement);
      store.incrementResizeKey();
    };

    handleResize();
    const timer = setTimeout(handleResize, 100);

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [
    store.loading, 
    store.isDrawingMode, 
    store.videoAspectRatio, 
    store.fitMode, 
    store.isComparing, 
    store.compareVersion, 
    store.compareVersionId
  ]);

  // Redraw annotations based on playhead time
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const getCoord = (val, scale) => {
      if (val === undefined || val === null) return 0;
      return Math.abs(val) <= 1 ? val * scale : val;
    };

    if (store.isDrawingMode || store.drawHistory.length > 0) {
      if (store.drawHistory.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        redrawCanvasHistory();
      }
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    store.comments.forEach(comment => {
      if (!comment.draw_data || comment.draw_data.length === 0) return;
      
      const timeDiff = store.currentTime - comment.timestamp_seconds;
      if (timeDiff >= 0 && timeDiff <= 2.0) {
        const w = canvas.width;
        const h = canvas.height;
        comment.draw_data.forEach(item => {
          ctx.strokeStyle = item.color || '#EF4444';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          
          const x1 = getCoord(item.x1, w);
          const y1 = getCoord(item.y1, h);
          const x2 = getCoord(item.x2, w);
          const y2 = getCoord(item.y2, h);
          const x = getCoord(item.x, w);
          const y = getCoord(item.y, h);
          const radius = getCoord(item.radius, w);

          if (item.type === 'free') {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          } else if (item.type === 'circle') {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.stroke();
          } else if (item.type === 'arrow') {
            drawArrow(ctx, x1, y1, x2, y2);
          }
        });
      }
    });
  }, [store.currentTime, store.comments, store.isDrawingMode, store.drawHistory, store.resizeKey]);

  // Video Control Handlers
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      store.setIsPlaying(true);
      store.setIsDrawingMode(false);
      store.clearDrawHistory();
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (store.isComparing && compareVideoRef.current) {
        compareVideoRef.current.play().catch(() => {});
      }
    } else {
      videoRef.current.pause();
      store.setIsPlaying(false);
      if (store.isComparing && compareVideoRef.current) {
        compareVideoRef.current.pause();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      store.setCurrentTime(curr);
      
      if (store.isComparing && compareVideoRef.current) {
        const diff = Math.abs(curr - compareVideoRef.current.currentTime);
        if (diff > 0.35) {
          compareVideoRef.current.currentTime = curr;
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      store.setDuration(videoRef.current.duration);
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      if (width && height) {
        store.setVideoAspectRatio(`${width}/${height}`);
      }
    }
  };

  const handleScrubChange = (e) => {
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    store.setCurrentTime(time);
    if (store.isComparing && compareVideoRef.current) {
      compareVideoRef.current.currentTime = time;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    store.clearDrawHistory();
  };

  const handleSpeedChange = (speed) => {
    videoRef.current.playbackRate = speed;
    store.setPlaybackSpeed(speed);
    if (store.isComparing && compareVideoRef.current) {
      compareVideoRef.current.playbackRate = speed;
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    store.setVolume(vol);
  };

  const handleFullscreen = () => {
    if (playerContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        playerContainerRef.current.requestFullscreen().catch(err => {
          console.error("Failed to enter fullscreen mode:", err);
        });
      }
    }
  };

  // Drawing Canvas Core Handlers
  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!store.isDrawingMode) return;
    isDrawing.current = true;
    const pos = getCanvasMousePos(e);
    startX.current = pos.x;
    startY.current = pos.y;
    
    if (store.isPlaying) {
      videoRef.current.pause();
      store.setIsPlaying(false);
      if (store.isComparing && compareVideoRef.current) {
        compareVideoRef.current.pause();
      }
    }
  };

  const draw = (e) => {
    if (!isDrawing.current || !store.isDrawingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasMousePos(e);

    ctx.strokeStyle = store.drawingColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (store.drawingTool === 'free') {
      ctx.beginPath();
      ctx.moveTo(startX.current, startY.current);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      const stroke = {
        type: 'free',
        color: store.drawingColor,
        x1: startX.current / canvas.width,
        y1: startY.current / canvas.height,
        x2: pos.x / canvas.width,
        y2: pos.y / canvas.height
      };

      if (socketRef.current) {
        socketRef.current.emit('draw-stroke', {
          versionId,
          stroke
        });
      }

      store.setDrawHistory([...store.drawHistory, stroke]);

      startX.current = pos.x;
      startY.current = pos.y;
    } 
    
    else if (store.drawingTool === 'circle') {
      redrawCanvasHistory();
      ctx.beginPath();
      const radius = Math.sqrt(Math.pow(pos.x - startX.current, 2) + Math.pow(pos.y - startY.current, 2));
      ctx.arc(startX.current, startY.current, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    else if (store.drawingTool === 'arrow') {
      redrawCanvasHistory();
      drawArrow(ctx, startX.current, startY.current, pos.x, pos.y);
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing.current || !store.isDrawingMode) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasMousePos(e);

    if (store.drawingTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - startX.current, 2) + Math.pow(pos.y - startY.current, 2));
      const stroke = {
        type: 'circle',
        color: store.drawingColor,
        x: startX.current / canvas.width,
        y: startY.current / canvas.height,
        radius: radius / canvas.width
      };
      if (socketRef.current) {
        socketRef.current.emit('draw-stroke', {
          versionId,
          stroke
        });
      }
      store.setDrawHistory([...store.drawHistory, stroke]);
    } 
    
    else if (store.drawingTool === 'arrow') {
      const stroke = {
        type: 'arrow',
        color: store.drawingColor,
        x1: startX.current / canvas.width,
        y1: startY.current / canvas.height,
        x2: pos.x / canvas.width,
        y2: pos.y / canvas.height
      };
      if (socketRef.current) {
        socketRef.current.emit('draw-stroke', {
          versionId,
          stroke
        });
      }
      store.setDrawHistory([...store.drawHistory, stroke]);
    }
  };

  const handlePlayerMouseMove = (e) => {
    if (!socketRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    socketRef.current.emit('cursor-move', {
      versionId,
      x,
      y,
      userName: store.version?.commenter_name || 'Anonymous',
      color: store.drawingColor || '#EF4444'
    });
  };

  const handlePlayerMouseLeave = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('cursor-move', {
      versionId,
      leave: true
    });
  };

  // Helper Drawing Functions
  const drawArrow = (ctx, fromX, fromY, toX, toY) => {
    const headlen = 12;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(toX);
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const redrawCanvasHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    
    const getCoord = (val, scale) => {
      if (val === undefined || val === null) return 0;
      return Math.abs(val) <= 1 ? val * scale : val;
    };

    store.drawHistory.forEach(item => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      
      const x1 = getCoord(item.x1, w);
      const y1 = getCoord(item.y1, h);
      const x2 = getCoord(item.x2, w);
      const y2 = getCoord(item.y2, h);
      const x = getCoord(item.x, w);
      const y = getCoord(item.y, h);
      const radius = getCoord(item.radius, w);
      
      if (item.type === 'free') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (item.type === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (item.type === 'arrow') {
        drawArrow(ctx, x1, y1, x2, y2);
      }
    });
  };

  const getCombinedAspectRatio = () => {
    if (store.isComparing && store.compareVersion) {
      if (!store.videoAspectRatio) return '32/9';
      const parts = store.videoAspectRatio.split('/');
      if (parts.length === 2) {
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (!isNaN(w) && !isNaN(h) && h !== 0) {
          return `${w * 2}/${h}`;
        }
      }
      return '32/9';
    }
    return store.videoAspectRatio || '16/9';
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={playerContainerRef}
      className={`relative group/player flex flex-col w-full h-full ${
        store.isFullscreen ? 'rounded-none border-0' : 'rounded-xl border'
      } ${
        isDark ? 'bg-black border-slate-850' : 'bg-slate-900 border-slate-200 shadow-lg'
      }`}
    >
      
      {/* Video Viewports Container */}
      <div 
        className={`relative w-full overflow-hidden flex items-center justify-center bg-black ${
          store.isFullscreen ? 'flex-1 h-0' : ''
        }`}
        style={{ 
          aspectRatio: store.isFullscreen ? 'auto' : getCombinedAspectRatio(),
          maxHeight: store.isFullscreen ? 'none' : '65vh'
        }}
      >
        <div className={`w-full h-full grid ${store.isComparing && store.compareVersion ? 'grid-cols-2 gap-1 bg-slate-950' : 'grid-cols-1'}`}>
          
          {/* Main Video Cut Player */}
          <div 
            className="relative w-full h-full flex items-center justify-center"
            onMouseMove={handlePlayerMouseMove}
            onMouseLeave={handlePlayerMouseLeave}
          >
            <video
              ref={videoRef}
              src={store.version?.file_url.startsWith('http') ? store.version.file_url : `${BASE_URL}${store.version?.file_url}`}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={handlePlayPause}
              className={`w-full h-full cursor-pointer ${
                store.fitMode === 'cover' ? 'object-cover' : store.fitMode === 'fill' ? 'object-fill' : 'object-contain'
              }`}
            />

            {/* Drawing Canvas Annotation HUD overlay */}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className={`absolute inset-0 w-full h-full ${
                store.isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
              }`}
            />

            {/* Collaborator Mouse Tracking Cursors */}
            {Object.entries(store.collaborators).map(([socketId, collaborator]) => {
              if (collaborator.leave) return null;
              return (
                <div
                  key={socketId}
                  className="absolute pointer-events-none z-50 transition-all duration-75 ease-out"
                  style={{
                    left: `${collaborator.x * 100}%`,
                    top: `${collaborator.y * 100}%`,
                    transform: 'translate(-4px, -4px)'
                  }}
                >
                  <svg
                    className="w-5 h-5 drop-shadow-md"
                    viewBox="0 0 24 24"
                    fill={collaborator.color || '#EF4444'}
                    stroke="white"
                    strokeWidth="1.5"
                  >
                    <path d="M4.5 3V17L9 12.5L14.5 18L17 15.5L11.5 10L16.5 9.5L4.5 3Z" />
                  </svg>
                  <span 
                    className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-[9px] font-bold text-white shadow backdrop-blur-sm whitespace-nowrap"
                    style={{ backgroundColor: collaborator.color || '#EF4444' }}
                  >
                    {collaborator.userName}
                  </span>
                </div>
              );
            })}

            {store.isComparing && store.compareVersion && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold bg-violet-600/90 text-white shadow backdrop-blur-sm">
                Current: {store.version?.version_number}
              </span>
            )}
          </div>

          {/* Sibling Comparative Video Cut Player */}
          {store.isComparing && store.compareVersion && (
            <div className="relative w-full h-full flex items-center justify-center border-l border-slate-800 bg-black">
              <video
                ref={compareVideoRef}
                src={store.compareVersion.file_url.startsWith('http') ? store.compareVersion.file_url : `${BASE_URL}${store.compareVersion.file_url}`}
                muted
                className={`w-full h-full ${
                  store.fitMode === 'cover' ? 'object-cover' : store.fitMode === 'fill' ? 'object-fill' : 'object-contain'
                }`}
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-600/90 text-white shadow backdrop-blur-sm">
                Compare: {store.compareVersion.version_number}
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Control overlay elements & seekbar */}
      <div className="px-4 pt-4 pb-2 bg-slate-950 flex flex-col gap-1.5 relative">
        
        {/* Comment indicators ticks along seekbar */}
        <div className="absolute top-3.5 left-4 right-4 h-2 pointer-events-none z-10">
          {store.comments.map((c) => {
            const ratio = store.duration > 0 ? (c.timestamp_seconds / store.duration) * 100 : 0;
            return (
              <span
                key={c.id}
                className={`absolute w-2 h-2 rounded-full border border-slate-950 cursor-pointer -translate-x-1/2 pointer-events-auto ${
                  c.priority === 'high' ? 'bg-red-500' : 'bg-violet-400'
                }`}
                style={{ left: `${ratio}%` }}
                onClick={() => { if (videoRef.current) videoRef.current.currentTime = c.timestamp_seconds; }}
                title={`[${formatTime(c.timestamp_seconds)}] ${c.commenter_name}: ${c.comment}`}
              />
            );
          })}
        </div>

        {/* Custom Seekbar Scrubbing Slider */}
        <input
          type="range"
          min="0"
          max={store.duration || 100}
          step="0.01"
          value={store.currentTime}
          onChange={handleScrubChange}
          className="w-full accent-violet-600 bg-slate-800 h-1.5 rounded cursor-pointer relative z-20"
        />

        {/* Buttons Controls */}
        <div className="flex items-center justify-between text-slate-400 text-xs mt-1 z-20">
          <div className="flex items-center gap-3">
            <button onClick={handlePlayPause} className="p-1 hover:text-white">
              {store.isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 fill-slate-400 hover:fill-white" />}
            </button>
            
            <span className="font-semibold select-none font-mono">
              {formatTime(store.currentTime)} / {formatTime(store.duration)}
            </span>

            {/* Playback speed selector */}
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
              {[0.5, 1, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    store.playbackSpeed === s ? 'bg-violet-600 text-white font-bold' : 'hover:bg-slate-900'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Audio Volume */}
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={store.volume}
                onChange={handleVolumeChange}
                className="w-16 accent-violet-600 h-1 bg-slate-800 rounded"
              />
            </div>

            {/* Video aspect fitting styles */}
            <button 
              onClick={() => {
                store.setFitMode(store.fitMode === 'contain' ? 'cover' : store.fitMode === 'cover' ? 'fill' : 'contain');
              }}
              className={`px-2 py-0.5 rounded text-[9px] uppercase font-extrabold tracking-wider transition-all border ${
                isDark 
                  ? 'border-slate-850 bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-900' 
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Toggle Video fit: Fit / Fill / Stretch"
            >
              {store.fitMode}
            </button>

            <button onClick={handleFullscreen} className="p-1 hover:text-white">
              <Maximize className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
