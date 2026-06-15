/**
 * Helper to format seconds into HH:MM:SS.mmm (Premiere CSV format)
 */
function formatTimecodeMs(totalSeconds) {
  const secs = parseFloat(totalSeconds) || 0;
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const mmm = ms.toString().padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Helper to format seconds into HH:MM:SS:FF (EDL CMX 3600 format, assuming 24 FPS)
 */
function formatTimecodeFrames(totalSeconds, fps = 24) {
  const secs = parseFloat(totalSeconds) || 0;
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  const frames = Math.floor((secs % 1) * fps);

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const ff = frames.toString().padStart(2, '0');

  return `${hh}:${mm}:${ss}:${ff}`;
}

/**
 * Exporter functions
 */
function exportToPremiereCSV(comments) {
  const headers = ['Marker Name', 'Description', 'In', 'Out', 'Duration', 'Marker Type'];
  const rows = [headers.map(h => `"${h}"`).join(',')];

  comments.forEach(c => {
    const name = `${c.commenter_name || 'User'} (${c.category || 'General'})`;
    const description = c.comment || '';
    const inTime = formatTimecodeMs(c.timestamp_seconds);
    const outTime = inTime;
    const duration = '00:00:00.000';
    const type = 'Comment';

    rows.push([
      `"${name.replace(/"/g, '""')}"`,
      `"${description.replace(/"/g, '""')}"`,
      `"${inTime}"`,
      `"${outTime}"`,
      `"${duration}"`,
      `"${type}"`
    ].join(','));
  });

  return rows.join('\r\n');
}

function exportToResolveEDL(comments) {
  const edlLines = [
    'TITLE: Video Timeline Markers Export',
    'FCM: NON-DROP FRAME',
    ''
  ];

  comments.forEach((c, index) => {
    const entryNum = (index + 1).toString().padStart(3, '0');
    const tcIn = formatTimecodeFrames(c.timestamp_seconds);
    const tcOut = formatTimecodeFrames(c.timestamp_seconds + 0.04); // tiny duration (1 frame)

    // Standard CMX 3600 EDL formatting
    edlLines.push(`${entryNum}  AX       V     C        ${tcIn} ${tcOut} ${tcIn} ${tcOut}`);
    edlLines.push(`* KEYWORD: ${c.category || 'General'}`);
    edlLines.push(`* COMMENT: ${c.commenter_name || 'User'} [${c.priority || 'medium'}]: ${c.comment}`);
    edlLines.push('');
  });

  return edlLines.join('\r\n');
}

module.exports = {
  exportToPremiereCSV,
  exportToResolveEDL
};
