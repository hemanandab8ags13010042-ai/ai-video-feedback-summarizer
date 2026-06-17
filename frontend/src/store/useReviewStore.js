import { create } from 'zustand';
import { videoService, reviewService, feedbackService } from '../services/api';

export const useReviewStore = create((set, get) => ({
  // --- States ---
  version: null,
  comments: [],
  aiSummary: null,
  approvals: [],
  siblingVersions: [],
  loading: true,
  refreshing: false,

  // Playback
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackSpeed: 1,
  volume: 1,

  // Comparison
  isComparing: false,
  compareVersionId: '',
  compareVersion: null,

  // Sizing / Fits
  fitMode: 'contain',
  videoAspectRatio: '16/9',
  isFullscreen: false,
  resizeKey: 0,

  // Collaboration
  collaborators: {},

  // Whiteboard drawing
  isDrawingMode: false,
  drawingColor: '#EF4444',
  drawingTool: 'free',
  drawHistory: [],

  // Feedback form
  newComment: '',
  commentCategory: 'Editing',
  commentPriority: 'medium',
  isVoiceRecording: false,
  voiceBlob: null,

  // AI compilation
  analyzingVideo: false,

  // Decision cut modal
  isDecisionOpen: false,
  decisionStatus: 'approved',
  decisionComment: '',
  savingDecision: false,

  // Sidebar Tabs
  activeTab: 'comments',

  // Subtitles
  subtitles: [],
  isGeneratingSubtitles: false,
  activeSubtitle: null,
  editingSubtitleId: null,
  editingText: '',

  // Chatbot
  chatMessage: '',
  chatHistory: [
    { role: 'assistant', content: 'Ask me anything about outstanding revision comments on this cut.' }
  ],
  chatLoading: false,

  // --- Actions ---
  setVersion: (version) => set({ version }),
  setComments: (comments) => set({ comments }),
  setAiSummary: (aiSummary) => set({ aiSummary }),
  setApprovals: (approvals) => set({ approvals }),
  setSiblingVersions: (siblingVersions) => set({ siblingVersions }),
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setVolume: (volume) => set({ volume }),

  setIsComparing: (isComparing) => set({ isComparing }),
  setCompareVersionId: (compareVersionId) => set({ compareVersionId }),
  setCompareVersion: (compareVersion) => set({ compareVersion }),

  setFitMode: (fitMode) => set({ fitMode }),
  setVideoAspectRatio: (videoAspectRatio) => set({ videoAspectRatio }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
  incrementResizeKey: () => set((state) => ({ resizeKey: state.resizeKey + 1 })),

  setCollaborators: (collaborators) => set({ collaborators }),
  setIsDrawingMode: (isDrawingMode) => set({ isDrawingMode }),
  setDrawingColor: (drawingColor) => set({ drawingColor }),
  setDrawingTool: (drawingTool) => set({ drawingTool }),
  setDrawHistory: (drawHistory) => set({ drawHistory }),
  clearDrawHistory: () => set({ drawHistory: [] }),

  setNewComment: (newComment) => set({ newComment }),
  setCommentCategory: (commentCategory) => set({ commentCategory }),
  setCommentPriority: (commentPriority) => set({ commentPriority }),
  setIsVoiceRecording: (isVoiceRecording) => set({ isVoiceRecording }),
  setVoiceBlob: (voiceBlob) => set({ voiceBlob }),

  setAnalyzingVideo: (analyzingVideo) => set({ analyzingVideo }),

  setIsDecisionOpen: (isDecisionOpen) => set({ isDecisionOpen }),
  setDecisionStatus: (decisionStatus) => set({ decisionStatus }),
  setDecisionComment: (decisionComment) => set({ decisionComment }),
  setSavingDecision: (savingDecision) => set({ savingDecision }),

  setActiveTab: (activeTab) => set({ activeTab }),

  setSubtitles: (subtitles) => set({ subtitles }),
  setIsGeneratingSubtitles: (isGeneratingSubtitles) => set({ isGeneratingSubtitles }),
  setActiveSubtitle: (activeSubtitle) => set({ activeSubtitle }),
  setEditingSubtitleId: (editingSubtitleId) => set({ editingSubtitleId }),
  setEditingText: (editingText) => set({ editingText }),

  setChatMessage: (chatMessage) => set({ chatMessage }),
  setChatHistory: (chatHistory) => set({ chatHistory }),
  setChatLoading: (chatLoading) => set({ chatLoading }),

  // API Methods
  fetchSubtitles: async (versionId) => {
    try {
      const data = await videoService.getSubtitles(versionId);
      set({ subtitles: data });
    } catch (err) {
      console.error('Failed to load subtitles:', err);
    }
  },

  fetchVersionReviewData: async (versionId) => {
    try {
      const data = await videoService.getVersionDetails(versionId);
      set({
        version: data.version,
        comments: data.comments,
        aiSummary: data.aiSummary,
        approvals: data.approvals,
        siblingVersions: data.siblingVersions,
      });
      await get().fetchSubtitles(versionId);
    } catch (err) {
      console.error('Failed to load version details:', err);
    }
  },

  loadComparisonVersion: async (compareId) => {
    set({ compareVersionId: compareId });
    if (!compareId) {
      set({ compareVersion: null });
      return;
    }
    try {
      const data = await videoService.getVersionDetails(compareId);
      set({ compareVersion: data.version });
    } catch (err) {
      console.error('Failed to load comparison version details:', err);
    }
  },

  generateSubtitles: async (versionId) => {
    set({ isGeneratingSubtitles: true });
    try {
      const data = await videoService.generateSubtitles(versionId);
      set({ subtitles: data });
    } catch (err) {
      console.error('Failed to generate subtitles:', err);
    } finally {
      set({ isGeneratingSubtitles: false });
    }
  },

  updateSubtitle: async (versionId, subtitleId, text) => {
    try {
      await videoService.updateSubtitle(versionId, subtitleId, text);
      set((state) => ({
        subtitles: state.subtitles.map((s) => (s.id === subtitleId ? { ...s, text } : s)),
      }));
    } catch (e) {
      console.error('Failed to update subtitle text:', e);
    }
  },

  postComment: async (versionId) => {
    const { newComment, commentCategory, commentPriority, drawHistory, voiceBlob } = get();
    if (!newComment.trim() && !voiceBlob) return;

    try {
      const formData = new FormData();
      formData.append('version_id', versionId);
      formData.append('timestamp_seconds', get().currentTime.toString());
      formData.append('comment', newComment);
      formData.append('category', commentCategory);
      formData.append('priority', commentPriority);

      if (drawHistory.length > 0) {
        formData.append('draw_data', JSON.stringify(drawHistory));
      }
      if (voiceBlob) {
        formData.append('voice', voiceBlob, 'voice_feedback.wav');
      }

      await reviewService.addComment(formData);

      set({
        newComment: '',
        voiceBlob: null,
        drawHistory: [],
      });

      await get().fetchVersionReviewData(versionId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit feedback.');
    }
  },

  submitDecision: async (versionId) => {
    const { decisionStatus, decisionComment } = get();
    set({ savingDecision: true });
    try {
      await reviewService.approve({
        version_id: versionId,
        status: decisionStatus,
        comments: decisionComment,
      });
      set({ isDecisionOpen: false, decisionComment: '' });
      await get().fetchVersionReviewData(versionId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update review decision.');
    } finally {
      set({ savingDecision: false });
    }
  },

  compileAIAnalysis: async (versionId) => {
    const { comments } = get();
    if (comments.length === 0) {
      alert('Please add comment notes along the timeline before calling the AI compilation service.');
      return;
    }
    set({ analyzingVideo: true });
    try {
      await reviewService.analyzeVideo(versionId);
      await get().fetchVersionReviewData(versionId);
    } catch (err) {
      console.error(err);
    } finally {
      set({ analyzingVideo: false });
    }
  },

  sendChatMessage: async (versionId) => {
    const { chatMessage, chatHistory } = get();
    if (!chatMessage.trim()) return;

    const userMsg = { role: 'user', content: chatMessage };
    const nextHistory = [...chatHistory, userMsg];
    set({
      chatHistory: nextHistory,
      chatMessage: '',
      chatLoading: true,
    });

    try {
      const response = await feedbackService.chat(chatMessage, chatHistory, get().version?.project_id);
      set((state) => ({
        chatHistory: [...state.chatHistory, { role: 'assistant', content: response.reply }],
      }));
    } catch (e) {
      set((state) => ({
        chatHistory: [...state.chatHistory, { role: 'assistant', content: 'Connection issue. Try again.' }],
      }));
    } finally {
      set({ chatLoading: false });
    }
  },
}));
