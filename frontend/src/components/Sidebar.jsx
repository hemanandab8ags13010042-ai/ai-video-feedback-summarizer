import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, Kanban, BarChart3, History, LogOut, 
  Video, Sun, Moon, ShieldAlert, UserCheck, Menu, X,
  Sparkles, Send, MessageSquare, ChevronDown
} from 'lucide-react';
import { feedbackService } from '../services/api';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);

  // Load chat state from localStorage
  const [isChatOpen, setIsChatOpen] = useState(() => {
    return localStorage.getItem('digiquest_chat_open') === 'true';
  });

  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('digiquest_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      { role: 'assistant', content: `Hi ${user?.name || 'there'}! I'm your DigiQuest Assistant. Ask me anything about your video feedback, revisions, or project statuses!` }
    ];
  });
  const [chatLoading, setChatLoading] = useState(false);

  // Sync open state to localStorage
  useEffect(() => {
    localStorage.setItem('digiquest_chat_open', isChatOpen);
    if (isChatOpen) {
      setTimeout(scrollToBottom, 50);
    }
  }, [isChatOpen]);

  // Sync chat history to localStorage
  useEffect(() => {
    localStorage.setItem('digiquest_chat_history', JSON.stringify(chatHistory));
    setTimeout(scrollToBottom, 50);
  }, [chatHistory]);

  // Window event listeners for global toggle/open controls
  useEffect(() => {
    const handleToggle = () => setIsChatOpen(prev => !prev);
    const handleOpen = () => setIsChatOpen(true);
    
    window.addEventListener('toggle-ai-chat', handleToggle);
    window.addEventListener('open-ai-chat', handleOpen);
    
    return () => {
      window.removeEventListener('toggle-ai-chat', handleToggle);
      window.removeEventListener('open-ai-chat', handleOpen);
    };
  }, []);

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Detect project context from URL (e.g. /project/1)
  const projectMatch = location.pathname.match(/\/project\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = { role: 'user', content: chatMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setChatMessage('');
    setChatLoading(true);

    try {
      const response = await feedbackService.chat(chatMessage, chatHistory, projectId);
      setChatHistory(prev => [...prev, { role: 'assistant', content: response.reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = err.response?.data?.error || 'Sorry, I failed to connect to the assistant engine. Please try again.';
      setChatHistory(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearHistory = () => {
    const defaultMsg = [
      { role: 'assistant', content: `Hi ${user?.name || 'there'}! I'm your DigiQuest Assistant. Ask me anything about your video feedback, revisions, or project statuses!` }
    ];
    setChatHistory(defaultMsg);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'pm', 'client', 'editor', 'vfx_artist'] },
    { label: 'Video Manager', path: '/videos', icon: Video, roles: ['admin', 'pm'] },
    { label: 'Kanban Board', path: '/kanban', icon: Kanban, roles: ['admin', 'pm', 'editor', 'vfx_artist'] },
    { label: 'Feedback History', path: '/history', icon: History, roles: ['admin', 'pm', 'client', 'editor', 'vfx_artist'] },
    { label: 'Reports', path: '/reports', icon: BarChart3, roles: ['admin', 'pm'] },
  ];

  // Helper to format role names
  const formatRole = (role) => {
    switch(role) {
      case 'pm': return 'Production Manager';
      case 'vfx_artist': return 'VFX Artist';
      case 'editor': return 'Video Editor';
      case 'client': return 'Client';
      case 'admin': return 'Administrator';
      default: return role;
    }
  };

  return (
    <>
      {/* Floating Toggle Button - Visible only on mobile/tablet */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-3 left-4 z-50 p-2.5 rounded-lg border lg:hidden transition-all duration-200 ${
          isDark 
            ? 'border-slate-800 bg-[#161D30] text-slate-300 hover:bg-slate-800' 
            : 'border-slate-250 bg-white text-slate-600 hover:bg-slate-100 shadow-sm'
        }`}
        aria-label="Toggle Navigation Menu"
      >
        {isOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
      </button>

      {/* Backdrop overlay - Visible only on mobile/tablet when open */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Panel */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex flex-col justify-between border-r transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${
        isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200'
      }`}>
      
      {/* Upper Area */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/20">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white">
            <Video className="w-4.5 h-4.5" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
            DigiQuest Studio
          </span>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 my-6 rounded-xl border border-slate-800/10 bg-slate-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-400 flex items-center justify-center text-white font-extrabold text-sm uppercase">
              {user?.name?.substring(0, 2) || 'US'}
            </div>
            <div className="truncate">
              <div className="font-bold text-sm truncate">{user?.name}</div>
              <div className="text-[10px] uppercase font-bold text-violet-400 tracking-wide mt-0.5">
                {formatRole(user?.role)}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-4 space-y-1">
          {menuItems
            .filter(item => item.roles.includes(user?.role))
            .map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10'
                      : isDark
                        ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`
                }
              >
                <item.icon className="w-4.5 h-4.5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>
      </div>

      {/* Footer Area */}
      <div className="p-4 border-t border-slate-800/20 space-y-3">
        {/* Theme Toggler */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
            isDark 
              ? 'border-slate-800 hover:bg-slate-800 text-slate-300' 
              : 'border-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
        >
          <span className="flex items-center gap-2">
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
            Theme Mode
          </span>
          <span className="text-[10px] uppercase opacity-60">{isDark ? 'Dark' : 'Light'}</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors`}
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>

      </aside>

      {/* Global AI Assistant Chat Window */}
      {isChatOpen && (
        <div 
          className={`fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[400px] h-[500px] max-h-[calc(100vh-120px)] rounded-2xl shadow-2xl border flex flex-col justify-between overflow-hidden transition-all duration-300 ${
            isDark ? 'bg-[#161D30] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          {/* Header */}
          <div className={`h-14 flex items-center justify-between px-4 border-b ${
            isDark ? 'bg-[#0B0F19] border-slate-800/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
              <div>
                <span className="font-bold text-xs block">DigiQuest AI Assistant</span>
                {projectId && (
                  <span className="text-[9px] text-cyan-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                    Project Context Active
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleClearHistory}
                title="Clear Chat History"
                className={`p-1.5 rounded hover:bg-slate-500/10 text-slate-400 transition-colors`}
              >
                <History className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setIsChatOpen(false)}
                className={`p-1.5 rounded hover:bg-slate-500/10 text-slate-400 transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-2 max-w-[85%] text-xs leading-normal p-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-violet-600 text-white ml-auto rounded-tr-none' 
                    : isDark 
                      ? 'bg-[#0B0F19] text-slate-200 border border-slate-800 rounded-tl-none' 
                      : 'bg-slate-100 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.role !== 'user' && <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            
            {chatLoading && (
              <div className={`flex gap-2 max-w-[85%] text-xs leading-normal p-3 rounded-2xl mr-auto ${
                isDark ? 'bg-[#0B0F19] text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-500'
              } rounded-tl-none`}>
                <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                <span>Assistant is thinking...</span>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-800/10 flex gap-2">
            <input
              type="text"
              placeholder={projectId ? "Ask about this project..." : "Ask assistant about video feedback..."}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-xl border text-xs focus:outline-none focus:border-violet-500 ${
                isDark ? 'bg-[#0B0F19] border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="p-2 rounded-xl bg-violet-600 hover:bg-violet-750 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/25 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
        aria-label="Toggle AI Assistant"
      >
        {isChatOpen ? <ChevronDown className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
      </button>
    </>
  );
}
