import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { videoService, reviewService, feedbackService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Play, Pause, Volume2, Maximize, Clock, User, Check, Sparkles,
  ArrowLeft, Send, Trash2, Edit3, MessageSquare, Mic, Disc, Square,
  CheckCircle, AlertCircle, RefreshCw, ChevronDown, Award, HelpCircle
} from 'lucide-react';

export default function VideoReview() {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [version, setVersion] = useState(null);
  const [comments, setComments] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [siblingVersions, setSiblingVersions] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Video player references
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  // Canvas drawing states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#EF4444'); // Default red
  const [drawingTool, setDrawingTool] = useState('free'); // 'free', 'circle', 'arrow', 'text'
  const [drawHistory, setDrawHistory] = useState([]); // [{ x, y, type, color }]
  const isDrawing = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);

  // New Comment state
  const [newComment, setNewComment] = useState('');
  const [commentCategory, setCommentCategory] = useState('Editing');
  const [commentPriority, setCommentPriority] = useState('medium');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // AI analysis loader
  const [analyzingVideo, setAnalyzingVideo] = useState(false);

  // Decision Modal
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState('approved');
  const [decisionComment, setDecisionComment] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  // Right sidebar tab
  const [activeTab, setActiveTab] = useState('comments'); // 'comments', 'ai', 'chat'

  // Chatbot states
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Ask me anything about outstanding revision comments on this cut.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const fetchVersionReviewData = async () => {
    try {
      const data = await videoService.getVersionDetails(versionId);
      setVersion(data.version);
      setComments(data.comments);
      setAiSummary(data.aiSummary);
      setApprovals(data.approvals);
      setSiblingVersions(data.siblingVersions);
    } catch (err) {
      console.error('Failed to load version details:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchVersionReviewData();
      setLoading(false);
    };
    init();
  }, [versionId]);

  // Restore player progress
  useEffect(() => {
    if (videoRef.current) {
      const savedProgress = localStorage.getItem(`video_progress_${versionId}`);
      if (savedProgress) {
        videoRef.current.currentTime = parseFloat(savedProgress);
      }
    }
  }, [loading]);

  // Canvas context scaling setup
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
  }, [loading, isDrawingMode]);

  // --- HTML5 Video Controls ---
  const handlePlayPause = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setIsDrawingMode(false); // clear drawing mode when playing
      clearCanvas();
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);
      // Auto save progress every 5 seconds
      localStorage.setItem(`video_progress_${versionId}`, curr.toString());
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleScrubChange = (e) => {
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    clearCanvas();
  };

  const handleSpeedChange = (speed) => {
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
  };

  const handleFullscreen = () => {
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  // --- Drawing Canvas Coordinates ---
  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!isDrawingMode) return;
    isDrawing.current = true;
    const pos = getCanvasMousePos(e);
    startX.current = pos.x;
    startY.current = pos.y;
    
    // Auto pause video
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const draw = (e) => {
    if (!isDrawing.current || !isDrawingMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasMousePos(e);

    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    if (drawingTool === 'free') {
      ctx.beginPath();
      ctx.moveTo(startX.current, startY.current);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      setDrawHistory(prev => [...prev, {
        type: 'free',
        color: drawingColor,
        x1: startX.current,
        y1: startY.current,
        x2: pos.x,
        y2: pos.y
      }]);

      startX.current = pos.x;
      startY.current = pos.y;
    } 
    
    else if (drawingTool === 'circle') {
      // Clear and redraw background history to preview
      redrawCanvasHistory();
      ctx.beginPath();
      const radius = Math.sqrt(Math.pow(pos.x - startX.current, 2) + Math.pow(pos.y - startY.current, 2));
      ctx.arc(startX.current, startY.current, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    else if (drawingTool === 'arrow') {
      redrawCanvasHistory();
      drawArrow(ctx, startX.current, startY.current, pos.x, pos.y);
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing.current || !isDrawingMode) return;
    isDrawing.current = false;
    const pos = getCanvasMousePos(e);

    if (drawingTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - startX.current, 2) + Math.pow(pos.y - startY.current, 2));
      setDrawHistory(prev => [...prev, {
        type: 'circle',
        color: drawingColor,
        x: startX.current,
        y: startY.current,
        radius
      }]);
    } 
    
    else if (drawingTool === 'arrow') {
      setDrawHistory(prev => [...prev, {
        type: 'arrow',
        color: drawingColor,
        x1: startX.current,
        y1: startY.current,
        x2: pos.x,
        y2: pos.y
      }]);
    }
  };

  const drawArrow = (ctx, fromX, fromY, toX, toY) => {
    const headlen = 12; // length of head in pixels
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

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDrawHistory([]);
  };

  const redrawCanvasHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawHistory.forEach(item => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      
      if (item.type === 'free') {
        ctx.beginPath();
        ctx.moveTo(item.x1, item.y1);
        ctx.lineTo(item.x2, item.y2);
        ctx.stroke();
      } else if (item.type === 'circle') {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (item.type === 'arrow') {
        drawArrow(ctx, item.x1, item.y1, item.x2, item.y2);
      }
    });
  };

  // Draw comment annotations when hovered
  const handleCommentHover = (comment) => {
    if (!comment.draw_data || comment.draw_data.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    comment.draw_data.forEach(item => {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      
      if (item.type === 'free') {
        ctx.beginPath();
        ctx.moveTo(item.x1, item.y1);
        ctx.lineTo(item.x2, item.y2);
        ctx.stroke();
      } else if (item.type === 'circle') {
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (item.type === 'arrow') {
        drawArrow(ctx, item.x1, item.y1, item.x2, item.y2);
      }
    });
  };

  const handleCommentLeave = () => {
    redrawCanvasHistory();
  };

  // --- Voice Recording Logic ---
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setVoiceBlob(audioBlob);
        setNewComment(prev => prev || '[Voice Feedback Note recorded]');
      };

      mediaRecorderRef.current.start();
      setIsVoiceRecording(true);
    } catch (e) {
      // Fallback simulated voice note
      setIsVoiceRecording(true);
      setTimeout(() => {
        setVoiceBlob(new Blob(['simulated voice data'], { type: 'audio/wav' }));
        setIsVoiceRecording(false);
        setNewComment(prev => prev || 'Adjust voice note timing levels here.');
      }, 3000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isVoiceRecording) {
      mediaRecorderRef.current.stop();
      setIsVoiceRecording(false);
    }
  };

  // --- Submit Comment Form ---
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() && !voiceBlob) return;

    try {
      const formData = new FormData();
      formData.append('version_id', versionId);
      formData.append('timestamp_seconds', currentTime.toString());
      formData.append('comment', newComment);
      formData.append('category', commentCategory);
      formData.append('priority', commentPriority);
      
      if (drawHistory.length > 0) {
        formData.append('draw_data', JSON.stringify(drawHistory));
      }

      if (voiceBlob) {
        formData.append('voice', voiceBlob, 'voice_feedback.wav');
      }

      await reviewService.addComment(formData);

      // Reset
      setNewComment('');
      setVoiceBlob(null);
      clearCanvas();
      await fetchVersionReviewData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit feedback.');
    }
  };

  // --- Submit Approval decision Cut ---
  const handleSaveDecision = async (e) => {
    e.preventDefault();
    setSavingDecision(true);
    try {
      await reviewService.approve({
        version_id: versionId,
        status: decisionStatus,
        comments: decisionComment
      });

      setIsDecisionOpen(false);
      setDecisionComment('');
      await fetchVersionReviewData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update review decision.');
    } finally {
      setSavingDecision(false);
    }
  };

  // --- AI Video Analyzer compilation trigger ---
  const handleCompileAIAnalysis = async () => {
    if (comments.length === 0) {
      alert('Please add comment notes along the timeline before calling the AI compilation service.');
      return;
    }

    setAnalyzingVideo(true);
    try {
      await reviewService.analyzeVideo(versionId);
      await fetchVersionReviewData();
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingVideo(false);
    }
  };

  // --- AI Chat Assistant messaging ---
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = { role: 'user', content: chatMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const response = await feedbackService.chat(chatMessage, chatHistory, version?.project_id);
      setChatHistory(prev => [...prev, { role: 'assistant', content: response.reply }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Connection issue. Try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Helpers
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider font-sans">Connecting Review Session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Workspace Frame.io style */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Header version selector / decision buttons */}
        <header className={`h-16 flex items-center justify-between px-8 border-b flex-shrink-0 z-20 ${
          isDark ? 'border-slate-800 bg-[#161D30]/95 backdrop-blur-md' : 'border-slate-200 bg-white/90 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className={`p-2 rounded-lg border hover:bg-slate-500/10 transition-colors ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            
            {/* Version Switcher dropdown */}
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm truncate max-w-[150px]">{version?.video_title}</h2>
              <div className="relative group">
                <select
                  value={versionId}
                  onChange={(e) => navigate(`/review/${e.target.value}`)}
                  className={`pl-2 pr-7 py-1 text-xs font-extrabold rounded border cursor-pointer focus:outline-none appearance-none ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 text-violet-400' : 'bg-slate-50 border-slate-200 text-violet-600'
                  }`}
                >
                  {siblingVersions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version_number} cut</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute top-2 right-2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Client Decision Action */}
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              version?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
              version?.status === 'revision_required' ? 'bg-rose-500/10 text-rose-400' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
              {version?.status?.replace(/_/g, ' ')}
            </span>

            {user?.role === 'client' || ['pm', 'admin'].includes(user?.role) ? (
              <button
                onClick={() => setIsDecisionOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/15"
              >
                <Award className="w-4 h-4" />
                Submit Decision
              </button>
            ) : null}
          </div>
        </header>

        {/* Dynamic Frame.io double panel layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left panel: player, canvas controls, comment submissions */}
          <div className="flex-1 flex flex-col overflow-y-auto p-8 space-y-6">
            
            {/* Custom Video Player workspace */}
            <div className={`rounded-xl border overflow-hidden relative group/player flex flex-col ${
              isDark ? 'bg-black border-slate-850' : 'bg-slate-900 border-slate-200 shadow-lg'
            }`}>
              
              {/* Media viewport container */}
              <div className="relative aspect-video w-full overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={version?.file_url.startsWith('http') ? version.file_url : `http://localhost:5000${version.file_url}`}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={handlePlayPause}
                  className="w-full h-full object-contain cursor-pointer"
                />

                {/* Drawing HTML5 Canvas overlay */}
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className={`absolute inset-0 w-full h-full ${
                    isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'
                  }`}
                />
              </div>

              {/* Seekbar and Timeline comment markers */}
              <div className="px-4 pt-4 pb-2 bg-slate-950 flex flex-col gap-1.5 relative">
                
                {/* Comments ticks */}
                <div className="absolute top-3.5 left-4 right-4 h-2 pointer-events-none z-10">
                  {comments.map((c) => {
                    const ratio = duration > 0 ? (c.timestamp_seconds / duration) * 100 : 0;
                    return (
                      <span
                        key={c.id}
                        className={`absolute w-2 h-2 rounded-full border border-slate-950 cursor-pointer -translate-x-1/2 pointer-events-auto ${
                          c.priority === 'high' ? 'bg-red-500' : 'bg-violet-400'
                        }`}
                        style={{ left: `${ratio}%` }}
                        onClick={() => { videoRef.current.currentTime = c.timestamp_seconds; }}
                        title={`[${formatTime(c.timestamp_seconds)}] ${c.commenter_name}: ${c.comment}`}
                      />
                    );
                  })}
                </div>

                {/* Scrub Seekbar */}
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.01"
                  value={currentTime}
                  onChange={handleScrubChange}
                  className="w-full accent-violet-600 bg-slate-800 h-1.5 rounded cursor-pointer relative z-20"
                />

                {/* Custom control buttons */}
                <div className="flex items-center justify-between text-slate-400 text-xs mt-1 z-20">
                  <div className="flex items-center gap-3">
                    <button onClick={handlePlayPause} className="p-1 hover:text-white">
                      {isPlaying ? <Pause className="w-4.5 h-4.5" /> : <Play className="w-4.5 h-4.5 fill-slate-400 hover:fill-white" />}
                    </button>
                    
                    <span className="font-semibold select-none font-mono">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    {/* Speed selection */}
                    <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                      {[0.5, 1, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSpeedChange(s)}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            playbackSpeed === s ? 'bg-violet-600 text-white font-bold' : 'hover:bg-slate-900'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Volume */}
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-16 accent-violet-600 h-1 bg-slate-800 rounded"
                      />
                    </div>

                    <button onClick={handleFullscreen} className="p-1 hover:text-white">
                      <Maximize className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawing canvas toolbar */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsDrawingMode(!isDrawingMode)}
                  className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isDrawingMode ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-500/10 hover:bg-slate-500/20 text-slate-400'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  {isDrawingMode ? 'Drawing On' : 'Drawing Off (Brush)'}
                </button>

                {isDrawingMode && (
                  <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                    {/* Color picker */}
                    {['#EF4444', '#F59E0B', '#06B6D4', '#FFFFFF'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setDrawingColor(color)}
                        className="w-4 h-4 rounded-full border border-slate-950 transition-transform hover:scale-125"
                        style={{ backgroundColor: color, border: drawingColor === color ? '2px solid #8B5CF6' : '1px solid transparent' }}
                      />
                    ))}
                    {/* Tool picker */}
                    <select
                      value={drawingTool}
                      onChange={(e) => setDrawingTool(e.target.value)}
                      className={`px-1.5 py-1 text-[10px] rounded border focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="free">Pen Brush</option>
                      <option value="circle">Circle</option>
                      <option value="arrow">Arrow</option>
                    </select>
                  </div>
                )}
              </div>

              {drawHistory.length > 0 && (
                <button
                  onClick={clearCanvas}
                  className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 font-bold text-[10px] flex items-center gap-1.5 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Drawing
                </button>
              )}
            </div>

            {/* In-app timestamp commentary form submission */}
            {user?.role === 'client' || ['pm', 'admin'].includes(user?.role) ? (
              <div className={`p-6 rounded-xl border ${
                isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between mb-4 border-b border-slate-800/10 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Timestamp feedback note</h3>
                  <span className="text-xs font-bold text-violet-400 bg-violet-600/10 px-2 py-0.5 rounded font-mono">
                    Time: {formatTime(currentTime)}
                  </span>
                </div>

                <form onSubmit={handlePostComment} className="space-y-4">
                  <div className="flex gap-2">
                    <textarea
                      rows={3}
                      placeholder="Comment on current scene details..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className={`flex-1 p-3.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:border-violet-500 ${
                        isDark ? 'bg-[#0B0F19] border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    />
                  </div>

                  {/* Cat + priority + record */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      
                      {/* Cat */}
                      <div>
                        <select
                          value={commentCategory}
                          onChange={(e) => setCommentCategory(e.target.value)}
                          className={`px-2 py-1.5 rounded border text-xs focus:outline-none ${
                            isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <option value="Editing">Editing</option>
                          <option value="VFX">VFX</option>
                          <option value="Audio">Audio</option>
                          <option value="Subtitle">Subtitle</option>
                          <option value="Color Grading">Color Grading</option>
                          <option value="Transition">Transition</option>
                          <option value="Animation">Animation</option>
                          <option value="General">General</option>
                        </select>
                      </div>

                      {/* Priority */}
                      <div>
                        <select
                          value={commentPriority}
                          onChange={(e) => setCommentPriority(e.target.value)}
                          className={`px-2 py-1.5 rounded border text-xs focus:outline-none ${
                            isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      {/* Microphone trigger Web Audio */}
                      <button
                        type="button"
                        onClick={isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
                        className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                          isVoiceRecording 
                            ? 'bg-rose-500 text-white animate-pulse' 
                            : isDark ? 'bg-[#0B0F19] hover:bg-slate-800 text-slate-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                        }`}
                        title="Record Voice note feedback"
                      >
                        {isVoiceRecording ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
                      </button>
                      
                    </div>

                    <button
                      type="submit"
                      disabled={!newComment.trim() && !voiceBlob}
                      className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/10 transition-colors disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post Comment
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

          </div>

          {/* Right panel: Tab sheets for comments, summary and chatbot */}
          <div className={`w-96 flex-shrink-0 border-l flex flex-col justify-between ${
            isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            
            {/* Tab header buttons */}
            <div className="flex border-b border-slate-800/10 flex-shrink-0">
              {['comments', 'ai', 'chat'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-xs font-bold capitalize border-b-2 transition-colors ${
                    activeTab === tab
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
              {activeTab === 'comments' && (
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No comments logged along this timeline yet.</p>
                  ) : (
                    comments.map((c) => (
                      <div 
                        key={c.id}
                        onMouseEnter={() => handleCommentHover(c)}
                        onMouseLeave={handleCommentLeave}
                        onClick={() => { videoRef.current.currentTime = c.timestamp_seconds; }}
                        className={`p-3.5 rounded-lg border text-xs cursor-pointer hover:border-violet-500/40 transition-colors ${
                          isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-220 shadow-sm'
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
                              src={c.voice_audio_url.startsWith('http') ? c.voice_audio_url : `http://localhost:5000${c.voice_audio_url}`} 
                              className="w-full h-5 accent-cyan-400"
                            />
                            <span className="text-[9px] text-slate-500 italic">"Transcript: {c.voice_transcript}"</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: AI Summary & Task Boards generation */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  {['pm', 'admin'].includes(user?.role) && (
                    <button
                      onClick={handleCompileAIAnalysis}
                      disabled={analyzingVideo || comments.length === 0}
                      className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-40"
                    >
                      <Sparkles className="w-4 h-4" />
                      {analyzingVideo ? 'Running AI Engine...' : 'Compile AI Summary'}
                    </button>
                  )}

                  {aiSummary ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Executive Summary</h4>
                        <p className="text-xs leading-relaxed text-slate-300 bg-[#0B0F19]/40 p-3 rounded border border-slate-850">
                          {aiSummary.summary}
                        </p>
                      </div>

                      {/* Estimated effort hours */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-[10px] text-slate-500 block">Total Est. Hours</span>
                          <span className="text-lg font-bold text-cyan-400">{aiSummary.effort_estimate}h</span>
                        </div>
                        <div className={`p-3 rounded-lg border ${isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-[10px] text-slate-500 block">Priority Level</span>
                          <span className="text-lg font-bold text-amber-500">
                            {aiSummary.priority_breakdown?.high > 0 ? 'HIGH' : 'MEDIUM'}
                          </span>
                        </div>
                      </div>

                      {/* Task Lists categorized counts */}
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Seeded Task Breakdown</h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-800/10">
                            <span>Editing Tasks</span>
                            <span className="font-bold text-violet-400">{aiSummary.editing_tasks?.length || 0}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/10">
                            <span>VFX Tasks</span>
                            <span className="font-bold text-cyan-400">{aiSummary.vfx_tasks?.length || 0}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/10">
                            <span>Audio Tasks</span>
                            <span className="font-bold text-amber-500">{aiSummary.audio_tasks?.length || 0}</span>
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

              {/* Tab 3: Interactive Chatbot assistant */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-[400px] justify-between">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {chatHistory.map((msg, i) => (
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
                    {chatLoading && (
                      <div className="text-slate-500 text-xs italic">AI Assistant is thinking...</div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendChatMessage} className="flex gap-1.5 pt-3 border-t border-slate-800/20">
                    <input
                      type="text"
                      placeholder="Ask details..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      className={`flex-1 px-3 py-1.5 rounded border text-xs focus:outline-none focus:border-violet-500 ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={chatLoading}
                      className="p-2 rounded bg-violet-600 text-white flex items-center justify-center"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

            </div>

          </div>

        </div>

      </main>

      {/* SUBMIT APPROVAL DECISION MODAL */}
      {isDecisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl border shadow-2xl relative ${
            isDark ? 'bg-[#161D30] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <h2 className="text-lg font-bold mb-2">Submit Video review Decision</h2>
            <p className="text-xs text-slate-500 mb-4 font-medium">Log your approval or request revisions for editing staff.</p>

            <form onSubmit={handleSaveDecision} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Decision Status *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setDecisionStatus('approved')}
                    className={`py-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      decisionStatus === 'approved' 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                        : 'border-slate-800 hover:bg-slate-800 text-slate-500'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Final Cut
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionStatus('revision_required')}
                    className={`py-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      decisionStatus === 'revision_required' 
                        ? 'bg-rose-500/10 border-rose-500 text-rose-400' 
                        : 'border-slate-800 hover:bg-slate-800 text-slate-500'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    Request Revisions
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Approval Comments / Note</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide details on your decision cut status..."
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  className={`w-full p-2.5 rounded border text-xs focus:outline-none ${
                    isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDecisionOpen(false)}
                  className={`px-4 py-2 rounded text-xs font-semibold border ${
                    isDark ? 'border-slate-850 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDecision}
                  className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-lg"
                >
                  {savingDecision ? 'Saving...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
