import React, { useEffect, useRef } from 'react';
import { useReviewStore } from '../../store/useReviewStore';
import { videoService } from '../../services/api';
import { 
  Play, Sparkles, Send, Download, FileText, Edit2, Volume2 
} from 'lucide-react';

export default function RightSidebarTabs({ videoRef, user, isDark, BASE_URL }) {
  const store = useReviewStore();
  const chatEndRef = useRef(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [store.chatHistory, store.activeTab]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCommentClick = (comment) => {
    if (videoRef && videoRef.current) {
      videoRef.current.currentTime = comment.timestamp_seconds;
      store.setCurrentTime(comment.timestamp_seconds);
    }
  };

  const handleSubtitlePlay = (sub) => {
    if (videoRef && videoRef.current) {
      videoRef.current.currentTime = sub.start_time;
      store.setCurrentTime(sub.start_time);
      if (!store.isPlaying) {
        videoRef.current.play().catch(() => {});
        store.setIsPlaying(true);
      }
    }
  };

  const handleCommentHover = (comment) => {
    // Coordinate scaling annotation drawing is handled reactively by the canvas listening to store.isDrawingMode
    // We can set a temporary hover state if needed, or trigger hover callbacks
    const canvas = document.querySelector('canvas');
    if (!canvas || !comment.draw_data || comment.draw_data.length === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    const getCoord = (val, scale) => {
      if (val === undefined || val === null) return 0;
      return Math.abs(val) <= 1 ? val * scale : val;
    };

    const drawArrow = (context, fromX, fromY, toX, toY) => {
      const headlen = 12;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      context.moveTo(toX);
      context.moveTo(toX, toY);
      context.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      context.stroke();
    };

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
  };

  const handleCommentLeave = () => {
    // Redraw whiteboard history
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    
    const getCoord = (val, scale) => {
      if (val === undefined || val === null) return 0;
      return Math.abs(val) <= 1 ? val * scale : val;
    };

    const drawArrow = (context, fromX, fromY, toX, toY) => {
      const headlen = 12;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      context.beginPath();
      context.moveTo(fromX, fromY);
      context.lineTo(toX, toY);
      context.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      context.moveTo(toX);
      context.moveTo(toX, toY);
      context.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      context.stroke();
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

  return (
    <div className={`w-full lg:w-96 min-h-[500px] lg:min-h-0 border-t lg:border-t-0 lg:border-l flex flex-col justify-between ${
      isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-xl'
    }`}>
      
      {/* Tab header buttons */}
      <div className="flex border-b border-slate-800/10 flex-shrink-0">
        {['comments', 'ai', 'chat'].map((tab) => (
          <button
            key={tab}
            onClick={() => store.setActiveTab(tab)}
            className={`flex-1 py-3 text-[10px] font-bold capitalize border-b-2 transition-colors ${
              store.activeTab === tab
                ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                : isDark ? 'border-transparent text-slate-500 hover:text-slate-300' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab === 'comments' ? 'Revisions' : tab === 'ai' ? 'AI Summary' : 'AI Assistant'}
          </button>
        ))}
      </div>

      {/* Tab Body contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        
        {/* Tab 1: Comments history */}
        {store.activeTab === 'comments' && (
          <div className="space-y-3">
            {store.comments.length > 0 && (
              <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-800/10">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Timeline Revisions ({store.comments.length})</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      const url = await videoService.downloadMarkers(store.version?.id, 'csv');
                      window.open(url, '_blank');
                    }}
                    className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${
                      isDark ? 'border-slate-800 hover:bg-slate-850 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                    title="Export for Premiere Pro as CSV Markers"
                  >
                    Premiere CSV
                  </button>
                  <button
                    onClick={async () => {
                      const url = await videoService.downloadMarkers(store.version?.id, 'edl');
                      window.open(url, '_blank');
                    }}
                    className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${
                      isDark ? 'border-slate-800 hover:bg-slate-850 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                    }`}
                    title="Export for DaVinci Resolve as EDL Markers"
                  >
                    Resolve EDL
                  </button>
                </div>
              </div>
            )}
            {store.comments.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No comments logged along this timeline yet.</p>
            ) : (
              store.comments.map((c) => (
                <div 
                  key={c.id}
                  onMouseEnter={() => handleCommentHover(c)}
                  onMouseLeave={handleCommentLeave}
                  onClick={() => handleCommentClick(c)}
                  className={`p-3.5 rounded-lg border text-xs cursor-pointer hover:border-violet-500/40 transition-colors ${
                    isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-220 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-violet-400">{c.commenter_name}</span>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-600/10 px-1.5 py-0.5 rounded font-mono">
                      {formatTime(c.timestamp_seconds)}
                    </span>
                  </div>
                  
                  <p className="text-slate-300 leading-normal">{c.comment}</p>
                  
                  {/* Tags */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-1 rounded text-[8px] font-bold uppercase ${
                      c.category === 'VFX' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-violet-500/10 text-violet-400'
                    }`}>
                      {c.category}
                    </span>
                    <span className={`px-1 rounded text-[8px] font-bold uppercase ${
                      c.priority === 'high' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {c.priority}
                    </span>
                  </div>

                  {/* voice notes player details */}
                  {c.voice_audio_url && (
                    <div className="mt-2.5 p-2 rounded bg-slate-500/5 flex flex-col gap-1 text-[10px]">
                      <audio 
                        controls 
                        onClick={(e) => e.stopPropagation()}
                        src={c.voice_audio_url.startsWith('http') ? c.voice_audio_url : `${BASE_URL}${c.voice_audio_url}`} 
                        className="w-full h-6 accent-cyan-400 rounded"
                      />
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCommentClick(c);
                        }}
                        className="text-[9.5px] text-violet-400 hover:text-cyan-400 transition-colors font-medium mt-1 cursor-pointer flex items-center gap-1 select-none"
                        title="Click transcript to seek video"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                        Transcript: "{c.voice_transcript}"
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: AI Summary */}
        {store.activeTab === 'ai' && (
          <div className="space-y-4">
            {['pm', 'admin'].includes(user?.role) && (
              <button
                onClick={() => store.compileAIAnalysis(store.version?.id)}
                disabled={store.analyzingVideo || store.comments.length === 0}
                className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-40"
              >
                <Sparkles className="w-4 h-4" />
                {store.analyzingVideo ? 'Running AI Engine...' : 'Compile AI Summary'}
              </button>
            )}

            {store.aiSummary ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Executive Summary</h4>
                  <p className="text-xs leading-relaxed text-slate-300 bg-[#0B0F19]/40 p-3 rounded border border-slate-855">
                    {store.aiSummary.summary}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 block">Total Est. Hours</span>
                    <span className="text-lg font-bold text-cyan-400">{store.aiSummary.effort_estimate}h</span>
                  </div>
                  <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="text-[10px] text-slate-500 block">Priority Level</span>
                    <span className="text-lg font-bold text-amber-500">
                      {store.aiSummary.priority_breakdown?.high > 0 ? 'HIGH' : 'MEDIUM'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Seeded Task Breakdown</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/10">
                      <span>Editing Tasks</span>
                      <span className="font-bold text-violet-400">{store.aiSummary.editing_tasks?.length || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/10">
                      <span>VFX Tasks</span>
                      <span className="font-bold text-cyan-400">{store.aiSummary.vfx_tasks?.length || 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/10">
                      <span>Audio Tasks</span>
                      <span className="font-bold text-amber-500">{store.aiSummary.audio_tasks?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                AI Summary not generated yet.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Chatbot */}
        {store.activeTab === 'chat' && (
          <div className="flex flex-col h-[400px] justify-between">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {store.chatHistory.map((msg, i) => (
                <div 
                  key={i} 
                  className={`p-2.5 rounded-lg text-xs leading-normal max-w-[85%] ${
                    msg.role === 'user' 
                      ? 'bg-violet-600 text-white ml-auto' 
                      : isDark ? 'bg-[#0B0F19] text-slate-300' : 'bg-slate-150 text-slate-800'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {store.chatLoading && (
                <div className="text-slate-500 text-xs italic">AI Assistant is thinking...</div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                store.sendChatMessage(store.version?.id);
              }} 
              className="flex gap-1.5 pt-3 border-t border-slate-800/20"
            >
              <input
                type="text"
                placeholder="Ask details..."
                value={store.chatMessage}
                onChange={(e) => store.setChatMessage(e.target.value)}
                className={`flex-1 px-3 py-1.5 rounded border text-xs focus:outline-none focus:border-violet-500 ${
                  isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <button
                type="submit"
                disabled={store.chatLoading}
                className="p-2 rounded bg-violet-600 text-white flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Subtitles (Preserved in code) */}
        {store.activeTab === 'subtitles' && (
          <div className="flex flex-col h-[450px] justify-between">
            {store.subtitles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>No Subtitles Yet</h3>
                  <p className="text-xs text-slate-500 max-w-[200px]">Transcribe the audio track and generate timestamped subtitles automatically using AI.</p>
                </div>
                <button
                  onClick={() => store.generateSubtitles(store.version?.id)}
                  disabled={store.isGeneratingSubtitles}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-850 text-white font-bold text-xs rounded-lg shadow-md shadow-violet-500/10 transition-colors flex items-center gap-1.5"
                >
                  {store.isGeneratingSubtitles ? 'Transcribing...' : 'Generate AI Subtitles'}
                </button>
              </div>
            ) : (
              <div className="flex-grow flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin max-h-[380px]">
                  {store.subtitles.map((sub) => {
                    const isActive = store.activeSubtitle && store.activeSubtitle.id === sub.id;
                    const isEditing = store.editingSubtitleId === sub.id;

                    return (
                      <div
                        key={sub.id}
                        className={`p-2.5 rounded-lg border transition-all duration-150 ${
                          isActive 
                            ? 'border-violet-500/50 bg-violet-600/10 shadow-sm'
                            : isDark ? 'border-slate-855 bg-slate-900/40 hover:bg-slate-905' : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <button
                            onClick={() => handleSubtitlePlay(sub)}
                            className="text-[10px] font-mono text-violet-400 hover:underline flex items-center gap-1 font-bold"
                          >
                            <Play className="w-2.5 h-2.5 fill-violet-400/20" />
                            {parseFloat(sub.start_time).toFixed(1)}s - {parseFloat(sub.end_time).toFixed(1)}s
                          </button>
                          
                          <div className="flex items-center gap-1.5">
                            {!isEditing ? (
                              <button
                                onClick={() => {
                                  store.setEditingSubtitleId(sub.id);
                                  store.setEditingText(sub.text);
                                }}
                                className="p-1 rounded text-slate-500 hover:text-violet-400 hover:bg-violet-500/5 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => store.updateSubtitle(store.version?.id, sub.id, store.editingText)}
                                  className="text-[10px] font-bold text-emerald-450 hover:underline"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => store.setEditingSubtitleId(null)}
                                  className="text-[10px] font-bold text-slate-500 hover:underline"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <textarea
                            value={store.editingText}
                            onChange={(e) => store.setEditingText(e.target.value)}
                            className={`w-full p-2 text-xs rounded border focus:outline-none focus:border-violet-500 resize-none ${
                              isDark ? 'bg-[#0B0F19] border-slate-855 text-slate-200' : 'bg-white border-slate-255 text-slate-800'
                            }`}
                            rows={2}
                          />
                        ) : (
                          <p className={`text-xs leading-normal ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {sub.text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
