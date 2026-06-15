import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { projectService, feedbackService, taskService, videoService, BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  FileText, FileVideo, Upload, Sparkles, User, Clock, AlertCircle,
  AlertTriangle, CheckSquare, MessageSquare, ArrowLeft,
  ChevronRight, Mic, Play, Check, Send, X, ShieldAlert, Square
} from 'lucide-react';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Project states
  const [project, setProject] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [aiResults, setAiResults] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload feedback states
  const [textFeedback, setTextFeedback] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(1);
  const fileInputRef = useRef(null);

  // Voice recording states
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);



  // Load all project details
  const fetchProjectData = async () => {
    try {
      const data = await projectService.getById(id);
      setProject(data.project);
      setFeedbackList(data.feedback);
      setTasks(data.tasks);
      setAiResults(data.aiResults);
      setActivityLogs(data.activityLogs);
      
      const vList = await videoService.getByProject(id);
      setVideos(vList);
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchProjectData();
      setLoading(false);
    };
    init();
  }, [id]);



  // Drag-and-drop actions
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0]);
    }
  };

  // Voice Recording Logic for General Feedback
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
        const voiceFile = new File([audioBlob], 'voice_feedback.wav', { type: 'audio/wav' });
        setUploadFile(voiceFile);
        setTextFeedback(prev => prev || '[Voice Feedback Note recorded]');
      };

      mediaRecorderRef.current.start();
      setIsVoiceRecording(true);
    } catch (e) {
      // Fallback simulated voice note
      setIsVoiceRecording(true);
      setTimeout(() => {
        const audioBlob = new Blob(['simulated voice data'], { type: 'audio/wav' });
        const voiceFile = new File([audioBlob], 'voice_feedback.wav', { type: 'audio/wav' });
        setUploadFile(voiceFile);
        setIsVoiceRecording(false);
        setTextFeedback(prev => prev || '[Simulated Voice Feedback Note]');
      }, 3000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isVoiceRecording) {
      mediaRecorderRef.current.stop();
      setIsVoiceRecording(false);
    }
  };

  // Submit Feedback to AI
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!textFeedback && !uploadFile) return;

    setAnalyzing(true);
    setAnalysisStep(1);

    // Simulated analyzer loading timeline steps
    const timer1 = setTimeout(() => setAnalysisStep(2), 1500);
    const timer2 = setTimeout(() => setAnalysisStep(3), 3200);
    const timer3 = setTimeout(() => setAnalysisStep(4), 5000);
    const timer4 = setTimeout(() => setAnalysisStep(5), 6500);

    try {
      await feedbackService.analyze(id, textFeedback, null, uploadFile);
      
      // Clear forms
      setTextFeedback('');
      setUploadFile(null);
      
      // Refresh project records
      await fetchProjectData();
    } catch (err) {
      alert(err.response?.data?.error || 'Analysis failed. Make sure server is running.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      setAnalyzing(false);
    }
  };



  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider">Loading project pipeline...</span>
        </div>
      </div>
    );
  }

  const activeAI = aiResults[0] || null;

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0 relative">
        
        {/* Workspace Header */}
        <header className={`h-16 flex items-center justify-between px-4 sm:px-8 pl-16 sm:pl-8 border-b flex-shrink-0 sticky top-0 z-20 ${
          isDark ? 'border-slate-800 bg-[#161D30]/90 backdrop-blur-md' : 'border-slate-200 bg-white/90 backdrop-blur-md'
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
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">{project?.name}</h1>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  project?.priority === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'
                }`}>
                  {project?.priority}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Client: {project?.client_name} &bull; Pipeline: {project?.status}</p>
            </div>
          </div>

          <button
            onClick={() => window.dispatchEvent(new Event('toggle-ai-chat'))}
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/10 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            AI Assistant
          </button>
        </header>

        {/* Content Workspace Area */}
        <div className="p-4 sm:p-8 space-y-8 max-w-6xl w-full mx-auto pb-24">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Submit feedback / Feedback logs */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Feedback Upload Area */}
              {user?.role === 'client' || ['pm', 'admin'].includes(user?.role) ? (
                <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <h3 className="text-sm font-bold flex items-center gap-1.5 mb-4">
                    <Sparkles className="w-4.5 h-4.5 text-violet-400" />
                    Submit Revisions & Video Feedback
                  </h3>

                  <form onSubmit={handleSubmitFeedback} className="space-y-4">
                    <div>
                      <textarea
                        value={textFeedback}
                        onChange={(e) => setTextFeedback(e.target.value)}
                        rows={4}
                        placeholder="E.g. Cut the scene at 0:15 where the green screen halo is visible, and please fix the colors. Make the LUT warmer."
                        className={`w-full p-3.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:border-violet-500 focus:ring-violet-500 transition-all ${
                          isDark ? 'bg-[#0B0F19] border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
                        className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                          isVoiceRecording 
                            ? 'bg-rose-500 text-white animate-pulse border border-rose-500 shadow-rose-500/20' 
                            : isDark ? 'bg-[#0B0F19] hover:bg-slate-850 text-slate-400 border border-slate-850' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isVoiceRecording ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-white" />
                            Stop Recording Voice Note
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            Record Voice Feedback Note
                          </>
                        )}
                      </button>
                      <span className="text-[10px] text-slate-500">Or drag files below:</span>
                    </div>

                    {/* Drag-and-drop uploader */}
                    <div 
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragActive 
                          ? 'border-violet-500 bg-violet-500/5' 
                          : isDark ? 'border-slate-800 bg-[#0B0F19]/50 hover:bg-slate-800/10' : 'border-slate-250 bg-slate-50 hover:bg-slate-100/50'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange}
                        className="hidden" 
                        accept=".pdf,.docx,.txt,.mp3,.wav"
                      />
                      
                      {uploadFile ? (
                        <div className="flex flex-col gap-2 w-full text-violet-400" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Mic className="w-5 h-5 text-cyan-400" />
                            <div className="text-xs font-bold truncate max-w-xs">{uploadFile.name}</div>
                            <button 
                              type="button" 
                              onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                              className="p-1 hover:text-red-500 ml-auto"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {uploadFile.name === 'voice_feedback.wav' && (
                            <audio 
                              controls 
                              src={URL.createObjectURL(uploadFile)} 
                              className="w-full h-7 mt-1 accent-cyan-400"
                            />
                          )}
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-slate-500 mb-2" />
                          <span className="text-xs font-semibold">Drag & Drop Review Files Here</span>
                          <span className="text-[10px] text-slate-500 mt-1">Supported: PDF, DOCX, TXT, MP3, WAV (Max 10MB)</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={analyzing || (!textFeedback && !uploadFile)}
                        className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/10 transition-colors disabled:opacity-40"
                      >
                        <Sparkles className="w-4 h-4" />
                        {analyzing ? 'Analyzing Feedback...' : 'Run AI Analysis'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* AI Analysis Output Workspace */}
              {activeAI ? (
                <div className={`p-6 rounded-xl border relative overflow-hidden ${
                  isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="flex items-center justify-between border-b pb-4 mb-5 border-slate-800/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                      <h3 className="font-bold text-sm">Active AI Analysis Output</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        activeAI.priority_detected === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {activeAI.priority_detected} priority
                      </span>
                      <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {activeAI.effort_estimate}h est. effort
                      </span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Summary paragraph */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Project Summary</h4>
                      <p className="text-sm leading-relaxed">{activeAI.summary}</p>
                    </div>

                    {/* Risk indicator */}
                    {activeAI.suggestions && activeAI.suggestions.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/35 text-amber-500 text-xs flex gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <div className="font-bold">AI Risk Assessment:</div>
                          <p className="mt-0.5">{activeAI.suggestions[0]}</p>
                        </div>
                      </div>
                    )}

                    {/* Auto Generated Checklist */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Final Delivery Checklist</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {activeAI.checklist.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded bg-slate-500/5 text-xs">
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Auto-extracted tasks catalog */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-800/10 pt-5">
                      <div>
                        <h4 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-3">Editing Tasks</h4>
                        <div className="space-y-3">
                          {activeAI.editing_tasks.length === 0 ? (
                            <span className="text-xs text-slate-500">None detected.</span>
                          ) : (
                            activeAI.editing_tasks.map((t, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="font-bold">{t.title}</div>
                                <div className="text-slate-400 mt-1">{t.description}</div>
                                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-semibold">
                                  <span>Assignee: {t.suggested_assignee_name || 'Unassigned'}</span>
                                  <span>&bull;</span>
                                  <span>{t.hours} hrs</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">VFX Tasks</h4>
                        <div className="space-y-3">
                          {activeAI.vfx_tasks.length === 0 ? (
                            <span className="text-xs text-slate-500">None detected.</span>
                          ) : (
                            activeAI.vfx_tasks.map((t, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border text-xs ${isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="font-bold">{t.title}</div>
                                <div className="text-slate-400 mt-1">{t.description}</div>
                                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-semibold">
                                  <span>Assignee: {t.suggested_assignee_name || 'Unassigned'}</span>
                                  <span>&bull;</span>
                                  <span>{t.hours} hrs</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className={`p-10 rounded-xl border border-dashed flex flex-col items-center justify-center text-center ${
                  isDark ? 'bg-[#161D30]/30 border-slate-800 text-slate-500' : 'bg-slate-50/50 border-slate-250 text-slate-500'
                }`}>
                  <Sparkles className="w-10 h-10 opacity-30 mb-3" />
                  <div className="font-bold text-sm">No Active AI Analyses</div>
                  <p className="text-xs max-w-sm mt-1">Submit text feedback or record voice comments above. Gemini will parse and structure tasks automatically.</p>
                </div>
              )}

              {/* Task Cards Inventory */}
              <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold">Auto-Populated Tasks Inventory</h3>
                  <button 
                    onClick={() => navigate('/kanban')}
                    className="text-xs font-bold text-violet-400 hover:underline flex items-center gap-0.5"
                  >
                    Open Kanban <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Tasks list empty. Analyze feedback to automatically generate cards.</p>
                ) : (
                  <div className="divide-y divide-slate-800/10">
                    {tasks.map((task) => (
                      <div key={task.id} className="py-3.5 flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{task.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              task.category === 'vfx' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-violet-500/10 text-violet-400'
                            }`}>
                              {task.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-normal max-w-md">{task.description}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase ${
                            task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                          }`}>
                            {task.status}
                          </span>
                          <span className="text-slate-500 text-[10px]">{task.assignee_name || 'Unassigned'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Feedback logs & Activity logs */}
            <div className="space-y-8">

              {/* Video Cuts for Review */}
              <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-2 mb-4 border-b border-slate-800/10 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center text-violet-400">
                    <FileVideo className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Video Cuts for Review</h3>
                    <p className="text-[10px] text-slate-500">Click a version cut to view, draw annotations and submit feedback.</p>
                  </div>
                </div>

                {videos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No video cuts uploaded for review yet.</p>
                ) : (
                  <div className="space-y-4">
                    {videos.map((vid) => (
                      <div key={vid.id} className="space-y-2">
                        <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Play className="w-3 h-3 text-violet-400 fill-violet-400/20" />
                          {vid.title}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {vid.versions && vid.versions.map((ver) => (
                            <button
                              key={ver.id}
                              onClick={() => navigate(`/review/${ver.id}`)}
                              className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all group/vercard ${
                                isDark 
                                  ? 'bg-[#0B0F19] border-slate-850 hover:border-violet-500/50 hover:bg-[#0E1527]' 
                                  : 'bg-slate-50 border-slate-200 hover:border-violet-500/50 hover:bg-slate-100/50'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="font-extrabold text-xs text-violet-400 group-hover/vercard:text-violet-300">
                                  {ver.version_number}
                                </span>
                                <span className={`w-2 h-2 rounded-full ${
                                  ver.status === 'approved' ? 'bg-emerald-500' :
                                  ver.status === 'revision_required' ? 'bg-rose-500' : 'bg-amber-500'
                                }`} title={ver.status.replace(/_/g, ' ')} />
                              </div>
                              <span className="text-[9px] text-slate-500 font-semibold block">
                                {new Date(ver.created_at).toLocaleDateString()}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Feedback History Logs */}
              <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className="text-sm font-bold mb-4">Feedback History Pipeline</h3>
                {feedbackList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No submissions recorded.</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                    {feedbackList.map((feed) => (
                      <div key={feed.id} className={`p-3.5 rounded-lg border text-xs ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-220'
                      }`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-semibold text-violet-400">{feed.submitter_name}</span>
                          <span className="text-[9px] text-slate-500">{new Date(feed.created_at).toLocaleDateString()}</span>
                        </div>
                        {feed.content && <p className="text-slate-300 leading-normal mb-2 italic">"{feed.content}"</p>}
                        
                        {feed.file_url && (
                          <div className="flex items-center gap-1.5 p-2 rounded bg-slate-500/5 mt-2 text-[10px]">
                            {feed.type === 'voice' ? <Mic className="w-3.5 h-3.5 text-cyan-400" /> : <FileText className="w-3.5 h-3.5 text-yellow-500" />}
                            <a 
                              href={feed.file_url.startsWith('http') ? feed.file_url : `${BASE_URL}${feed.file_url}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline truncate max-w-[150px] font-bold"
                            >
                              Download {feed.type} file
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Audit Timeline */}
              <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className="text-sm font-bold mb-4">Project Audit Logs</h3>
                {activityLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No log trails.</p>
                ) : (
                  <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="text-xs leading-normal">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{log.activity_type}</div>
                        <p className="mt-0.5 text-slate-400">{log.description}</p>
                        <span className="text-[9px] text-slate-500">{new Date(log.created_at).toLocaleString()} &bull; {log.user_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

        {/* AI LOADING OVERLAY WIZARD */}
        {analyzing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm text-center">
            <div className={`w-full max-w-sm p-8 rounded-xl border shadow-2xl relative ${
              isDark ? 'bg-[#161D30] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <div className="w-14 h-14 border-4 border-t-violet-500 border-r-transparent border-b-cyan-500 border-l-transparent rounded-full animate-spin mx-auto mb-6"></div>
              
              <h3 className="font-extrabold text-base mb-1.5">Gemini Feedback Scanner Active</h3>
              <p className="text-xs text-slate-500 mb-6">Processing media, mapping revision parameters...</p>

              {/* Wizard Steps */}
              <div className="space-y-3 text-left max-w-xs mx-auto text-xs font-medium">
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${analysisStep >= 1 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {analysisStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className={analysisStep >= 1 ? 'text-slate-100 font-bold' : 'text-slate-500'}>Ingesting raw feedback buffer</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${analysisStep >= 2 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {analysisStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <span className={analysisStep >= 2 ? 'text-slate-100 font-bold' : 'text-slate-500'}>Running audio-transcription details</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${analysisStep >= 3 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {analysisStep > 3 ? <Check className="w-3.5 h-3.5" /> : '3'}
                  </div>
                  <span className={analysisStep >= 3 ? 'text-slate-100 font-bold' : 'text-slate-500'}>Extracting color vs VFX adjustment requests</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${analysisStep >= 4 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {analysisStep > 4 ? <Check className="w-3.5 h-3.5" /> : '4'}
                  </div>
                  <span className={analysisStep >= 4 ? 'text-slate-100 font-bold' : 'text-slate-500'}>Matching team assignment workload</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${analysisStep >= 5 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    '5'
                  </div>
                  <span className={analysisStep >= 5 ? 'text-slate-100 font-bold animate-pulse' : 'text-slate-500'}>Populating Kanban cards...</span>
                </div>
              </div>
            </div>
          </div>
        )}



      </main>

    </div>
  );
}
