import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { reportService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  BarChart3, Download, FileSpreadsheet, Eye, FileJson, 
  User, Calendar, Clock, RefreshCw, Sparkles, ShieldAlert
} from 'lucide-react';

export default function ReportsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [reportType, setReportType] = useState('productivity');
  const [reportData, setReportData] = useState(null);
  const [reportsHistory, setReportsHistory] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchReportsHistory = async () => {
    try {
      const history = await reportService.getHistory();
      setReportsHistory(history);
    } catch (err) {
      console.error('Failed to load reports history:', err);
    }
  };

  useEffect(() => {
    if (['pm', 'admin'].includes(user?.role)) {
      fetchReportsHistory().finally(() => setHistoryLoading(false));
      handleGeneratePreview();
    }
  }, [reportType]);

  const handleGeneratePreview = async () => {
    setLoading(true);
    try {
      const res = await reportService.getReportData(reportType);
      setReportData(res.data);
      await fetchReportsHistory(); // Refresh history log
    } catch (err) {
      console.error('Failed to load report preview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const downloadUrl = await reportService.downloadCSV(reportType);
      // Native window dispatch to trigger download attachment stream
      window.open(downloadUrl, '_blank');
      setTimeout(fetchReportsHistory, 1000); // refresh history logs
    } catch (err) {
      console.error('Failed to dispatch CSV download:', err);
    }
  };

  // Render header values based on report types
  const getHeaders = () => {
    if (!reportData || reportData.length === 0) return [];
    return Object.keys(reportData[0]);
  };

  // Safe checks for roles
  if (!['pm', 'admin'].includes(user?.role)) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${
        isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}>
        <div className="text-center p-8 max-w-sm rounded-xl border border-red-500/20 bg-red-500/5">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="font-extrabold text-base">Workspace Access Restricted</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            The Reports and Analytics module is restricted to Production Managers and System Administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Layout */}
      <Sidebar />

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        
        {/* Header */}
        <header className={`h-16 flex items-center justify-between px-4 sm:px-8 pl-16 sm:pl-8 border-b flex-shrink-0 sticky top-0 z-10 ${
          isDark ? 'border-slate-800 bg-[#161D30]/90 backdrop-blur-md' : 'border-slate-200 bg-white/90 backdrop-blur-md'
        }`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Studio Reports & Metrics</h1>
            <p className="text-xs text-slate-500 font-medium">Export and audit team throughput</p>
          </div>
        </header>

        {/* Content grid */}
        <div className="p-4 sm:p-8 space-y-8 max-w-6xl w-full mx-auto pb-24">
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left Controls column */}
            <div className="space-y-6">
              <div className={`p-5 rounded-xl border ${
                isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Export Settings</h3>
                
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1">Report Category</label>
                    <select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      className={`w-full px-2 py-2.5 rounded border text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 ${
                        isDark ? 'bg-[#0B0F19] border-slate-850' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="productivity">Productivity (Resolved Hours)</option>
                      <option value="revision_history">Revision History Logs</option>
                      <option value="team_performance">Staff Load Ratios</option>
                      <option value="project_completion">Project Checklist Counts</option>
                    </select>
                  </div>

                  <div className="pt-3 border-t border-slate-800/10 space-y-2.5">
                    <button
                      onClick={handleGeneratePreview}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-800/10"
                    >
                      <Eye className="w-4 h-4" />
                      Refresh Preview
                    </button>
                    <button
                      onClick={handleDownloadCSV}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-violet-500/15"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Export CSV Sheet
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Preview column */}
            <div className="lg:col-span-3 space-y-8">
              
              {/* Preview Container */}
              <div className={`p-6 rounded-xl border flex flex-col justify-between ${
                isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800/10 pb-3">
                    <h3 className="text-sm font-bold flex items-center gap-1.5">
                      <BarChart3 className="w-4.5 h-4.5 text-cyan-400" />
                      Report Preview Table
                    </h3>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      Type: {reportType}
                    </span>
                  </div>

                  {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-2 border-t-violet-500 border-r-transparent border-b-violet-500 border-l-transparent rounded-full animate-spin"></div>
                      <span className="text-xs text-slate-500">Querying DB metrics...</span>
                    </div>
                  ) : !reportData || reportData.length === 0 ? (
                    <div className="py-20 text-center text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      No records found in this metric pipeline.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs leading-normal">
                        <thead>
                          <tr className="border-b border-slate-800/20 text-slate-500">
                            {getHeaders().map((header) => (
                              <th key={header} className="pb-3 font-semibold uppercase tracking-wider">
                                {header.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-800/10 last:border-b-0 hover:bg-slate-500/5 transition-colors">
                              {getHeaders().map((header) => (
                                <td key={header} className="py-3.5 text-slate-300 font-medium">
                                  {row[header] === null || row[header] === undefined 
                                    ? '-' 
                                    : typeof row[header] === 'number' && row[header] % 1 !== 0
                                      ? row[header].toFixed(2)
                                      : row[header].toString()}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* History Exports log */}
              <div className={`p-6 rounded-xl border ${
                isDark ? 'bg-[#161D30] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h3 className="text-sm font-bold mb-4">Export Dispatch Timeline History</h3>
                
                {historyLoading ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Loading audit timeline...</p>
                ) : reportsHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No reports dispatched in the logs history.</p>
                ) : (
                  <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                    {reportsHistory.map((report) => (
                      <div key={report.id} className="flex items-center justify-between text-xs py-2 border-b border-slate-800/10 last:border-b-0">
                        <div>
                          <div className="font-bold text-violet-400">{report.title}</div>
                          <span className="text-[10px] text-slate-500">
                            Format: {report.type?.toUpperCase()} &bull; Dispatched by: {report.creator_name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      </main>

    </div>
  );
}
