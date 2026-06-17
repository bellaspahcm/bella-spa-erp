#!/usr/bin/env python3
"""
Convert all markdown documentation to beautiful HTML files.
Usage: python convert-all-docs.py
"""

import re
from pathlib import Path
from typing import Dict, List

# HTML Template with beautiful styling
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        {css}
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <h3>📚 Documentation</h3>
        </div>
        <nav class="sidebar-nav">
            <a href="index.html" class="nav-item">🏠 Home</a>
            <div class="nav-section">Architecture</div>
            <a href="core-platform.html" class="nav-item">🎯 Core Platform</a>
            <a href="module-system.html" class="nav-item">🧩 Module System</a>
            <a href="tenant-context.html" class="nav-item">🏢 Tenant Context</a>
            <div class="nav-section">Migration</div>
            <a href="../migration/phase-3-migration-guide.html" class="nav-item">📖 Migration Guide</a>
        </nav>
    </div>
    
    <div class="main-content">
        <header class="page-header">
            <div class="breadcrumb">
                <a href="index.html">Documentation</a>
                <span>›</span>
                <span>{breadcrumb}</span>
            </div>
            <h1>{title}</h1>
            <div class="metadata">
                {metadata}
            </div>
        </header>
        
        <div class="content">
            {content}
        </div>
        
        <footer class="page-footer">
            <p>© 2025 Bella ERP · Phase 3 Documentation</p>
        </footer>
    </div>
    
    <script>
        // Syntax highlighting
        hljs.highlightAll();
        
        // Smooth scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {{
            anchor.addEventListener('click', function (e) {{
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {{
                    target.scrollIntoView({{ behavior: 'smooth' }});
                }}
            }});
        }});
        
        // Active nav item
        const currentPage = window.location.pathname.split('/').pop();
        document.querySelectorAll('.nav-item').forEach(item => {{
            if (item.getAttribute('href') === currentPage) {{
                item.classList.add('active');
            }}
        }});
    </script>
</body>
</html>"""

CSS_STYLES = """
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

/* Sidebar */
.sidebar {
    width: var(--sidebar-width);
    background: var(--card-bg);
    border-right: 1px solid var(--border);
    position: fixed;
    height: 100vh;
    overflow-y: auto;
    padding: 2rem 0;
}

.sidebar-header {
    padding: 0 1.5rem 1.5rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 1rem;
}

.sidebar-header h3 {
    color: var(--primary);
    font-size: 1.2rem;
}

.sidebar-nav {
    padding: 0 1rem;
}

.nav-section {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--text-muted);
    margin: 1.5rem 0 0.5rem 0.5rem;
    letter-spacing: 0.05em;
}

.nav-item {
    display: block;
    padding: 0.75rem 1rem;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: 8px;
    margin-bottom: 0.25rem;
    transition: all 0.2s;
}

.nav-item:hover {
    background: var(--bg);
    color: var(--primary);
}

.nav-item.active {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: white;
    font-weight: 500;
}

/* Main Content */
.main-content {
    margin-left: var(--sidebar-width);
    flex: 1;
    padding: 2rem 4rem;
    max-width: 1400px;
}

.page-header {
    margin-bottom: 2rem;
}

.breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
}

.breadcrumb a {
    color: var(--primary);
    text-decoration: none;
}

.breadcrumb a:hover {
    text-decoration: underline;
}

h1 {
    font-size: 2.5rem;
    color: var(--text);
    margin-bottom: 1rem;
}

.metadata {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
}

.badge-success {
    background: #D1FAE5;
    color: #065F46;
}

.badge-info {
    background: #DBEAFE;
    color: #1E40AF;
}

.badge-warning {
    background: #FEF3C7;
    color: #92400E;
}

/* Content */
.content {
    background: var(--card-bg);
    padding: 3rem;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

h2 {
    font-size: 2rem;
    color: var(--primary);
    border-bottom: 2px solid var(--primary);
    padding-bottom: 0.5rem;
    margin: 2.5rem 0 1rem;
}

h2:first-child {
    margin-top: 0;
}

h3 {
    font-size: 1.5rem;
    color: var(--text);
    margin: 2rem 0 1rem;
}

h4 {
    font-size: 1.2rem;
    color: var(--text);
    margin: 1.5rem 0 0.75rem;
}

p {
    margin-bottom: 1rem;
    color: var(--text-muted);
    line-height: 1.7;
}

ul, ol {
    margin-left: 2rem;
    margin-bottom: 1rem;
}

li {
    margin-bottom: 0.5rem;
    color: var(--text-muted);
}

code {
    background: var(--code-bg);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.9em;
    color: var(--danger);
}

pre {
    background: #282c34;
    color: #abb2bf;
    padding: 1.5rem;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1.5rem 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

pre code {
    background: transparent;
    color: inherit;
    padding: 0;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
}

th {
    background: var(--primary);
    color: white;
    font-weight: 600;
}

tbody tr:hover {
    background: var(--bg);
}

a {
    color: var(--primary);
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

blockquote {
    border-left: 4px solid var(--primary);
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: var(--text-muted);
    font-style: italic;
}

.note {
    background: #EFF6FF;
    border-left: 4px solid var(--secondary);
    padding: 1rem 1.5rem;
    border-radius: 4px;
    margin: 1.5rem 0;
}

.warning {
    background: #FEF3C7;
    border-left: 4px solid var(--warning);
    padding: 1rem 1.5rem;
    border-radius: 4px;
    margin: 1.5rem 0;
}

/* Footer */
.page-footer {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 968px) {
    .sidebar {
        transform: translateX(-100%);
    }
    
    .main-content {
        margin-left: 0;
        padding: 2rem;
    }
}
"""

def extract_metadata(content: str) -> Dict[str, str]:
    """Extract metadata from markdown front matter"""
    metadata = {}
    lines = content.split('\n')
    
    for line in lines[:10]:
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip('*').strip()
            value = value.strip()
            if key and value:
                metadata[key] = value
    
    return metadata

def markdown_to_html(content: str) -> str:
    """Convert markdown to HTML"""
    html = content
    
    # Remove front matter
    html = re.sub(r'^---.*?---\s*', '', html, flags=re.DOTALL)
    
    # Code blocks with language
    def code_block_replace(match):
        lang = match.group(1) or ''
        code = match.group(2)
        return f'<pre><code class="language-{lang}">{code}</code></pre>'
    
    html = re.sub(r'```(\w+)?\n(.*?)```', code_block_replace, html, flags=re.DOTALL)
    
    # Headers with IDs
    html = re.sub(r'^#### (.*?)$', lambda m: f'<h4 id="{m.group(1).lower().replace(" ", "-")}">{m.group(1)}</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.*?)$', lambda m: f'<h3 id="{m.group(1).lower().replace(" ", "-")}">{m.group(1)}</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.*?)$', lambda m: f'<h2 id="{m.group(1).lower().replace(" ", "-")}">{m.group(1)}</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.*?)$', lambda m: f'<h1 id="{m.group(1).lower().replace(" ", "-")}">{m.group(1)}</h1>', html, flags=re.MULTILINE)
    
    # Bold and italic
    html = re.sub(r'\*\*\*(.*?)\*\*\*', r'<strong><em>\1</em></strong>', html)
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
    
    # Inline code
    html = re.sub(r'`([^`\n]+)`', r'<code>\1</code>', html)
    
    # Links
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)
    
    # Lists
    html = re.sub(r'^\- (.*?)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'^\d+\. (.*?)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    
    # Wrap consecutive list items
    html = re.sub(r'(<li>.*?</li>\n?)+', lambda m: f'<ul>{m.group(0)}</ul>', html, flags=re.DOTALL)
    
    # Tables
    html = convert_tables(html)
    
    # Paragraphs
    html = re.sub(r'\n\n+', '</p><p>', html)
    html = f'<p>{html}</p>'
    
    # Clean up empty paragraphs
    html = re.sub(r'<p>\s*</p>', '', html)
    html = re.sub(r'<p>(<[ht])', r'\1', html)
    html = re.sub(r'(</[ht]\d>)</p>', r'\1', html)
    html = re.sub(r'<p>(<pre>)', r'\1', html)
    html = re.sub(r'(</pre>)</p>', r'\1', html)
    html = re.sub(r'<p>(<ul>)', r'\1', html)
    html = re.sub(r'(</ul>)</p>', r'\1', html)
    
    return html

def convert_tables(html: str) -> str:
    """Convert markdown tables to HTML"""
    lines = html.split('\n')
    result = []
    in_table = False
    
    for i, line in enumerate(lines):
        if '|' in line and not in_table:
            # Start of table
            in_table = True
            result.append('<table>')
            # Header row
            cells = [c.strip() for c in line.split('|')[1:-1]]
            result.append('<thead><tr>')
            for cell in cells:
                result.append(f'<th>{cell}</th>')
            result.append('</tr></thead>')
            result.append('<tbody>')
        elif '|' in line and in_table:
            # Skip separator row
            if re.match(r'\|[\s\-:]+\|', line):
                continue
            # Data row
            cells = [c.strip() for c in line.split('|')[1:-1]]
            result.append('<tr>')
            for cell in cells:
                result.append(f'<td>{cell}</td>')
            result.append('</tr>')
        elif in_table:
            # End of table
            result.append('</tbody></table>')
            in_table = False
            result.append(line)
        else:
            result.append(line)
    
    if in_table:
        result.append('</tbody></table>')
    
    return '\n'.join(result)

def convert_doc(md_path: Path, output_path: Path, title: str, breadcrumb: str):
    """Convert a single markdown file to HTML"""
    print(f"Converting {md_path.name}...")
    
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Extract metadata
    metadata_dict = extract_metadata(md_content)
    
    # Build metadata HTML
    metadata_html = []
    if 'Version' in metadata_dict:
        metadata_html.append(f'<span class="badge badge-info">Version {metadata_dict["Version"]}</span>')
    if 'Status' in metadata_dict:
        status_class = 'success' if metadata_dict['Status'] == 'Active' else 'warning'
        metadata_html.append(f'<span class="badge badge-{status_class}">{metadata_dict["Status"]}</span>')
    if 'Last Updated' in metadata_dict:
        metadata_html.append(f'<span>📅 {metadata_dict["Last Updated"]}</span>')
    
    # Convert content
    content_html = markdown_to_html(md_content)
    
    # Generate HTML
    html = HTML_TEMPLATE.format(
        title=title,
        breadcrumb=breadcrumb,
        metadata=' '.join(metadata_html),
        content=content_html,
        css=CSS_STYLES
    )
    
    # Write HTML
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    print(f"  ✅ Created {output_path.name}")

def main():
    """Convert all documentation files"""
    base_path = Path(__file__).parent
    
    docs_to_convert = [
        {
            'input': base_path / 'core-platform.md',
            'output': base_path / 'core-platform.html',
            'title': 'Core Platform Architecture',
            'breadcrumb': 'Architecture'
        },
        {
            'input': base_path / 'module-system.md',
            'output': base_path / 'module-system.html',
            'title': 'Module System Architecture',
            'breadcrumb': 'Architecture'
        },
        {
            'input': base_path / 'tenant-context.md',
            'output': base_path / 'tenant-context.html',
            'title': 'Tenant Context Architecture',
            'breadcrumb': 'Architecture'
        },
        {
            'input': base_path.parent / 'migration' / 'phase-3-migration-guide.md',
            'output': base_path.parent / 'migration' / 'phase-3-migration-guide.html',
            'title': 'Phase 3 Migration Guide',
            'breadcrumb': 'Migration'
        }
    ]
    
    print("\n🚀 Converting documentation files to HTML...\n")
    
    for doc in docs_to_convert:
        if doc['input'].exists():
            convert_doc(doc['input'], doc['output'], doc['title'], doc['breadcrumb'])
        else:
            print(f"  ⚠️  {doc['input'].name} not found, skipping...")
    
    print("\n✅ All conversions complete!\n")
    print("📂 Files created:")
    for doc in docs_to_convert:
        if doc['output'].exists():
            size = doc['output'].stat().st_size / 1024
            print(f"  • {doc['output'].name} ({size:.1f} KB)")

if __name__ == '__main__':
    main()
