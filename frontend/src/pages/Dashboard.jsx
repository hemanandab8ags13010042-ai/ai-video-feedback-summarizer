import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { dashboardService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Folder, ClipboardList, CheckSquare, Clock, AlertTriangle, 
  Plus, Calendar, ArrowUpRight, Check, CheckCircle2, User,
  Bell, BellOff, RefreshCw
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Dashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingReviews: 0,
    activeTasks: 0,
    completedTasks: 0,
    overdueTasks: 0
  });

  const [charts, setCharts] = useState({
    feedbackSources: [],
    productivity: [],
    categoryBreakdown: []
  });

  const [activityFeed, setActivityFeed] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [projectHealth, setProjectHealth] = useState({
    overallScore: 100,
    overallStatus: 'Healthy',
    projects: []
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // New Project Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projName, setProjName] = useState('');
  const [clientName, setClientName] = useState('');
  const [videoType, setVideoType] = useState('Commercial');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('draft');
  const [formError, setFormError] = useState('');

  const loadDashboardData = async () => {
    try {
      const dashboard = await dashboardService.getData();
      setStats(dashboard.stats);
      setCharts(dashboard.charts);
      setActivityFeed(dashboard.activityFeed);
      setNotifications(dashboard.notifications);
      setTeamWorkload(dashboard.teamWorkload);
      setProjectHealth(dashboard.projectHealth || {
        overallScore: 100,
        overallStatus: 'Healthy',
        projects: []
      });

      const projectList = await projectService.getAll();
      setProjects(projectList);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await loadDashboardData();
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await dashboardService.markNotificationsRead();
      setNotifications([]);
    } catch (err) {
      console.error('Failed to dismiss notifications:', err);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName || !clientName || !deadline) {
      setFormError('Please fill out all required fields.');
      return;
    }

    try {
      await projectService.create({
        name: projName,
        client_name: clientName,
        video_type: videoType,
        deadline,
        priority,
        status
      });

      // Reset form & reload
      setProjName('');
      setClientName('');
      setDeadline('');
      setIsModalOpen(false);
      await loadDashboardData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create project.');
    }
  };

  // --- Chart.js Data Configuration ---
  const sourceLabels = charts.feedbackSources.map(f => f.type.toUpperCase()) || [];
  const sourceCounts = charts.feedbackSources.map(f => f.count) || [];
  
  const feedbackSourcesChartData = {
    labels: sourceLabels.length > 0 ? sourceLabels : ['TEXT', 'VOICE', 'PDF'],
    datasets: [{
      label: 'Submissions',
      data: sourceCounts.length > 0 ? sourceCounts : [0, 0, 0],
      backgroundColor: isDark 
        ? ['rgba(139, 92, 246, 0.75)', 'rgba(6, 182, 212, 0.75)', 'rgba(16, 185, 129, 0.75)'] 
        : ['#8B5CF6', '#06B6D4', '#10B981'],
      borderWidth: 0,
      borderRadius: 6
    }]
  };

  const productivityLabels = charts.productivity.map(p => p.name) || [];
  const productivityCounts = charts.productivity.map(p => p.completed_count) || [];

  const teamProductivityChartData = {
    labels: productivityLabels.length > 0 ? productivityLabels : ['No data'],
    datasets: [{
      label: 'Tasks Resolved',
      data: productivityCounts.length > 0 ? productivityCounts : [0],
      backgroundColor: 'rgba(139, 92, 246, 0.75)',
      borderColor: '#8B5CF6',
      borderWidth: 1.5,
      borderRadius: 4
    }]
  };

  const catLabels = charts.categoryBreakdown.map(c => c.category?.toUpperCase()) || [];
  const catCounts = charts.categoryBreakdown.map(c => c.count) || [];

  const taskCategoryChartData = {
    labels: catLabels.length > 0 ? catLabels : ['EDITING', 'VFX'],
    datasets: [{
      data: catCounts.length > 0 ? catCounts : [0, 0],
      backgroundColor: ['#8B5CF6', '#06B6D4'],
      hoverOffset: 4,
      borderWidth: isDark ? 2 : 1,
      borderColor: isDark ? '#161D30' : '#FFF'
    }]
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider">Loading DigiQuest Studio Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        
        {/* Top Header */}
        <header className={`h-16 flex items-center justify-between px-4 sm:px-8 pl-16 sm:pl-8 border-b flex-shrink-0 ${
          isDark ? 'border-slate-800 bg-[#161D30]/50' : 'border-slate-200 bg-white'
        }`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Studio Dashboard</h1>
            <p className="text-xs text-slate-500">Welcome, {user?.name}</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
                isDark ? 'border-slate-800 bg-[#0B0F19] hover:bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {['pm', 'admin'].includes(user?.role) && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/10 transition-all"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="p-4 sm:p-8 space-y-8 max-w-7xl w-full mx-auto">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Cards */}
            <div className={`p-5 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center"><Folder className="w-5 h-5" /></div>
              <div>
                <span className="text-xs text-slate-500 block">Total Projects</span>
                <span className="text-2xl font-extrabold">{stats.totalProjects}</span>
              </div>
            </div>

            <div className={`p-5 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
              <div>
                <span className="text-xs text-slate-500 block">Pending Review</span>
                <span className="text-2xl font-extrabold">{stats.pendingReviews}</span>
              </div>
            </div>

            <div className={`p-5 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div>
              <div>
                <span className="text-xs text-slate-500 block">Active Tasks</span>
                <span className="text-2xl font-extrabold">{stats.activeTasks}</span>
              </div>
            </div>

            <div className={`p-5 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><CheckSquare className="w-5 h-5" /></div>
              <div>
                <span className="text-xs text-slate-500 block">Tasks Completed</span>
                <span className="text-2xl font-extrabold">{stats.completedTasks}</span>
              </div>
            </div>

            <div className={`p-5 rounded-xl border flex items-center gap-4 ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></div>
              <div>
                <span className="text-xs text-slate-500 block">Overdue Items</span>
                <span className="text-2xl font-extrabold text-red-500">{stats.overdueTasks}</span>
              </div>
            </div>

          </div>

          {/* Graphs Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Graph 1: Feedback Sources */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className="text-sm font-bold mb-4">Feedback Channels</h3>
              <div className="h-60 flex items-center justify-center">
                <Bar 
                  data={feedbackSourcesChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { grid: { color: isDark ? '#242F4D' : '#E2E8F0' }, ticks: { color: '#94A3B8' } },
                      x: { ticks: { color: '#94A3B8' } }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Graph 2: Team Productivity */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className="text-sm font-bold mb-4">Team Productivity (Resolved Tasks)</h3>
              <div className="h-60 flex items-center justify-center">
                <Bar 
                  data={teamProductivityChartData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { grid: { color: isDark ? '#242F4D' : '#E2E8F0' }, ticks: { color: '#94A3B8' } },
                      x: { ticks: { color: '#94A3B8' } }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Graph 3: Category splits */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <h3 className="text-sm font-bold mb-4">Task Category Distribution</h3>
              <div className="h-60 flex items-center justify-center">
                <Doughnut 
                  data={taskCategoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: '#94A3B8', boxWidth: 12 } } }
                  }}
                />
              </div>
            </div>

          </div>

          {/* Client Sentiment & Project Health Radar Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Speedometer Radial Gauge */}
            <div className={`p-6 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div>
                <h3 className="text-sm font-bold mb-1">Project Health Radar</h3>
                <p className="text-[11px] text-slate-500 mb-4">Overall workspace health calculated from client sentiments.</p>
              </div>
              <div className="flex flex-col items-center justify-center py-4 relative">
                {/* SVG Radial Gauge / Speedometer */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background track circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={isDark ? '#1E293B' : '#E2E8F0'}
                      strokeWidth="10"
                      strokeDasharray="251.2"
                      strokeDashoffset="62.8"
                      strokeLinecap="round"
                    />
                    {/* Colored gauge value */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke={
                        projectHealth.overallScore >= 70 ? '#10B981' :
                        projectHealth.overallScore >= 35 ? '#F59E0B' :
                        '#EF4444'
                      }
                      strokeWidth="10"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * 0.75 * (projectHealth.overallScore / 100))}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  
                  {/* Gauge Text overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center mt-2">
                    <span className="text-3xl font-black tracking-tight">{projectHealth.overallScore}%</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      projectHealth.overallScore >= 70 ? 'text-emerald-400' :
                      projectHealth.overallScore >= 35 ? 'text-amber-500' :
                      'text-rose-500'
                    }`}>
                      {projectHealth.overallStatus}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-around border-t border-slate-800/10 pt-4 text-center">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Healthy</span>
                  <span className="text-sm font-extrabold text-emerald-400">
                    {projectHealth.projects.filter(p => p.status === 'Healthy').length}
                  </span>
                </div>
                <div className="border-l border-slate-800/10 h-8 font-bold"></div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">At Risk</span>
                  <span className="text-sm font-extrabold text-amber-500">
                    {projectHealth.projects.filter(p => p.status === 'At Risk').length}
                  </span>
                </div>
                <div className="border-l border-slate-800/10 h-8 font-bold"></div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Critical</span>
                  <span className="text-sm font-extrabold text-rose-500">
                    {projectHealth.projects.filter(p => p.status === 'Critical').length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Project Sentiments Breakdown Table/List */}
            <div className={`lg:col-span-2 p-6 rounded-xl border flex flex-col justify-between ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div>
                <h3 className="text-sm font-bold mb-1">Project Sentiment Details</h3>
                <p className="text-[11px] text-slate-500 mb-4">Detailed sentiment ratios based on client revision feedback loops.</p>
                
                {projectHealth.projects.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">No projects sentiment data analyzed.</p>
                ) : (
                  <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                    {projectHealth.projects.map((proj) => (
                      <div key={proj.projectId} className="flex flex-col gap-1.5 p-3 rounded-lg bg-slate-500/5 border border-slate-800/5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-violet-400">{proj.projectName}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            proj.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                            proj.status === 'At Risk' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-rose-500/10 text-rose-500'
                          }`}>
                            Score: {proj.healthScore}% ({proj.status})
                          </span>
                        </div>
                        
                        {/* Sentiment ratios bar */}
                        <div className="flex items-center gap-2">
                          <div className="flex-grow h-2 rounded-full overflow-hidden bg-slate-800 flex">
                            {proj.totalFeedbackCount > 0 ? (
                              <>
                                <div 
                                  className="h-full bg-emerald-500 transition-all" 
                                  style={{ width: `${(proj.positiveCount / proj.totalFeedbackCount) * 100}%` }}
                                  title={`Positive: ${proj.positiveCount}`}
                                />
                                <div 
                                  className="h-full bg-slate-500 transition-all" 
                                  style={{ width: `${(proj.neutralCount / proj.totalFeedbackCount) * 100}%` }}
                                  title={`Neutral: ${proj.neutralCount}`}
                                />
                                <div 
                                  className="h-full bg-rose-500 transition-all" 
                                  style={{ width: `${(proj.negativeCount / proj.totalFeedbackCount) * 100}%` }}
                                  title={`Negative: ${proj.negativeCount}`}
                                />
                              </>
                            ) : (
                              <div className="h-full w-full bg-emerald-500/30" title="No feedback (Assumed Healthy)" />
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap min-w-[70px] text-right">
                            {proj.totalFeedbackCount > 0 
                              ? `+${proj.positiveCount} | =${proj.neutralCount} | -${proj.negativeCount}`
                              : 'No Feedback'
                            }
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
          </div>

          {/* Project Directory */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Active Projects List */}
            <div className={`lg:col-span-2 p-6 rounded-xl border flex flex-col justify-between ${
              isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div>
                <h3 className="text-sm font-bold mb-4">Active Project Directory</h3>
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No projects in this pipeline yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800/20 text-slate-500">
                          <th className="pb-3.5 font-semibold">Project Name</th>
                          <th className="pb-3.5 font-semibold">Client</th>
                          <th className="pb-3.5 font-semibold">Timeline Due</th>
                          <th className="pb-3.5 font-semibold text-center">Status</th>
                          <th className="pb-3.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((proj) => (
                          <tr key={proj.id} className="border-b border-slate-800/10 last:border-b-0 hover:bg-slate-500/5 transition-colors">
                            <td className="py-3.5 font-bold text-violet-400">{proj.name}</td>
                            <td className="py-3.5 text-slate-400">{proj.client_name}</td>
                            <td className="py-3.5 text-xs">
                              {proj.deadline ? new Date(proj.deadline).toLocaleDateString() : 'No Date'}
                            </td>
                            <td className="py-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                proj.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                proj.status === 'review' ? 'bg-yellow-500/10 text-yellow-500' :
                                proj.status === 'editing' ? 'bg-violet-500/10 text-violet-400' : 'bg-slate-500/10 text-slate-400'
                              }`}>
                                {proj.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => navigate(`/project/${proj.id}`)}
                                className={`p-1.5 rounded hover:bg-violet-600 hover:text-white transition-all text-xs font-semibold flex items-center gap-1 ml-auto ${
                                  isDark ? 'text-slate-400' : 'text-slate-600'
                                }`}
                              >
                                Workspace <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications Widget & Activity Feed */}
            <div className="space-y-6">
              
              {/* Notifications Card */}
              <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-cyan-400" />
                    System Alerts
                  </h3>
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleMarkNotificationsRead}
                      className="text-[10px] font-bold text-violet-400 hover:underline flex items-center gap-0.5"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500">
                    <BellOff className="w-6 h-6 opacity-30 mb-2" />
                    <span className="text-xs">No unread alerts.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {notifications.map((notif) => (
                      <div key={notif.id} className={`p-3 rounded-lg border text-xs ${
                        isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="font-bold text-violet-400">{notif.title}</div>
                        <div className="text-slate-400 mt-1">{notif.message}</div>
                        <span className="text-[9px] text-slate-500 block mt-1.5">
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity Feed Widget */}
              <div className={`p-6 rounded-xl border ${isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                <h3 className="text-sm font-bold mb-4">Recent Activity Feed</h3>
                {activityFeed.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No studio events registered.</p>
                ) : (
                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                    {activityFeed.map((act) => (
                      <div key={act.id} className="flex gap-3 text-xs leading-normal">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0 mt-1.5"></div>
                        <div>
                          <div className="font-semibold">{act.user_name}</div>
                          <p className="text-slate-400 mt-0.5">{act.description}</p>
                          <span className="text-[9px] text-slate-500">{new Date(act.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* CREATE PROJECT DIALOG MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl border shadow-2xl relative ${
            isDark ? 'bg-[#161D30] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <h2 className="text-lg font-bold mb-2">Create New Video Project</h2>
            <p className="text-xs text-slate-500 mb-4">Initialize a project pipeline card to summarize client feedback.</p>

            {formError && (
              <div className="mb-4 p-2.5 rounded text-xs bg-red-500/10 border border-red-500/30 text-red-500 font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Summer VFX Promo Trailer"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 focus:border-violet-500 focus:ring-violet-500' : 'bg-slate-50 border-slate-200 focus:border-violet-500 focus:ring-violet-500'
                  }`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Client User (must match client login name)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 ${
                    isDark ? 'bg-[#0B0F19] border-slate-800 focus:border-violet-500 focus:ring-violet-500' : 'bg-slate-50 border-slate-200 focus:border-violet-500 focus:ring-violet-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Video Type</label>
                  <select
                    value={videoType}
                    onChange={(e) => setVideoType(e.target.value)}
                    className={`w-full px-2 py-2 rounded border text-sm focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="Commercial">Commercial</option>
                    <option value="Short Film">Short Film</option>
                    <option value="Music Video">Music Video</option>
                    <option value="VFX Shot">VFX Shot</option>
                    <option value="Feature Film">Feature Film</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className={`w-full px-2 py-2 rounded border text-sm focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Deadline Date *</label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={`w-full px-2 py-2 rounded border text-sm focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`w-full px-2 py-2 rounded border text-sm focus:outline-none ${
                      isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Review</option>
                    <option value="editing">Editing</option>
                    <option value="vfx">VFX</option>
                    <option value="approval">Approval</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={`px-4 py-2 rounded text-xs font-semibold border ${
                    isDark ? 'border-slate-850 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-lg shadow-violet-500/15"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
