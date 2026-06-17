import React from 'react';
import { useReviewStore } from '../../store/useReviewStore';
import { Edit3, Trash2 } from 'lucide-react';

export default function DrawingToolbar({ versionId, isDark, onClearCanvas }) {
  const store = useReviewStore();

  const handleCompareToggle = () => {
    const nextComparing = !store.isComparing;
    store.setIsComparing(nextComparing);
    if (nextComparing && store.siblingVersions.length > 0 && !store.compareVersionId) {
      const firstSibling = store.siblingVersions.find(s => s.id.toString() !== versionId.toString());
      if (firstSibling) {
        store.loadComparisonVersion(firstSibling.id.toString());
      }
    }
  };

  const handleCompareChange = (e) => {
    store.loadComparisonVersion(e.target.value);
  };

  const handleClear = () => {
    store.clearDrawHistory();
    if (onClearCanvas) {
      onClearCanvas();
    }
  };

  return (
    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
      isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => store.setIsDrawingMode(!store.isDrawingMode)}
          className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
            store.isDrawingMode ? 'bg-violet-600 text-white shadow-lg' : 'bg-slate-500/10 hover:bg-slate-500/20 text-slate-400'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          {store.isDrawingMode ? 'Drawing On' : 'Drawing Off (Brush)'}
        </button>

        {store.isDrawingMode && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
            {/* Color circles */}
            {['#EF4444', '#F59E0B', '#06B6D4', '#FFFFFF'].map((color) => (
              <button
                key={color}
                onClick={() => store.setDrawingColor(color)}
                className="w-4 h-4 rounded-full border border-slate-950 transition-transform hover:scale-125"
                style={{ 
                  backgroundColor: color, 
                  border: store.drawingColor === color ? '2px solid #8B5CF6' : '1px solid transparent' 
                }}
              />
            ))}
            
            {/* Drawing tool selection */}
            <select
              value={store.drawingTool}
              onChange={(e) => store.setDrawingTool(e.target.value)}
              className={`px-1.5 py-1 text-[10px] rounded border focus:outline-none ${
                isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <option value="free">Pen Brush</option>
              <option value="circle">Circle</option>
              <option value="arrow">Arrow</option>
            </select>
          </div>
        )}
      </div>

      {/* Compare version triggers */}
      <div className="flex items-center gap-2 border-l border-slate-800/20 pl-3">
        <button
          type="button"
          onClick={handleCompareToggle}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all ${
            store.isComparing ? 'bg-cyan-600 text-white' : 'bg-slate-500/10 hover:bg-slate-500/20 text-slate-400'
          }`}
        >
          Version Compare
        </button>

        {store.isComparing && (
          <select
            value={store.compareVersionId}
            onChange={handleCompareChange}
            className={`pl-2 pr-6 py-1 text-xs font-bold rounded border cursor-pointer focus:outline-none ${
              isDark ? 'bg-[#0B0F19] border-slate-850 text-cyan-400' : 'bg-slate-50 border-slate-200 text-cyan-600'
            }`}
          >
            <option value="">Select Cut...</option>
            {store.siblingVersions
              .filter(v => v.id.toString() !== versionId.toString())
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.video_title ? `${v.video_title} (${v.version_number})` : `${v.version_number} cut`}
                </option>
            ))}
          </select>
        )}
      </div>

      {store.drawHistory.length > 0 && (
        <button
          onClick={handleClear}
          className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 font-bold text-[10px] flex items-center gap-1.5 ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Drawing
        </button>
      )}
    </div>
  );
}
