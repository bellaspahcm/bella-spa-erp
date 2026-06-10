const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function main() {
  const htmlPath = path.resolve(__dirname, '../docs/bella_erp_comprehensive_codebase_analysis.html');
  const outputDir = path.resolve(__dirname, '../docs');
  const artifactDir = 'C:/Users/DELL/.gemini/antigravity-ide/brain/7905fe7f-4f59-45cd-9821-cacafc911afa';
  
  if (!fs.existsSync(htmlPath)) {
    console.error('File not found:', htmlPath);
    process.exit(1);
  }
  
  console.log('Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewportSize({ width: 1000, height: 1000 });
  
  console.log('Loading local HTML file...');
  await page.goto(`file://${htmlPath}`);
  
  // Wait for styles and fonts to render
  await page.waitForTimeout(2000);
  
  // Clean up styles for screenshotting cards nicely
  await page.evaluate(() => {
    // Modify body padding for screenshot spacing
    document.body.style.padding = '0';
    document.body.style.background = '#fcf8f8';
    
    // Add border and padding to all critical elements so they screenshot like standalone cards
    document.querySelectorAll('.section-content, header').forEach(el => {
      el.style.padding = '30px';
      el.style.margin = '20px 0';
      el.style.background = '#ffffff';
      el.style.borderRadius = '16px';
      el.style.border = '1px solid #f5e0e5';
      el.style.boxShadow = '0 4px 6px -1px rgba(136, 19, 55, 0.08)';
    });
    
    // Remove outer container layout padding/shadow
    const container = document.querySelector('.container');
    if (container) {
      container.style.boxShadow = 'none';
      container.style.border = 'none';
      container.style.padding = '20px';
      container.style.background = 'transparent';
    }
  });

  const sections = [
    { id: 'header', name: 'page_0_tong_quan.png' },
    { id: '#kien-truc', name: 'page_1_kien_truc.png' },
    { id: '#cau-truc-ma-nguon', name: 'page_2_cau_truc_ma_nguon.png' },
    { id: '#an-ninh-bao-mat', name: 'page_3_an_ninh_bao_mat.png' },
    { id: '#logic-nghiep-vu', name: 'page_4_logic_nghiep_vu.png' },
    { id: '#kha-nang-mo-rong', name: 'page_5_kha_nang_mo_rong.png' },
    { id: '#so-sanh-doi-thu', name: 'page_6_so_sanh_doi_thu.png' },
    { id: '#diem-so-he-thong', name: 'page_7_diem_so_he_thong.png' }
  ];
  
  for (const sec of sections) {
    console.log(`Capturing screenshot for ${sec.id}...`);
    const element = await page.$(sec.id);
    if (element) {
      // Save in docs folder
      const docsPath = path.join(outputDir, sec.name);
      await element.screenshot({ path: docsPath });
      console.log(`Saved to ${docsPath}`);
      
      // Save in artifact folder for inline viewing if it exists
      if (fs.existsSync(artifactDir)) {
        const artifactPath = path.join(artifactDir, sec.name);
        fs.copyFileSync(docsPath, artifactPath);
      }
    } else {
      console.warn(`Element not found: ${sec.id}`);
    }
  }
  
  // Revert and capture full page
  await page.evaluate(() => {
    window.location.reload();
  });
  await page.waitForTimeout(2000);
  
  console.log('Capturing full page screenshot...');
  const fullDocsPath = path.join(outputDir, 'bella_erp_analysis_full.png');
  await page.screenshot({ path: fullDocsPath, fullPage: true });
  
  if (fs.existsSync(artifactDir)) {
    fs.copyFileSync(fullDocsPath, path.join(artifactDir, 'bella_erp_analysis_full.png'));
  }
  console.log('Saved full report screenshots.');
  
  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
