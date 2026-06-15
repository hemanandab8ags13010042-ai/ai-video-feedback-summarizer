let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
if (API_URL && !API_URL.endsWith('/api') && !API_URL.endsWith('/api/')) {
  API_URL = API_URL.endsWith('/') ? `${API_URL}api` : `${API_URL}/api`;
}
export const BASE_URL = API_URL.endsWith('/api') 
  ? API_URL.slice(0, -4) 
  : API_URL.endsWith('/api/') 
    ? API_URL.slice(0, -5) 
    : API_URL;
import axios from 'axios';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject JWT token from localStorage into headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth Service Endpoints
export const authService = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  register: async (name, email, password, role) => {
    const res = await api.post('/auth/register', { name, email, password, role });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  getUsers: async () => {
    const res = await api.get('/auth/users');
    return res.data;
  }
};

// Project Service Endpoints
export const projectService = {
  getAll: async () => {
    const res = await api.get('/projects');
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/projects/${id}`);
    return res.data;
  },
  create: async (projectData) => {
    const res = await api.post('/projects', projectData);
    return res.data;
  },
  update: async (id, projectData) => {
    const res = await api.put(`/projects/${id}`, projectData);
    return res.data;
  }
};

// Task Service Endpoints
export const taskService = {
  getAll: async (params) => {
    const res = await api.get('/tasks', { params });
    return res.data;
  },
  create: async (taskData) => {
    const res = await api.post('/tasks', taskData);
    return res.data;
  },
  update: async (id, taskData) => {
    const res = await api.put(`/tasks/${id}`, taskData);
    return res.data;
  },
  getHistory: async (id) => {
    const res = await api.get(`/tasks/${id}/history`);
    return res.data;
  }
};

// Feedback Service Endpoints
export const feedbackService = {
  analyze: async (projectId, textFeedback, type, file) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    if (textFeedback) formData.append('text_feedback', textFeedback);
    if (type) formData.append('type', type);
    if (file) formData.append('file', file);

    const res = await api.post('/feedback/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  getHistory: async () => {
    const res = await api.get('/feedback/history');
    return res.data;
  },
  chat: async (message, chatHistory, projectId) => {
    const res = await api.post('/feedback/chat', { message, chatHistory, project_id: projectId });
    return res.data;
  }
};

// Dashboard Service Endpoints
export const dashboardService = {
  getData: async () => {
    const res = await api.get('/dashboard');
    return res.data;
  },
  markNotificationsRead: async () => {
    const res = await api.put('/dashboard/notifications/read');
    return res.data;
  }
};

// Reports Service Endpoints
export const reportService = {
  getReportData: async (type) => {
    const res = await api.get(`/reports?type=${type}&format=json`);
    return res.data;
  },
  downloadCSV: async (type) => {
    // Return window URL for downloading
    const token = localStorage.getItem('token');
    return `${API_URL}/reports?type=${type}&format=csv&token=${token}`;
  },
  downloadPDF: async (type) => {
    // Return window URL for downloading PDF
    const token = localStorage.getItem('token');
    return `${API_URL}/reports?type=${type}&format=pdf&token=${token}`;
  },
  getHistory: async () => {
    const res = await api.get('/reports/history');
    return res.data;
  }
};

// Video Upload Service Endpoints
export const videoService = {
  upload: async (formData) => {
    const res = await api.post('/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  uploadVersion: async (videoId, formData) => {
    const res = await api.post(`/videos/${videoId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  getByProject: async (projectId) => {
    const res = await api.get(`/videos/project/${projectId}`);
    return res.data;
  },
  getVersionDetails: async (versionId) => {
    const res = await api.get(`/videos/version/${versionId}`);
    return res.data;
  },
  downloadMarkers: async (versionId, format = 'csv') => {
    const token = localStorage.getItem('token');
    return `${API_URL}/videos/version/${versionId}/export-markers?format=${format}&token=${token}`;
  },
  generateSubtitles: async (versionId) => {
    const res = await api.post(`/videos/version/${versionId}/subtitles`);
    return res.data;
  },
  getSubtitles: async (versionId) => {
    const res = await api.get(`/videos/version/${versionId}/subtitles`);
    return res.data;
  },
  updateSubtitle: async (versionId, subtitleId, text) => {
    const res = await api.put(`/videos/version/${versionId}/subtitles/${subtitleId}`, { text });
    return res.data;
  },
  downloadSubtitles: async (versionId, format = 'srt') => {
    const token = localStorage.getItem('token');
    return `${API_URL}/videos/version/${versionId}/export-subtitles?format=${format}&token=${token}`;
  }
};

// Video Review & Comments Endpoints
export const reviewService = {
  addComment: async (formData) => {
    const res = await api.post('/reviews/comments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  approve: async (approvalData) => {
    const res = await api.post('/reviews/approve', approvalData);
    return res.data;
  },
  analyzeVideo: async (versionId) => {
    const res = await api.post('/reviews/analyze-video', { version_id: versionId });
    return res.data;
  }
};

export default api;
