import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';
import { authService, projectService } from '../services/api';
import { 
  Users, Search, Mail, ShieldAlert, Sparkles, 
  FolderGit2, UserCheck, RefreshCw, Layers 
} from 'lucide-react';

export default function ClientsPage() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'client', 'team'

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, projectsData] = await Promise.all([
        authService.getUsers(),
        projectService.getAll()
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Fetch Directory Error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate project count for each user
  const getUserProjectCount = (userData) => {
    if (!userData) return 0;
    const emailLower = (userData.email || '').toLowerCase().trim();
    const nameLower = (userData.name || '').toLowerCase().trim();
    
    return projects.filter(p => {
      const pClientLower = (p.client_name || '').toLowerCase().trim();
      return pClientLower === emailLower || pClientLower === nameLower;
    }).length;
  };

  // Helper to format role names & badges
  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return {
          label: 'Administrator',
          classes: 'bg-red-500/10 border border-red-500/30 text-red-400'
        };
      case 'pm':
        return {
          label: 'Production Manager',
          classes: 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
        };
      case 'editor':
        return {
          label: 'Video Editor',
          classes: 'bg-violet-500/10 border border-violet-500/30 text-violet-400'
        };
      case 'vfx_artist':
        return {
          label: 'VFX Artist',
          classes: 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
        };
      case 'client':
        return {
          label: 'Client Partner',
          classes: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
        };
      default:
        return {
          label: role,
          classes: 'bg-slate-500/10 border border-slate-500/30 text-slate-400'
        };
    }
  };

  // Filter logic
  const filteredUsers = users.filter(u => {
    // Search query matching
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(searchQuery.toLowerCase());

    // Role Tab matching
    if (activeTab === 'client') {
      return matchesSearch && u.role === 'client';
    }
    if (activeTab === 'team') {
      return matchesSearch && ['admin', 'pm', 'editor', 'vfx_artist'].includes(u.role);
    }
    return matchesSearch;
  });

  // Role Statistics counts
  const totalCount = users.length;
  const clientCount = users.filter(u => u.role === 'client').length;
  const teamCount = totalCount - clientCount;

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row ${
      isDark ? 'bg-gradient-studio text-slate-100' : 'bg-gradient-light text-slate-800'
    }`}>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <main className="flex-1 p-6 lg:p-10 pt-20 lg:pt-10 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-widest mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Workspace Directory
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Studio Clients & Team
            </h1>
            <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Overview of all registered clients and studio production staff member profiles.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isDark 
                ? 'border-slate-800 hover:border-slate-700 bg-[#161D30] text-slate-300' 
                : 'border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Directory
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {/* Card 1 */}
          <div className={`p-5 rounded-2xl border flex items-center gap-4 transition-all duration-300 ${
            isDark ? 'bg-[#161D30]/65 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Total Directory
              </span>
              <span className="text-2xl font-extrabold">{loading ? '...' : totalCount}</span>
              <span className="text-[10px] block opacity-60">Active User Accounts</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className={`p-5 rounded-2xl border flex items-center gap-4 transition-all duration-300 ${
            isDark ? 'bg-[#161D30]/65 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Client Partners
              </span>
              <span className="text-2xl font-extrabold">{loading ? '...' : clientCount}</span>
              <span className="text-[10px] block opacity-60">Upload & Review access</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className={`p-5 rounded-2xl border flex items-center gap-4 transition-all duration-300 ${
            isDark ? 'bg-[#161D30]/65 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="w-12 h-12 rounded-xl bg-cyan-600/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-[10px] uppercase font-bold tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Studio Staff
              </span>
              <span className="text-2xl font-extrabold">{loading ? '...' : teamCount}</span>
              <span className="text-[10px] block opacity-60">PMs, Editors & VFX Artists</span>
            </div>
          </div>
        </div>

        {/* Directory Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          {/* Tab selectors */}
          <div className="flex p-1 rounded-xl bg-slate-500/5 border border-slate-800/10 w-fit">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Users ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab('client')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'client'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Clients ({clientCount})
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'team'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Studio Staff ({teamCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 transition-colors ${
                isDark 
                  ? 'bg-[#161D30] border-slate-800 focus:border-violet-500 focus:ring-violet-500 text-slate-200' 
                  : 'bg-white border-slate-200 focus:border-violet-500 focus:ring-violet-500 text-slate-800'
              }`}
            />
          </div>
        </div>

        {/* Directory Grid */}
        {error ? (
          <div className={`p-6 text-center rounded-2xl border ${
            isDark ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <span className="font-bold text-sm block">System Alert</span>
            <span className="text-xs">{error}</span>
          </div>
        ) : loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-t-violet-600 border-r-transparent border-b-violet-600 border-l-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-xs text-slate-400 font-medium">Scanning directory workspace...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border ${
            isDark ? 'bg-[#161D30]/30 border-slate-800/60' : 'bg-slate-50 border-slate-200'
          }`}>
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-500 opacity-60" />
            <span className="font-bold text-sm block mb-1">No matching profiles found</span>
            <span className="text-xs text-slate-500">Try adjusting your search filters or queries.</span>
          </div>
        ) : (
          /* Glassmorphic User List Container */
          <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
            isDark ? 'bg-[#161D30]/65 border-slate-800/80 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? 'bg-[#0B0F19]/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <th className="py-4 px-6">User Profile</th>
                    <th className="py-4 px-6">Workspace Role</th>
                    <th className="py-4 px-6">Email Address</th>
                    <th className="py-4 px-6 text-center">Associated Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/10">
                  {filteredUsers.map((member) => {
                    const badge = getRoleBadge(member.role);
                    const projectCount = getUserProjectCount(member);
                    
                    return (
                      <tr 
                        key={member.id} 
                        className={`transition-colors duration-200 text-xs ${
                          isDark ? 'hover:bg-[#0B0F19]/20' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Name and Avatar */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-500/20 to-cyan-400/20 text-violet-400 font-extrabold text-xs flex items-center justify-center uppercase border border-violet-500/10">
                              {member.name ? member.name.substring(0, 2) : 'US'}
                            </div>
                            <div>
                              <span className="font-bold block text-sm">{member.name || 'Unnamed Profile'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-4.5 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${badge.classes}`}>
                            {badge.label}
                          </span>
                        </td>

                        {/* Email Address */}
                        <td className="py-4.5 px-6 text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        </td>

                        {/* Associated Projects count */}
                        <td className="py-4.5 px-6 text-center">
                          <div className="flex items-center justify-center gap-1.5 font-bold text-slate-300">
                            <FolderGit2 className="w-4 h-4 text-violet-400 opacity-80" />
                            <span className={`text-xs ${projectCount > 0 ? 'text-violet-400' : 'opacity-40'}`}>
                              {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
