const fs = require('fs');
const { marked } = require('marked');

const markdownPath = process.argv[2];
const htmlPath = process.argv[3];
const title = process.argv[4] || 'Documentation';

if (!markdownPath || !htmlPath) {
  console.error('Usage: node convert-md-to-html.js <input.md> <output.html> [title]');
  process.exit(1);
}

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

const markdown = fs.readFileSync(markdownPath, 'utf8');
const contentHtml = marked(markdown);

const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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

    pre {
      background: #111827;
      color: #f9fafb;
      overflow-x: auto;
      padding: 1rem;
    }

    code {
      font-family: Consolas, 'Liberation Mono', monospace;
    }
  </style>
</head>
<body>
  <main>
    ${contentHtml}
  </main>
</body>
</html>
`;

fs.writeFileSync(htmlPath, template, 'utf8');
