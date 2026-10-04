const fs = require('fs');
const path = require('path');

const outputPath = path.resolve(__dirname, '..', 'codebase-review.html');

const sections = [
  {
    title: 'Executive Summary',
    body: 'Bella ERP codebase review evidence is maintained in the reference documentation set. This generated HTML provides a lightweight, parseable entry point for local review.',
  },
  {
    title: 'Review Boundary',
    body: 'This report is a documentation artifact only. It does not execute product logic, mutate data, or change production readiness classifications.',
  },
  {
    title: 'Generated Artifact',
    body: 'Use the canonical markdown and evidence files as source of truth when making release or governance decisions.',
  },
];

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[char];
  });

const sectionHtml = sections
  .map(
    (section) => `
      <section>
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </section>`
  )
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bella ERP - Codebase Review</title>
  <style>
    body {
      background: #f8fafc;
      color: #172033;
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 2rem;
    }

    main {
      margin: 0 auto;
      max-width: 920px;
    }

    section {
      background: #ffffff;
      border: 1px solid #d9e2ec;
      border-radius: 8px;
      margin-top: 1rem;
      padding: 1rem 1.25rem;
    }
  </style>
</head>
<body>
  <main>
    <h1>Bella ERP Codebase Review</h1>
    ${sectionHtml}
  </main>
</body>
</html>
`;

fs.writeFileSync(outputPath, html, 'utf8');
console.log(`Generated ${outputPath}`);
