import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { taskService, authService, projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Plus, Calendar, User, Clock, Check, X, ClipboardList,
  AlertCircle, MessageSquare, ChevronDown, RefreshCw
} from 'lucide-react';

export default function KanbanBoard() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Edit task form states
  const [assignedTo, setAssignedTo] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [taskHours, setTaskHours] = useState('');
  const [auditComment, setAuditComment] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const columns = [
    { id: 'new', title: 'New', color: 'bg-slate-500/10 text-slate-400 border-slate-500/25' },
    { id: 'assigned', title: 'Assigned', color: 'bg-violet-500/10 text-violet-400 border-violet-500/25' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25' },
    { id: 'review', title: 'Review', color: 'bg-amber-500/10 text-amber-400 border-amber-500/25' },
    { id: 'completed', title: 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' }
  ];

  const fetchKanbanData = async () => {
    try {
      const taskList = await taskService.getAll();
      setTasks(taskList);

      // Fetch users for assignees dropdown
      const userList = await authService.getUsers();
      setTeamMembers(userList.filter(u => ['editor', 'vfx_artist', 'admin', 'pm'].includes(u.role)));

      const projectList = await projectService.getAll();
      setProjects(projectList);
    } catch (err) {
      console.error('Failed to load Kanban data:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchKanbanData();
      setLoading(false);
    };
    init();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchKanbanData();
    setRefreshing(false);
  };

  // --- HTML5 Native Drag & Drop Handlers ---
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    // Find the task
    const taskToMove = tasks.find(t => t.id.toString() === taskId);
    if (!taskToMove || taskToMove.status === columnId) return;

    // Optimistically update status locally
    setTasks(prev => prev.map(t => t.id.toString() === taskId ? { ...t, status: columnId } : t));

    try {
      await taskService.update(taskId, {
        status: columnId,
        comment: `Task moved to "${columnId.toUpperCase()}" via Kanban Drag-and-Drop.`
      });
      await fetchKanbanData(); // Refresh to fetch history & verify DB consistency
    } catch (err) {
      console.error('Failed to update task column status:', err);
      await fetchKanbanData(); // Revert on failure
    }
  };

  // --- Modal Edit & Audit Trail ---
  const handleOpenTaskDetails = async (task) => {
    setActiveTask(task);
    setAssignedTo(task.assigned_to || '');
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskHours(task.effort_hours || 0);
    setAuditComment('');
    setTaskHistory([]);
    setIsModalOpen(true);
    setModalLoading(true);

    try {
      const history = await taskService.getHistory(task.id);
      setTaskHistory(history);
    } catch (err) {
      console.error('Failed to fetch task audit logs:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveTaskDetails = async (e) => {
    e.preventDefault();
    if (!activeTask) return;

    setModalLoading(true);
    try {
      await taskService.update(activeTask.id, {
        status: taskStatus,
        assigned_to: assignedTo || null,
        priority: taskPriority,
        effort_hours: parseFloat(taskHours) || 0,
        comment: auditComment || 'Task details modified.'
      });

      setIsModalOpen(false);
      await fetchKanbanData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update task.');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wider">Loading Kanban Boards...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Board Container */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Header */}
        <header className={`h-16 flex items-center justify-between px-8 border-b flex-shrink-0 ${
          isDark ? 'border-slate-800 bg-[#161D30]/50' : 'border-slate-200 bg-white'
        }`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Studio Kanban Workspace</h1>
            <p className="text-xs text-slate-500">Drag cards to update revision status</p>
          </div>

          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
              isDark ? 'border-slate-800 bg-[#0B0F19] hover:bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="Refresh Kanban"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Board Workspace */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-8 flex gap-6 items-start">
          
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div 
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`w-80 flex-shrink-0 rounded-xl border flex flex-col max-h-full ${
                  isDark ? 'bg-[#161D30]/40 border-slate-800' : 'bg-slate-100 border-slate-200 shadow-sm'
                }`}
              >
                
                {/* Column Title Header */}
                <div className={`p-4 border-b flex items-center justify-between ${
                  isDark ? 'border-slate-850' : 'border-slate-200'
                }`}>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${col.color}`}>
                    {col.title}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">{colTasks.length}</span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
                  {colTasks.length === 0 ? (
                    <div className="h-24 border border-dashed border-slate-800/10 rounded-lg flex items-center justify-center text-[10px] text-slate-500 font-semibold uppercase">
                      Drop cards here
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => handleOpenTaskDetails(task)}
                        className={`p-4 rounded-xl border cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:shadow-lg transition-all text-left ${
                          isDark 
                            ? 'bg-[#161D30] border-slate-800 hover:border-violet-500/30' 
                            : 'bg-white border-slate-200 hover:shadow-slate-200/50 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                            task.category === 'vfx' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-violet-500/10 text-violet-400'
                          }`}>
                            {task.category}
                          </span>
                          <span className={`px-1 rounded text-[8px] font-bold uppercase ${
                            task.priority === 'high' ? 'text-red-500' : 'text-slate-500'
                          }`}>
                            {task.priority}
                          </span>
                        </div>

                        <div className="font-bold text-xs leading-snug truncate-2-lines">{task.title}</div>
                        <div className="text-[10px] text-slate-500 mt-2 truncate font-semibold">Proj: {task.project_name}</div>
                        
                        <div className="flex items-center justify-between mt-3.5 border-t border-slate-800/5 pt-2.5 text-[10px] text-slate-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {task.effort_hours}h
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-violet-400" />
                            {task.assignee_name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            );
          })}

        </div>
      </main>

      {/* TASK DETAILS MODAL & AUDIT TIMELINE DRAWER */}
      {isModalOpen && activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl p-6 rounded-xl border shadow-2xl relative grid grid-cols-1 md:grid-cols-5 gap-6 ${
            isDark ? 'bg-[#161D30] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            
            {/* Left side: Task configurations */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-800/20">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    activeTask.category === 'vfx' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-violet-500/10 text-violet-400'
                  }`}>
                    {activeTask.category} Task
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">ID: #{activeTask.id}</span>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className={`p-1 rounded hover:bg-slate-500/10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <h3 className="font-extrabold text-sm">{activeTask.title}</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed bg-[#0B0F19]/30 p-2.5 rounded border border-slate-850">
                  {activeTask.description || 'No description provided.'}
                </p>
              </div>

              <form onSubmit={handleSaveTaskDetails} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Assignee</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className={`w-full px-2 py-2 rounded border text-xs focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Status</label>
                    <select
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value)}
                      className={`w-full px-2 py-2 rounded border text-xs focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="new">New</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className={`w-full px-2 py-2 rounded border text-xs focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Est. Effort (Hours)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={taskHours}
                      onChange={(e) => setTaskHours(e.target.value)}
                      className={`w-full px-2 py-1.5 rounded border text-xs focus:outline-none ${
                        isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Audit Comment (Status updates / Progress log) *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Completed object painting on rig sequence."
                    value={auditComment}
                    onChange={(e) => setAuditComment(e.target.value)}
                    className={`w-full px-3 py-2 rounded border text-xs focus:outline-none focus:border-violet-500 ${
                      isDark ? 'bg-[#0B0F19] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={`px-4 py-2 rounded text-xs font-semibold border ${
                      isDark ? 'border-slate-850 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-2 rounded bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-lg"
                  >
                    {modalLoading ? 'Saving...' : 'Update Details'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right side: History trail */}
            <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-slate-800/20 pt-4 md:pt-0 md:pl-4 flex flex-col max-h-[400px]">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3.5">Status History Audit</h4>
              
              {taskHistory.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-[10px] text-slate-500 font-semibold uppercase">
                  No audit logs.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {taskHistory.map((h) => (
                    <div key={h.id} className="text-xs leading-normal">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-violet-400">
                        <span>{h.old_status}</span>
                        <span className="text-slate-500 font-normal">&rarr;</span>
                        <span>{h.new_status}</span>
                      </div>
                      <p className="text-slate-300 italic mt-0.5 font-medium">"{h.comment}"</p>
                      <div className="text-[9px] text-slate-500 mt-1 font-semibold">
                        {h.user_name} ({h.user_role}) &bull; {new Date(h.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
