import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { feedbackService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  History, Search, Filter, Mic, FileText, ChevronRight,
  Download, Calendar, Sparkles, RefreshCw
} from 'lucide-react';

export default function HistoryPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [feedbacks, setFeedbacks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');

  const fetchHistoryData = async () => {
    try {
      const historyList = await feedbackService.getHistory();
      setFeedbacks(historyList);

      const projectList = await projectService.getAll();
      setProjects(projectList);
    } catch (err) {
      console.error('Failed to load feedback history:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchHistoryData();
      setLoading(false);
    };
    init();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistoryData();
    setRefreshing(false);
  };

  // Filtered List
  const filteredFeedbacks = feedbacks.filter(f => {
    const matchesSearch = 
      (f.project_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.content?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.submitter_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.summary?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProject = selectedProject === 'all' || f.project_id.toString() === selectedProject;

    return matchesSearch && matchesProject;
  });

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider">Loading Feedback Archives...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        
        {/* Header */}
        <header className={`h-16 flex items-center justify-between px-8 border-b flex-shrink-0 sticky top-0 z-10 ${
          isDark ? 'border-slate-800 bg-[#161D30]/90 backdrop-blur-md' : 'border-slate-200 bg-white/90 backdrop-blur-md'
        }`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">AI Feedback Archives</h1>
            <p className="text-xs text-slate-500">History of all submissions and generated AI action sheets</p>
          </div>

          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
              isDark ? 'border-slate-800 bg-[#0B0F19] hover:bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Refresh Archives"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Filter bar and list */}
        <div className="p-8 space-y-6 max-w-6xl w-full mx-auto pb-20">
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            
            {/* Search */}
            <div className="relative flex-1 w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search summaries, client keywords, projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:border-violet-500 focus:ring-violet-500 transition-colors ${
                  isDark ? 'bg-[#161D30] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                }`}
              />
            </div>

            {/* Project filter */}
            <div className="relative w-full sm:w-64 flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:border-violet-500 focus:ring-violet-500 transition-colors ${
                  isDark ? 'bg-[#161D30] border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Results List */}
          {filteredFeedbacks.length === 0 ? (
            <div className={`p-16 rounded-xl border border-dashed text-center text-slate-500 ${
              isDark ? 'bg-[#161D30]/30 border-slate-800' : 'bg-white border-slate-250'
            }`}>
              <History className="w-10 h-10 opacity-30 mx-auto mb-3" />
              <div className="font-bold text-sm">No Matching Feedback Logs</div>
              <p className="text-xs max-w-sm mx-auto mt-1">Adjust your search strings or verify that client feedback files have been analyzed on the project page.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredFeedbacks.map((item) => (
                <div 
                  key={item.id}
                  className={`p-6 rounded-xl border transition-all ${
                    isDark ? 'bg-[#161D30] border-slate-800 hover:border-slate-750' : 'bg-white border-slate-200 hover:shadow-md'
                  }`}
                >
                  {/* Top metadata row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/10 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-violet-400">{item.project_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          item.priority_detected === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {item.priority_detected || 'medium'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Submitted by: {item.submitter_name} &bull; Channel: {item.type?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.effort_estimate > 0 && (
                        <span>Est: {item.effort_estimate} hrs</span>
                      )}
                    </div>
                  </div>

                  {/* Analysis details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Summary */}
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">AI Executive Summary</h4>
                        <p className="text-xs leading-relaxed text-slate-300 bg-[#0B0F19]/40 p-3 rounded border border-slate-850">
                          {item.summary || 'Summary not populated.'}
                        </p>
                      </div>

                      {item.content && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Raw Client Comments</h4>
                          <p className="text-xs text-slate-400 italic">"{item.content}"</p>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions / Deliverables */}
                    <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                      isDark ? 'bg-[#0B0F19]/50 border-slate-850' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Extracted Task Count</h4>
                        <div className="space-y-1.5 text-xs font-semibold">
                          <div className="flex items-center justify-between text-violet-400">
                            <span>Editing Tasks:</span>
                            <span>{item.editing_tasks?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-cyan-400">
                            <span>VFX Tasks:</span>
                            <span>{item.vfx_tasks?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-emerald-400">
                            <span>Checklist Items:</span>
                            <span>{item.checklist?.length || 0}</span>
                          </div>
                        </div>
                      </div>

                      {item.file_url && (
                        <div className="border-t border-slate-800/20 pt-3.5 mt-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                              {item.type === 'voice' ? <Mic className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                              Media file
                            </span>
                            <a 
                              href={item.file_url.startsWith('http') ? item.file_url : `http://localhost:5000${item.file_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 font-bold hover:underline flex items-center gap-0.5"
                            >
                              Download <Download className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
