const fs = require('fs');
const { marked } = require('marked');

// Read markdown file
const mdPath = process.argv[2];
const htmlPath = process.argv[3];
const title = process.argv[4] || 'Documentation';

if (!mdPath || !htmlPath) {
  console.error('Usage: node convert-md-to-html.js <input.md> <output.html> [title]');
  process.exit(1);
}

const markdown = fs.readFileSync(mdPath, 'utf-8');

// Convert markdown to HTML
const contentHtml = marked(markdown);

// Read template
const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/http.min.js"></script>
    <style>
:root {
    --primary: #4F46E5;
    --secondary: #06B6D4;
    --success: #10B981;
    --warning: #F59E0B;
    --danger: #EF4444;
    --bg: #F9FAFB;
    --card-bg: #FFFFFF;
    --text: #111827;
    --text-muted: #6B7280;
    --border: #E5E7EB;
    --code-bg: #F3F4F6;
    --sidebar-width: 280px;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: var(--text);
    background: var(--bg);
    display: flex;
    min-height: 100vh;
}

.sidebar {
    width: var(--sidebar-width);
    background: var(--card-bg);
