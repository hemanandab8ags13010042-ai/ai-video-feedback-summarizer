const PDFDocument = require('pdfkit');

/**
 * Generates a professional PDF document from custom headings and sections.
 * Returns a Promise that resolves to a Buffer.
 * 
 * @param {string} title Main report heading
 * @param {string} subtitle Optional sub-heading description
 * @param {Array<{heading: string, body: string}>} sections Content blocks
 */
function generatePDFBuffer(title, subtitle, sections = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      // --- 1. Branded Header Block ---
      doc.rect(0, 0, 595.28, 100).fill('#0F172A'); // A4 width is 595.28 pt
      
      doc.fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .fontSize(20)
         .text('DIGIQUEST STUDIO', 50, 30);
         
      doc.fontSize(10)
         .font('Helvetica')
         .text('Enterprise Video Feedback & Pipeline Analytics', 50, 55);

      doc.fillColor('#A78BFA')
         .fontSize(10)
         .text('AUTOMATED REPORT', 380, 30, { align: 'right', width: 165 })
         .fillColor('#94A3B8')
         .text(`Date: ${new Date().toLocaleDateString()}`, 380, 45, { align: 'right', width: 165 });

      // --- 2. Title & Subtitle ---
      doc.y = 140;
      doc.fillColor('#0F172A')
         .font('Helvetica-Bold')
         .fontSize(16)
         .text(title, 50, doc.y);

      if (subtitle) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Oblique')
           .fontSize(11)
           .fillColor('#475569')
           .text(subtitle);
      }

      doc.moveDown(1.5);

      // --- 3. Render Custom Content Sections ---
      sections.forEach(section => {
        // Page break safety check (A4 height is 841.89 pt)
        if (doc.y > 680) {
          doc.addPage();
          doc.y = 50;
        }

        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor('#7C3AED')
           .text(section.heading);
        
        doc.moveTo(50, doc.y + 3)
           .lineTo(545, doc.y + 3)
           .strokeColor('#E2E8F0')
           .lineWidth(1)
           .stroke();

        doc.y += 12;
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#334155')
           .text(section.body || 'No details provided.', { lineGap: 3 });

        doc.moveDown(1.5);
      });

      // --- 4. Footer Block ---
      doc.y = Math.max(doc.y + 20, 750);
      doc.moveTo(50, doc.y - 10)
         .lineTo(545, doc.y - 10)
         .strokeColor('#E2E8F0')
         .stroke();
         
      doc.fontSize(8)
         .fillColor('#94A3B8')
         .text('This is an automated system notification attachment from DigiQuest Studio.', 50, doc.y, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePDFBuffer
};
