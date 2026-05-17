const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');

(async () => {
  try {
    console.log('Starting conversion...');
    const pdf = await mdToPdf({ path: path.join(__dirname, 'BELLA_SPA_ERP_MASTER_GUIDE.md') }, {
      pdf_options: {
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<span style="font-size: 8px; font-family: Arial; margin-left: 20px; color: #888;">BELLA SPA ERP - MASTER MANUAL</span>',
        footerTemplate: '<span style="font-size: 8px; font-family: Arial; margin-left: 20px; color: #888;">Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>'
      }
    });
    fs.writeFileSync(path.join(__dirname, 'BELLA_SPA_ERP_MASTER_GUIDE.pdf'), pdf.content);
    console.log('Conversion successful! PDF created at BELLA_SPA_ERP_MASTER_GUIDE.pdf.');
  } catch (error) {
    console.error('Error during conversion:', error);
  }
})();
