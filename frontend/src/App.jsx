import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages Import
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import KanbanBoard from './pages/KanbanBoard';
import HistoryPage from './pages/HistoryPage';
import ReportsPage from './pages/ReportsPage';
import AdminVideos from './pages/AdminVideos';
import VideoReview from './pages/VideoReview';

// Simple Route Protection wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0B0F19] text-violet-400">
        <div className="w-8 h-8 border-4 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public Pages */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Workspace Pages */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/project/:id" 
              element={
                <ProtectedRoute>
                  <ProjectDetails />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kanban" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'pm', 'editor', 'vfx_artist']}>
                  <KanbanBoard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/history" 
              element={
                <ProtectedRoute>
                  <HistoryPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'pm']}>
                  <ReportsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/videos" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'pm']}>
                  <AdminVideos />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/review/:versionId" 
              element={
                <ProtectedRoute>
                  <VideoReview />
                </ProtectedRoute>
              } 
            />

            {/* Email link aliases — so quick links in emails land on the right page */}
            <Route path="/projects" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tasks" element={<Navigate to="/kanban" replace />} />

            {/* Fallback routing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
