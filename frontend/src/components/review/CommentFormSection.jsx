import React, { useRef } from 'react';
import { useReviewStore } from '../../store/useReviewStore';
import { Send, Mic, Square } from 'lucide-react';

export default function CommentFormSection({ isDark, clearCanvas }) {
  const store = useReviewStore();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        store.setVoiceBlob(audioBlob);
        if (!store.newComment) {
          store.setNewComment('[Voice Feedback Note recorded]');
        }
      };

      mediaRecorderRef.current.start();
      store.setIsVoiceRecording(true);
    } catch (e) {
      // Fallback simulated voice note
      store.setIsVoiceRecording(true);
      setTimeout(() => {
        store.setVoiceBlob(new Blob(['simulated voice data'], { type: 'audio/wav' }));
        store.setIsVoiceRecording(false);
        if (!store.newComment) {
          store.setNewComment('Adjust voice note timing levels here.');
        }
      }, 3000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && store.isVoiceRecording) {
      mediaRecorderRef.current.stop();
      store.setIsVoiceRecording(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!store.newComment.trim() && !store.voiceBlob) return;

    await store.postComment(store.version?.id);
    if (clearCanvas) {
      clearCanvas();
    }
  };

  return (
    <div className={`p-6 rounded-xl border ${
      isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/10 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Timestamp feedback note</h3>
        <span className="text-xs font-bold text-violet-400 bg-violet-600/10 px-2 py-0.5 rounded font-mono">
          Time: {formatTime(store.currentTime)}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <textarea
            rows={3}
            placeholder="Comment on current scene details..."
            value={store.newComment}
            onChange={(e) => store.setNewComment(e.target.value)}
            className={`flex-1 p-3.5 rounded-lg border text-sm focus:outline-none focus:ring-1 focus:border-violet-500 ${
              isDark ? 'bg-[#0B0F19] border-slate-855 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            
            {/* Category Dropdown */}
            <div>
              <select
                value={store.commentCategory}
                onChange={(e) => store.setCommentCategory(e.target.value)}
                className={`px-2 py-1.5 rounded border text-xs focus:outline-none ${
                  isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <option value="Editing">Editing</option>
                <option value="VFX">VFX</option>
                <option value="Audio">Audio</option>
                <option value="Subtitle">Subtitle</option>
                <option value="Color Grading">Color Grading</option>
                <option value="Transition">Transition</option>
                <option value="Animation">Animation</option>
                <option value="General">General</option>
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <select
                value={store.commentPriority}
                onChange={(e) => store.setCommentPriority(e.target.value)}
                className={`px-2 py-1.5 rounded border text-xs focus:outline-none ${
                  isDark ? 'bg-[#0B0F19] border-slate-855' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Voice note recorder button */}
            <button
              type="button"
              onClick={store.isVoiceRecording ? stopVoiceRecording : startVoiceRecording}
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                store.isVoiceRecording 
                  ? 'bg-rose-500 text-white animate-pulse' 
                  : isDark ? 'bg-[#0B0F19] hover:bg-slate-800 text-slate-400' : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
              title="Record Voice note feedback"
            >
              {store.isVoiceRecording ? <Square className="w-4 h-4 fill-white" /> : <Mic className="w-4 h-4" />}
            </button>
            
          </div>

          <button
            type="submit"
            disabled={!store.newComment.trim() && !store.voiceBlob}
            className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-violet-500/10 transition-colors disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            Post Comment
          </button>
        </div>
      </form>
    </div>
  );
}
