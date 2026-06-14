import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { videoService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Plus, Upload, Video, Link, Check, Clipboard, Copy, Play, Calendar,
  FileVideo, AlertCircle, RefreshCw, Layers, ArrowUpRight
} from 'lucide-react';

export default function AdminVideos() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form states (new video)
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [clientName, setClientName] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [versionNumber, setVersionNumber] = useState('V1');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  // Form states (new version)
  const [activeNewVersionVideoId, setActiveNewVersionVideoId] = useState(null);
  const [newVersionNumber, setNewVersionNumber] = useState('V2');
  const [newVersionFile, setNewVersionFile] = useState(null);
  const [newVersionUploading, setNewVersionUploading] = useState(false);
  const newVersionFileRef = useRef(null);

  const [copiedId, setCopiedId] = useState(null);

  const loadVideosData = async () => {
    try {
      const projList = await projectService.getAll();
      setProjects(projList);

      // Load all videos by polling all projects
      let allVideos = [];
      for (const p of projList) {
        const vList = await videoService.getByProject(p.id);
        allVideos = [...allVideos, ...vList.map(v => ({ ...v, projectName: p.name, clientName: p.client_name }))];
      }
      setVideos(allVideos);
    } catch (err) {
      console.error('Failed to load videos data:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadVideosData();
      setLoading(false);
    };
    init();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVideosData();
    setRefreshing(false);
  };

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId);
    const proj = projects.find(p => p.id.toString() === projectId);
    if (proj) {
      setClientName(proj.client_name);
      // Auto-set deadline if exists
      if (proj.deadline) {
        setDeadline(proj.deadline.substring(0, 10));
      }
    }
  };

  // Upload Video Form Submit
  const handleUploadVideo = async (e) => {
    e.preventDefault();
    if (!selectedProjectId || !videoTitle || !videoFile || !deadline) {
      setFormError('Please fill out all required fields.');
      return;
    }

    setUploading(true);
    setFormError('');

    try {
      const formData = new FormData();
      formData.append('project_id', selectedProjectId);
      formData.append('title', videoTitle);
      formData.append('description', description);
      formData.append('version_number', versionNumber);
      formData.append('file', videoFile);
      formData.append('deadline', deadline);

      await videoService.upload(formData);

      // Reset
      setVideoTitle('');
      setDescription('');
      setVideoFile(null);
      setVersionNumber('V1');
      await loadVideosData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Video upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Upload Revision Version Submit
  const handleUploadVersion = async (e) => {
    e.preventDefault();
    if (!activeNewVersionVideoId || !newVersionNumber || !newVersionFile) return;

    setNewVersionUploading(true);
    try {
      const formData = new FormData();
      formData.append('version_number', newVersionNumber);
      formData.append('file', newVersionFile);

      await videoService.uploadVersion(activeNewVersionVideoId, formData);

      // Reset
      setNewVersionFile(null);
      setActiveNewVersionVideoId(null);
      await loadVideosData();
    } catch (err) {
      alert(err.response?.data?.error || 'Version upload failed.');
    } finally {
      setNewVersionUploading(false);
    }
  };

  const copyReviewLink = (link, versionId) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(versionId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider">Loading video repositories...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        
        {/* Header */}
        <header className={`h-16 flex items-center justify-between px-4 sm:px-8 pl-16 sm:pl-8 border-b flex-shrink-0 sticky top-0 z-10 ${
          isDark ? 'border-slate-800 bg-[#161D30]/95 backdrop-blur-md' : 'border-slate-200 bg-white/95 backdrop-blur-md'
        }`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Review Video Repository</h1>
            <p className="text-xs text-slate-500">Upload new cuts and distribute review links</p>
          </div>

          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
              isDark ? 'border-slate-800 bg-[#0B0F19] hover:bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Grid panel */}
        <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl w-full mx-auto pb-24">
          
          {/* Left: Upload Form */}
          <div className="space-y-6">
            <div className={`p-6 rounded-xl border ${
              isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <Upload className="w-4.5 h-4.5 text-violet-400" />
                Upload Video Cut
              </h3>

              {formError && (
                <div className="mb-4 p-2 rounded text-xs bg-red-500/10 border border-red-500/30 text-red-500 font-semibold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleUploadVideo} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Select Project *</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    required
                    className={`w-full px-2 py-2.5 rounded border text-xs focus:outline-none focus:ring-1 ${
                      isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="">Choose Project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {clientName && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Assigned Client</label>
                    <input
                      type="text"
                      disabled
                      value={clientName}
                      className={`w-full px-2.5 py-2 rounded border text-xs opacity-60 ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Video Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Summer Commercial Promo Cut 1"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    className={`w-full px-2.5 py-2 rounded border text-xs focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Initial Version</label>
                    <select
                      value={versionNumber}
                      onChange={(e) => setVersionNumber(e.target.value)}
                      className={`w-full px-2 py-2 rounded border text-xs focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="V1">V1</option>
                      <option value="V2">V2</option>
                      <option value="V3">V3</option>
                      <option value="Final">Final</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Deadline Date *</label>
                    <input
                      type="date"
                      required
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className={`w-full px-2 py-1.5 rounded border text-xs focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Description / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Provide version notes for editors and clients..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full p-2.5 rounded border text-xs focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* File picker */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Video Asset File *</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      isDark ? 'border-slate-800 bg-[#0B0F19]/50 hover:bg-slate-800/10' : 'border-slate-250 bg-slate-50 hover:bg-slate-100/50'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => setVideoFile(e.target.files[0])}
                      className="hidden"
                      accept=".mp4,.mov,.avi,.mkv"
                      required
                    />
                    
                    {videoFile ? (
                      <div className="flex items-center gap-1.5 text-violet-400 text-xs">
                        <FileVideo className="w-5 h-5" />
                        <span className="truncate max-w-[150px] font-bold">{videoFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <Video className="w-6 h-6 text-slate-500 mb-1" />
                        <span className="text-[10px] font-semibold text-slate-400">Select MP4, MOV, AVI, MKV</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-40"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading Asset...' : 'Upload Video cut'}
                </button>

              </form>
            </div>
          </div>

          {/* Right: Uploaded catalog list */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`p-6 rounded-xl border ${
              isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h3 className="text-sm font-bold mb-4">Video Assets Review Log</h3>

              {videos.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  No video cut assets registered in this pipeline.
                </div>
              ) : (
                <div className="space-y-4">
                  {videos.map((vid) => (
                    <div 
                      key={vid.id}
                      className={`p-4 rounded-xl border text-xs space-y-3 ${
                        isDark ? 'bg-[#0B0F19]/50 border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {/* Top metadata */}
                      <div className="flex items-center justify-between gap-4 border-b border-slate-800/10 pb-2.5">
                        <div>
                          <div className="font-bold text-sm text-violet-400">{vid.title}</div>
                          <span className="text-[10px] text-slate-500">
                            Project: {vid.projectName} &bull; Client: {vid.clientName}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setActiveNewVersionVideoId(vid.id);
                            // Suggest next version
                            const maxVer = vid.versions?.[0]?.version_number || 'V1';
                            const nextVer = maxVer.startsWith('V') 
                              ? `V${parseInt(maxVer.substring(1)) + 1}` 
                              : 'V2';
                            setNewVersionNumber(nextVer);
                          }}
                          className="px-2 py-1 rounded bg-slate-500/15 hover:bg-slate-500/25 border border-slate-800/10 font-semibold text-[10px] flex items-center gap-1"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Add Version
                        </button>
                      </div>

                      {/* Versions list */}
                      <div className="space-y-2">
                        {vid.versions?.map((ver) => (
                          <div 
                            key={ver.id}
                            className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-180'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-violet-400">{ver.version_number}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                ver.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                ver.status === 'revision_required' ? 'bg-rose-500/10 text-rose-400' : 'bg-yellow-500/10 text-yellow-500'
                              }`}>
                                {ver.status?.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 ml-auto text-[10px] font-semibold">
                              <button
                                onClick={() => navigate(`/review/${ver.id}`)}
                                className="p-1 hover:text-cyan-400 flex items-center gap-0.5"
                                title="Open Review Player"
                              >
                                Review Player <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                              
                              <button
                                onClick={() => copyReviewLink(ver.review_link, ver.id)}
                                className="p-1 hover:text-cyan-400 flex items-center gap-1.5 text-slate-500"
                                title="Copy Secure Review Link"
                              >
                                {copiedId === ver.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedId === ver.id ? 'Copied' : 'Review Link'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* inline new version upload card */}
                      {activeNewVersionVideoId === vid.id && (
                        <form onSubmit={handleUploadVersion} className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/5 mt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[10px] text-violet-400 uppercase">Upload Revision File</span>
                            <button 
                              type="button" 
                              onClick={() => setActiveNewVersionVideoId(null)}
                              className="text-slate-500 hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-1">Version tag</label>
                              <input
                                type="text"
                                value={newVersionNumber}
                                onChange={(e) => setNewVersionNumber(e.target.value)}
                                className={`w-full px-2 py-1 rounded border text-xs focus:outline-none ${
                                  isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-100 border-slate-200'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="text-[9px] font-bold text-slate-400 block mb-1">Select Video</label>
                              <input
                                type="file"
                                ref={newVersionFileRef}
                                onChange={(e) => setNewVersionFile(e.target.files[0])}
                                accept=".mp4,.mov,.avi,.mkv"
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => newVersionFileRef.current?.click()}
                                className={`w-full py-1.5 px-2 rounded border text-xs font-semibold text-center truncate ${
                                  isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-100 border-slate-200'
                                }`}
                              >
                                {newVersionFile ? newVersionFile.name : 'Choose file...'}
                              </button>
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={newVersionUploading || !newVersionFile}
                            className="w-full py-1.5 rounded bg-violet-600 hover:bg-violet-700 text-white font-bold text-[10px] disabled:opacity-40"
                          >
                            {newVersionUploading ? 'Uploading version...' : 'Submit Version'}
                          </button>
                        </form>
                      )}

                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

    </div>
  );
}
