import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { videoService, reviewService, feedbackService, BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import io from 'socket.io-client';
import { 
  Play, Pause, Volume2, Maximize, Clock, User, Check, Sparkles,
  ArrowLeft, Send, Trash2, Edit3, MessageSquare, Mic, Disc, Square,
  CheckCircle, AlertCircle, RefreshCw, ChevronDown, Award, HelpCircle,
  Download, FileText, Edit2
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

  // Resume progress notification states
  const [showResumeToast, setShowResumeToast] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);
  const lastSavedTimeRef = useRef(0);

  // Comparison player states
  const [isComparing, setIsComparing] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState('');
  const [compareVersion, setCompareVersion] = useState(null);
  const compareVideoRef = useRef(null);

  // Player sizing and custom fits
  const playerContainerRef = useRef(null);
  const [fitMode, setFitMode] = useState('contain'); // 'contain' | 'cover' | 'fill'
  const [videoAspectRatio, setVideoAspectRatio] = useState('16/9');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resizeKey, setResizeKey] = useState(0);

  // Real-time whiteboard collaborators & socket connection
  const [collaborators, setCollaborators] = useState({});
  const socketRef = useRef(null);

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

  // Subtitles & Caption States
  const [subtitles, setSubtitles] = useState([]);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [editingSubtitleId, setEditingSubtitleId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Chatbot states
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: 'Ask me anything about outstanding revision comments on this cut.' }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const handleCompareVersionChange = async (e) => {
    const val = e.target.value;
    setCompareVersionId(val);
    if (!val) {
      setCompareVersion(null);
      return;
    }
    try {
      const data = await videoService.getVersionDetails(val);
      setCompareVersion(data.version);
    } catch (err) {
      console.error('Failed to load comparison version details:', err);
    }
  };

  // Synced playback state locks (play, pause, speed)
  useEffect(() => {
    if (isComparing && compareVideoRef.current && videoRef.current) {
      // Sync speed
      compareVideoRef.current.playbackRate = videoRef.current.playbackRate;
      
      // Sync play/pause state
      if (isPlaying) {
        compareVideoRef.current.play().catch(() => {});
      } else {
        compareVideoRef.current.pause();
      }

      // Sync seek time once on comparison start or comparison cut change
      compareVideoRef.current.currentTime = videoRef.current.currentTime;
    }
  }, [isPlaying, isComparing, playbackSpeed, compareVersionId]);

  // Real-time whiteboard WebSockets room setup and drawing syncer
  useEffect(() => {
    const socket = io(BASE_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to real-time whiteboard collaboration');
      if (versionId && user) {
        socket.emit('join-review-session', { versionId, userName: user.name });
      }
    });

    socket.on('cursor-move-update', (data) => {
      const { socketId, x, y, userName, color, leave } = data;
      if (leave) {
        setCollaborators(prev => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      } else {
        setCollaborators(prev => ({
          ...prev,
          [socketId]: { x, y, userName, color, lastUpdated: Date.now() }
        }));
      }
    });

    socket.on('draw-stroke-update', (data) => {
      const { stroke } = data;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      ctx.strokeStyle = stroke.color || '#EF4444';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      const w = canvas.width;
      const h = canvas.height;

      if (stroke.type === 'free') {
        ctx.beginPath();
        ctx.moveTo(stroke.x1 * w, stroke.y1 * h);
        ctx.lineTo(stroke.x2 * w, stroke.y2 * h);
        ctx.stroke();
      } else if (stroke.type === 'circle') {
        ctx.beginPath();
        ctx.arc(stroke.x * w, stroke.y * h, stroke.radius * w, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (stroke.type === 'arrow') {
        drawArrow(ctx, stroke.x1 * w, stroke.y1 * h, stroke.x2 * w, stroke.y2 * h);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [versionId, user]);

  // Whiteboard inactive cursors cleanup timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCollaborators(prev => {
        const cleaned = {};
        Object.keys(prev).forEach(key => {
          if (now - prev[key].lastUpdated < 3000) {
            cleaned[key] = prev[key];
          }
        });
        return cleaned;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSubtitles = async () => {
    try {
      const data = await videoService.getSubtitles(versionId);
      setSubtitles(data);
    } catch (err) {
      console.error('Failed to load subtitles:', err);
    }
  };

  const fetchVersionReviewData = async () => {
    try {
      const data = await videoService.getVersionDetails(versionId);
      setVersion(data.version);
      setComments(data.comments);
      setAiSummary(data.aiSummary);
      setApprovals(data.approvals);
      setSiblingVersions(data.siblingVersions);
      await fetchSubtitles();
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

  // Update active subtitle segment based on currentTime
  useEffect(() => {
    if (subtitles && subtitles.length > 0) {
      const active = subtitles.find(s => currentTime >= s.start_time && currentTime <= s.end_time);
      setActiveSubtitle(active || null);
    } else {
      setActiveSubtitle(null);
    }
  }, [currentTime, subtitles]);

  // Canvas context scaling setup
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
      setIsFullscreen(!!document.fullscreenElement);
      setResizeKey(prev => prev + 1);
    };
    handleResize();
    // Schedule a small delay to make sure layout has settled
    const timer = setTimeout(handleResize, 100);
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
    };
  }, [loading, isDrawingMode, videoAspectRatio, fitMode, isComparing, compareVersion, compareVersionId]);

  const getCoord = (val, scale) => {
    if (val === undefined || val === null) return 0;
    return Math.abs(val) <= 1 ? val * scale : val;
  };

  const getCombinedAspectRatio = () => {
    if (isComparing && compareVersion) {
      if (!videoAspectRatio) return '32/9';
      const parts = videoAspectRatio.split('/');
      if (parts.length === 2) {
        const w = parseFloat(parts[0]);
        const h = parseFloat(parts[1]);
        if (!isNaN(w) && !isNaN(h) && h !== 0) {
          return `${w * 2}/${h}`;
        }
      }
      return '32/9';
    }
    return videoAspectRatio || '16/9';
  };

  // Reactive video annotation rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // If the user is currently actively drawing or drawing mode is on,
    // clear the canvas for a clean drawing slate and do not draw active comments annotations.
    if (isDrawingMode || drawHistory.length > 0) {
      if (drawHistory.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        redrawCanvasHistory();
      }
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find all comments close to this time (e.g. within 2 seconds)
    comments.forEach(comment => {
      if (!comment.draw_data || comment.draw_data.length === 0) return;
      
      const timeDiff = currentTime - comment.timestamp_seconds;
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
  }, [currentTime, comments, isDrawingMode, drawHistory, resizeKey]);


  // --- HTML5 Video Controls ---
  const handlePlayPause = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      setIsDrawingMode(false); // clear drawing mode when playing
      clearCanvas();
      if (isComparing && compareVideoRef.current) {
        compareVideoRef.current.play().catch(() => {});
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      if (isComparing && compareVideoRef.current) {
        compareVideoRef.current.pause();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);
      
      // Sync comparison player if drift is larger than 0.35 seconds
      if (isComparing && compareVideoRef.current) {
        const diff = Math.abs(curr - compareVideoRef.current.currentTime);
        if (diff > 0.35) {
          compareVideoRef.current.currentTime = curr;
        }
      }
      
      // Auto save progress every 3 seconds to reduce write frequency
      if (Math.abs(curr - lastSavedTimeRef.current) >= 3) {
        localStorage.setItem(`video_progress_${versionId}`, curr.toString());
        lastSavedTimeRef.current = curr;
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      const width = videoRef.current.videoWidth;
      const height = videoRef.current.videoHeight;
      if (width && height) {
        setVideoAspectRatio(`${width}/${height}`);
      }

      // Restore player progress on metadata load (ensuring browser is ready)
      const savedProgress = localStorage.getItem(`video_progress_${versionId}`);
      if (savedProgress) {
        const time = parseFloat(savedProgress);
        // Only resume if it's past the first 2 seconds and not at the very end
        if (time > 2 && time < dur - 2) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
          setResumeTime(time);
          setShowResumeToast(true);
          
          // Auto-hide resume notification after 5 seconds
          const timer = setTimeout(() => setShowResumeToast(false), 5000);
          return () => clearTimeout(timer);
        }
      }
    }
  };

  const handleRestartVideo = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      localStorage.setItem(`video_progress_${versionId}`, '0');
      lastSavedTimeRef.current = 0;
      setShowResumeToast(false);
    }
  };

  const handleScrubChange = (e) => {
    const time = parseFloat(e.target.value);
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    if (isComparing && compareVideoRef.current) {
      compareVideoRef.current.currentTime = time;
    }
    clearCanvas();
  };

  const handleSpeedChange = (speed) => {
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    if (isComparing && compareVideoRef.current) {
      compareVideoRef.current.playbackRate = speed;
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
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

      const stroke = {
        type: 'free',
        color: drawingColor,
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

      setDrawHistory(prev => [...prev, stroke]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasMousePos(e);

    if (drawingTool === 'circle') {
      const radius = Math.sqrt(Math.pow(pos.x - startX.current, 2) + Math.pow(pos.y - startY.current, 2));
      const stroke = {
        type: 'circle',
        color: drawingColor,
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
      setDrawHistory(prev => [...prev, stroke]);
    } 
    
    else if (drawingTool === 'arrow') {
      const stroke = {
        type: 'arrow',
        color: drawingColor,
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
      setDrawHistory(prev => [...prev, stroke]);
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
      userName: user?.name || 'Anonymous',
      color: drawingColor || '#EF4444'
    });
  };

  const handlePlayerMouseLeave = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('cursor-move', {
      versionId,
      leave: true
    });
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const h = canvas.height;
    
    drawHistory.forEach(item => {
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

  // Draw comment annotations when hovered
  const handleCommentHover = (comment) => {
    if (!comment.draw_data || comment.draw_data.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    comment.draw_data.forEach(item => {
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
        <header className={`h-16 flex items-center justify-between px-4 sm:px-8 pl-16 sm:pl-8 border-b flex-shrink-0 z-20 ${
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          
          {/* Left panel: player, canvas controls, comment submissions */}
          <div className="flex-1 flex flex-col p-4 sm:p-8 space-y-6 overflow-y-visible lg:overflow-y-auto">
            
            {/* Custom Video Player workspace */}
            <div 
              ref={playerContainerRef}
              className={`relative group/player flex flex-col w-full h-full ${
                isFullscreen ? 'rounded-none border-0' : 'rounded-xl border'
              } ${
                isDark ? 'bg-black border-slate-850' : 'bg-slate-900 border-slate-200 shadow-lg'
              }`}
            >
              
              {/* Media viewport container */}
              <div 
                className={`relative w-full overflow-hidden flex items-center justify-center bg-black ${
                  isFullscreen ? 'flex-1 h-0' : ''
                }`}
                style={{ 
                  aspectRatio: isFullscreen ? 'auto' : getCombinedAspectRatio(),
                  maxHeight: isFullscreen ? 'none' : '65vh'
                }}
              >
                <div className={`w-full h-full grid ${isComparing && compareVersion ? 'grid-cols-2 gap-1 bg-slate-950' : 'grid-cols-1'}`}>
                  
                  {/* Left Player (Current Cut) */}
                  <div 
                    className="relative w-full h-full flex items-center justify-center"
                    onMouseMove={handlePlayerMouseMove}
                    onMouseLeave={handlePlayerMouseLeave}
                  >
                    {/* Resume Playback Toast overlay */}
                    {showResumeToast && (
                      <div className="absolute top-4 left-4 right-4 z-50 flex justify-center">
                        <div className="bg-slate-900/95 border border-violet-500/30 text-white px-4 py-2.5 rounded-lg shadow-2xl backdrop-blur-md flex items-center justify-between gap-4 max-w-sm w-full animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                            <span className="text-[11px] text-slate-200 font-medium">
                              Resumed from {formatTime(resumeTime)}.
                            </span>
                          </div>
                          <button
                            onClick={handleRestartVideo}
                            className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors uppercase tracking-wider pl-2.5 border-l border-slate-800 shrink-0"
                          >
                            Restart
                          </button>
                        </div>
                      </div>
                    )}

                    <video
                      ref={videoRef}
                      src={version?.file_url.startsWith('http') ? version.file_url : `${BASE_URL}${version.file_url}`}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onClick={handlePlayPause}
                      className={`w-full h-full cursor-pointer ${
                        fitMode === 'cover' ? 'object-cover' : fitMode === 'fill' ? 'object-fill' : 'object-contain'
                      }`}
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

                    {/* Floating Collaborators Overlay */}
                    {Object.entries(collaborators).map(([socketId, collaborator]) => {
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

                    {isComparing && compareVersion && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold bg-violet-600/90 text-white shadow backdrop-blur-sm">
                        Current: {version?.version_number}
                      </span>
                    )}
                  </div>

                  {/* Right Player (Compare Sibling Cut) */}
                  {isComparing && compareVersion && (
                    <div className="relative w-full h-full flex items-center justify-center border-l border-slate-800 bg-black">
                      <video
                        ref={compareVideoRef}
                        src={compareVersion.file_url.startsWith('http') ? compareVersion.file_url : `${BASE_URL}${compareVersion.file_url}`}
                        muted
                        className={`w-full h-full ${
                          fitMode === 'cover' ? 'object-cover' : fitMode === 'fill' ? 'object-fill' : 'object-contain'
                        }`}
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-600/90 text-white shadow backdrop-blur-sm">
                        Compare: {compareVersion.version_number}
                      </span>
                    </div>
                  )}

                </div>
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

                    {/* Scale Aspect Toggle */}
                    <button 
                      onClick={() => {
                        setFitMode(prev => prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain');
                      }}
                      className={`px-2 py-0.5 rounded text-[9px] uppercase font-extrabold tracking-wider transition-all border ${
                        isDark 
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-900' 
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                      title="Toggle Video fit: Fit (Letterbox) / Fill (Crop) / Stretch"
                    >
                      {fitMode}
                    </button>

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

              {/* Compare version controls */}
              <div className="flex items-center gap-2 border-l border-slate-800/20 pl-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsComparing(!isComparing);
                    if (!isComparing && siblingVersions.length > 0 && !compareVersionId) {
                      const firstSibling = siblingVersions.find(s => s.id.toString() !== versionId.toString());
                      if (firstSibling) {
                        handleCompareVersionChange({ target: { value: firstSibling.id.toString() } });
                      }
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all ${
                    isComparing ? 'bg-cyan-600 text-white' : 'bg-slate-500/10 hover:bg-slate-500/20 text-slate-400'
                  }`}
                >
                  Version Compare
                </button>

                {isComparing && (
                  <select
                    value={compareVersionId}
                    onChange={handleCompareVersionChange}
                    className={`pl-2 pr-6 py-1 text-xs font-bold rounded border cursor-pointer focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-850 text-cyan-400' : 'bg-slate-50 border-slate-200 text-cyan-600'
                    }`}
                  >
                    <option value="">Select Cut...</option>
                    {siblingVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.version_number} cut</option>
                    ))}
                  </select>
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
          <div className={`w-full lg:w-96 min-h-[500px] lg:min-h-0 border-t lg:border-t-0 lg:border-l flex flex-col justify-between ${
            isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-xl'
          }`}>
            
            {/* Tab header buttons */}
            <div className="flex border-b border-slate-800/10 flex-shrink-0">
              {['comments', 'ai', 'chat'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-[10px] font-bold capitalize border-b-2 transition-colors ${
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
                  {comments.length > 0 && (
                    <div className="flex items-center justify-between border-b pb-2 mb-2 border-slate-800/10">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Timeline Revisions ({comments.length})</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            const url = await videoService.downloadMarkers(versionId, 'csv');
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
                            const url = await videoService.downloadMarkers(versionId, 'edl');
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
                              onClick={(e) => e.stopPropagation()}
                              src={c.voice_audio_url.startsWith('http') ? c.voice_audio_url : `${BASE_URL}${c.voice_audio_url}`} 
                              className="w-full h-6 accent-cyan-400 rounded"
                            />
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                videoRef.current.currentTime = c.timestamp_seconds;
                                setCurrentTime(c.timestamp_seconds);
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

              {/* Tab 4: Subtitles generator and editor */}
              {activeTab === 'subtitles' && (
                <div className="flex flex-col h-[450px] justify-between">
                  {subtitles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                      <div className="w-12 h-12 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-400">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>No Subtitles Yet</h3>
                        <p className="text-xs text-slate-500 max-w-[200px]">Transcribe the audio track and generate timestamped subtitles automatically using AI.</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            setIsGeneratingSubtitles(true);
                            const data = await videoService.generateSubtitles(versionId);
                            setSubtitles(data);
                          } catch (err) {
                            console.error('Failed to generate subtitles:', err);
                          } finally {
                            setIsGeneratingSubtitles(false);
                          }
                        }}
                        disabled={isGeneratingSubtitles}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-850 text-white font-bold text-xs rounded-lg shadow-md shadow-violet-500/10 transition-colors flex items-center gap-1.5"
                      >
                        {isGeneratingSubtitles ? (
                          <>
                            <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                            Transcribing Audio...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate AI Subtitles
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col h-full overflow-hidden">
                      {/* Subtitle control actions */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800/10 mb-3 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={async () => {
                              const url = await videoService.downloadSubtitles(versionId, 'srt');
                              window.open(url, '_blank');
                            }}
                            className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 border transition-colors ${
                              isDark ? 'bg-slate-850 hover:bg-slate-800 border-slate-805 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <Download className="w-3 h-3" />
                            SRT
                          </button>
                          <button
                            onClick={async () => {
                              const url = await videoService.downloadSubtitles(versionId, 'vtt');
                              window.open(url, '_blank');
                            }}
                            className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 border transition-colors ${
                              isDark ? 'bg-slate-850 hover:bg-slate-800 border-slate-805 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <Download className="w-3 h-3" />
                            VTT
                          </button>
                        </div>
                        
                        <button
                          onClick={async () => {
                            if (window.confirm("Regenerate subtitles? This will overwrite your current subtitles and custom edits.")) {
                              try {
                                setIsGeneratingSubtitles(true);
                                const data = await videoService.generateSubtitles(versionId);
                                setSubtitles(data);
                              } catch (err) {
                                console.error('Failed to regenerate subtitles:', err);
                              } finally {
                                setIsGeneratingSubtitles(false);
                              }
                            }
                          }}
                          disabled={isGeneratingSubtitles}
                          className="text-[10px] text-violet-400 hover:text-violet-300 font-bold transition-colors flex items-center gap-1"
                        >
                          {isGeneratingSubtitles ? 'Transcribing...' : 'Regenerate'}
                        </button>
                      </div>

                      {/* Subtitle segments editor list */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin max-h-[380px]">
                        {subtitles.map((sub) => {
                          const isActive = activeSubtitle && activeSubtitle.id === sub.id;
                          const isEditing = editingSubtitleId === sub.id;

                          return (
                            <div
                              key={sub.id}
                              className={`p-2.5 rounded-lg border transition-all duration-150 ${
                                isActive 
                                  ? 'border-violet-500/50 bg-violet-600/10 shadow-sm'
                                  : isDark ? 'border-slate-850 bg-slate-900/40 hover:bg-slate-905' : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50/80'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <button
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoRef.current.currentTime = sub.start_time;
                                      setCurrentTime(sub.start_time);
                                      if (!isPlaying) {
                                        videoRef.current.play().catch(() => {});
                                        setIsPlaying(true);
                                      }
                                    }
                                  }}
                                  className="text-[10px] font-mono text-violet-400 hover:underline flex items-center gap-1 font-bold"
                                >
                                  <Play className="w-2.5 h-2.5 fill-violet-400/20" />
                                  {parseFloat(sub.start_time).toFixed(1)}s - {parseFloat(sub.end_time).toFixed(1)}s
                                </button>
                                
                                <div className="flex items-center gap-1.5">
                                  {!isEditing ? (
                                    <button
                                      onClick={() => {
                                        setEditingSubtitleId(sub.id);
                                        setEditingText(sub.text);
                                      }}
                                      className="p-1 rounded text-slate-500 hover:text-violet-400 hover:bg-violet-500/5 transition-colors"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await videoService.updateSubtitle(versionId, sub.id, editingText);
                                            setSubtitles(prev => prev.map(item => item.id === sub.id ? { ...item, text: editingText } : item));
                                            setEditingSubtitleId(null);
                                          } catch (e) {
                                            console.error('Failed to update subtitle text:', e);
                                          }
                                        }}
                                        className="text-[10px] font-bold text-emerald-450 hover:underline"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingSubtitleId(null)}
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
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className={`w-full p-2 text-xs rounded border focus:outline-none focus:border-violet-500 resize-none ${
                                    isDark ? 'bg-[#0B0F19] border-slate-850 text-slate-200' : 'bg-white border-slate-250 text-slate-800'
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
