import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useReviewStore } from '../store/useReviewStore';
import io from 'socket.io-client';
import { 
  ArrowLeft, ChevronDown, Award, CheckCircle, AlertCircle, Sparkles, RefreshCw, Mic
} from 'lucide-react';

// Modular Subcomponents
import VideoPlayerSection from '../components/review/VideoPlayerSection';
import DrawingToolbar from '../components/review/DrawingToolbar';
import CommentFormSection from '../components/review/CommentFormSection';
import RightSidebarTabs from '../components/review/RightSidebarTabs';

export default function VideoReview() {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const store = useReviewStore();

  // WebRTC Local voice chat states & refs
  const [isVoiceActive, setIsVoiceActive] = React.useState(false);
  const [voiceMembers, setVoiceMembers] = React.useState([]);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});

  // DOM Refs
  const videoRef = useRef(null);
  const compareVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const playerContainerRef = useRef(null);
  const socketRef = useRef(null);

  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const cleanUrl = BASE_URL.endsWith('/api') 
    ? BASE_URL.slice(0, -4) 
    : BASE_URL.endsWith('/api/') 
      ? BASE_URL.slice(0, -5) 
      : BASE_URL;

  // Initialize and Fetch details
  useEffect(() => {
    const init = async () => {
      store.setLoading(true);
      await store.fetchVersionReviewData(versionId);
      store.setLoading(false);
    };
    init();
  }, [versionId]);

  // Collaborative Whiteboard WebSockets room setup
  useEffect(() => {
    const socket = io(cleanUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to real-time whiteboard collaboration');
      if (versionId && user) {
        socket.emit('join-review-session', { versionId, userName: user.name });
      }
    });

    socket.on('cursor-move-update', (data) => {
      const { socketId, x, y, userName, color, leave } = data;
      const currentCollaborators = useReviewStore.getState().collaborators;
      if (leave) {
        const next = { ...currentCollaborators };
        delete next[socketId];
        store.setCollaborators(next);
      } else {
        const next = {
          ...currentCollaborators,
          [socketId]: { x, y, userName, color, lastUpdated: Date.now() }
        };
        store.setCollaborators(next);
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

    // WebRTC Signaling events
    socket.on('webrtc-user-joined', async (data) => {
      const { socketId, userName } = data;
      setVoiceMembers(prev => [...prev, { id: socketId, userName }]);
      const pc = createPeerConnection(socketId, userName);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { targetSocketId: socketId, offer });
      } catch (err) {
        console.error('Failed to create WebRTC offer:', err);
      }
    });

    socket.on('webrtc-offer-received', async (data) => {
      const { senderSocketId, offer } = data;
      const userName = 'Reviewer';
      setVoiceMembers(prev => {
        if (prev.some(p => p.id === senderSocketId)) return prev;
        return [...prev, { id: senderSocketId, userName }];
      });
      const pc = createPeerConnection(senderSocketId, userName);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { targetSocketId: senderSocketId, answer });
      } catch (err) {
        console.error('Failed to create WebRTC answer:', err);
      }
    });

    socket.on('webrtc-answer-received', async (data) => {
      const { senderSocketId, answer } = data;
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc-candidate-received', async (data) => {
      const { senderSocketId, candidate } = data;
      const pc = peerConnectionsRef.current[senderSocketId];
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add WebRTC candidate:', err);
        }
      }
    });

    socket.on('webrtc-user-left', (data) => {
      const { socketId } = data;
      setVoiceMembers(prev => prev.filter(p => p.id !== socketId));
      const pc = peerConnectionsRef.current[socketId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[socketId];
      }
      const audio = document.getElementById(`audio-${socketId}`);
      if (audio) {
        audio.remove();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [versionId, user]);

  // Clean inactive pointer overlays
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentCollaborators = useReviewStore.getState().collaborators;
      const cleaned = {};
      Object.keys(currentCollaborators).forEach(key => {
        if (now - currentCollaborators[key].lastUpdated < 3000) {
          cleaned[key] = currentCollaborators[key];
        }
      });
      store.setCollaborators(cleaned);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // WebRTC Audio Call Helpers
  const createPeerConnection = (socketId, userName) => {
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close();
    }
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    peerConnectionsRef.current[socketId] = pc;
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let audio = document.getElementById(`audio-${socketId}`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = `audio-${socketId}`;
        audio.className = 'remote-audio';
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      audio.srcObject = remoteStream;
    };
    return pc;
  };

  const toggleVoiceChat = async () => {
    if (isVoiceActive) {
      setIsVoiceActive(false);
      setVoiceMembers([]);
      if (socketRef.current) {
        socketRef.current.emit('webrtc-leave', { versionId });
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      Object.keys(peerConnectionsRef.current).forEach(socketId => {
        peerConnectionsRef.current[socketId].close();
      });
      peerConnectionsRef.current = {};
      const audios = document.querySelectorAll('.remote-audio');
      audios.forEach(el => el.remove());
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        setIsVoiceActive(true);
        setVoiceMembers([{ id: 'local', userName: user.name }]);
        if (socketRef.current) {
          socketRef.current.emit('webrtc-join', { versionId, userName: user.name });
        }
      } catch (err) {
        alert('Could not access microphone for live review session.');
        console.error(err);
      }
    }
  };

  // Clean WebRTC connections on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.keys(peerConnectionsRef.current).forEach(socketId => {
        peerConnectionsRef.current[socketId].close();
      });
      const audios = document.querySelectorAll('.remote-audio');
      audios.forEach(el => el.remove());
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    store.clearDrawHistory();
  };

  const handleDecisionSave = async (e) => {
    e.preventDefault();
    await store.submitDecision(versionId);
  };

  if (store.loading) {
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
      
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Workspace Frame.io style */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 font-sans">
        
        {/* Header toolbar */}
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
            
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm truncate max-w-[150px]">{store.version?.video_title}</h2>
              <div className="relative group">
                <select
                  value={versionId}
                  onChange={(e) => navigate(`/review/${e.target.value}`)}
                  className={`pl-2 pr-7 py-1 text-xs font-extrabold rounded border cursor-pointer focus:outline-none appearance-none ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 text-violet-400' : 'bg-slate-50 border-slate-200 text-violet-600'
                  }`}
                >
                  {store.siblingVersions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version_number} cut</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute top-2 right-2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isVoiceActive && (
              <div className="flex items-center gap-1.5 border-r border-slate-850/30 pr-3 mr-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-bold text-slate-400">
                  Voice Room ({voiceMembers.length}): {voiceMembers.map(m => m.userName).join(', ')}
                </span>
              </div>
            )}

            <button
              onClick={toggleVoiceChat}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isVoiceActive 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-rose-500/10' 
                  : isDark 
                    ? 'bg-[#0B0F19] border-slate-800 text-slate-350 hover:text-white' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Mic className="w-4 h-4" />
              {isVoiceActive ? 'Leave Voice Review' : 'Start Voice Review'}
            </button>

            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              store.version?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
              store.version?.status === 'revision_required' ? 'bg-rose-500/10 text-rose-400' : 'bg-yellow-500/10 text-yellow-500'
            }`}>
              {store.version?.status?.replace(/_/g, ' ')}
            </span>

            {user?.role === 'client' || ['pm', 'admin'].includes(user?.role) ? (
              <button
                onClick={() => store.setIsDecisionOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/15"
              >
                <Award className="w-4 h-4" />
                Submit Decision
              </button>
            ) : null}
          </div>
        </header>

        {/* Dynamic Panels */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          
          {/* Left Panel: player, brush toolbar, post comments form */}
          <div className="flex-1 flex flex-col p-4 sm:p-8 space-y-6 overflow-y-visible lg:overflow-y-auto">
            
            <VideoPlayerSection
              versionId={versionId}
              isDark={isDark}
              BASE_URL={cleanUrl}
              videoRef={videoRef}
              compareVideoRef={compareVideoRef}
              canvasRef={canvasRef}
              playerContainerRef={playerContainerRef}
              socketRef={socketRef}
            />

            <DrawingToolbar
              versionId={versionId}
              isDark={isDark}
              onClearCanvas={clearCanvas}
            />

            {user?.role === 'client' || ['pm', 'admin'].includes(user?.role) ? (
              <CommentFormSection
                isDark={isDark}
                clearCanvas={clearCanvas}
              />
            ) : null}

          </div>

          {/* Right Panel: Revisions, AI Summary, AI Assistant Tabs */}
          <RightSidebarTabs
            videoRef={videoRef}
            user={user}
            isDark={isDark}
            BASE_URL={cleanUrl}
          />

        </div>

      </main>

      {/* SUBMIT APPROVAL DECISION MODAL */}
      {store.isDecisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl border shadow-2xl relative ${
            isDark ? 'bg-[#161D30] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <h2 className="text-lg font-bold mb-2">Submit Video review Decision</h2>
            <p className="text-xs text-slate-500 mb-4 font-medium">Log your approval or request revisions for editing staff.</p>

            <form onSubmit={handleDecisionSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Decision Status *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => store.setDecisionStatus('approved')}
                    className={`py-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      store.decisionStatus === 'approved' 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                        : 'border-slate-800 hover:bg-slate-800 text-slate-500'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Final Cut
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setDecisionStatus('revision_required')}
                    className={`py-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      store.decisionStatus === 'revision_required' 
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
                  value={store.decisionComment}
                  onChange={(e) => store.setDecisionComment(e.target.value)}
                  className={`w-full p-2.5 rounded border text-xs focus:outline-none ${
                    isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => store.setIsDecisionOpen(false)}
                  className={`px-4 py-2 rounded text-xs font-semibold border ${
                    isDark ? 'border-slate-850 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={store.savingDecision}
                  className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-lg"
                >
                  {store.savingDecision ? 'Saving...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
