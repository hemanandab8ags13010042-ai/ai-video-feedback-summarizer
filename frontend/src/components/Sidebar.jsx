import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, Kanban, BarChart3, History, LogOut, 
  Video, Sun, Moon, ShieldAlert, UserCheck 
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

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
    <aside className={`w-64 flex-shrink-0 flex flex-col justify-between border-r transition-colors duration-200 ${
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
  );
}
