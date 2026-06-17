#!/usr/bin/env python3
"""
Convert progress report markdown to HTML
Usage: python convert-progress-report.py <input.md> <output.html>
"""

import sys
import re
from pathlib import Path

def markdown_to_html(md_content):
    """Convert markdown to HTML"""
    html = md_content
    
    # Code blocks
    html = re.sub(r'```(\w+)?\n(.*?)```', r'<pre><code class="language-\1">\2</code></pre>', html, flags=re.DOTALL)
    
    # Headers
    html = re.sub(r'^#### (.*?)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.*?)$', r'<h2 id="\1">\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    
    # Bold and italic
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
    
    # Inline code
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    
    # Links
    html = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', html)
    
    # Lists
    html = re.sub(r'^\- (.*?)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'(<li>.*?</li>\n?)+', r'<ul>\g<0></ul>', html, flags=re.DOTALL)
    
    # Tables
    lines = html.split('\n')
    in_table = False
    table_html = []
    for line in lines:
        if '|' in line and not line.strip().startswith('<'):
            if not in_table:
                table_html.append('<table class="progress-table">')
                in_table = True
            if '---' in line:
                continue
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if table_html.count('<tr>') == 0:
                table_html.append('<thead><tr>')
                for cell in cells:
                    table_html.append(f'<th>{cell}</th>')
                table_html.append('</tr></thead><tbody>')
            else:
                table_html.append('<tr>')
                for cell in cells:
                    table_html.append(f'<td>{cell}</td>')
                table_html.append('</tr>')
        else:
            if in_table:
                table_html.append('</tbody></table>')
                in_table = False
            table_html.append(line)
    
    html = '\n'.join(table_html)
    
    # Paragraphs
    html = re.sub(r'\n\n+', r'</p><p>', html)
    html = f'<p>{html}</p>'
    
    return html

def create_html_file(input_file, output_file):
    """Create beautiful HTML file from markdown"""
    
    # Read markdown
    md_path = Path(input_file)
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Extract title
    title_match = re.search(r'^# (.+?)$', md_content, re.MULTILINE)
    title = title_match.group(1) if title_match else "Progress Report"
    
    # Convert to HTML
    content_html = markdown_to_html(md_content)
    
    # HTML template with styling
    html_template = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - Bella ERP</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    <style>
        {get_css_styles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="breadcrumb">
                <span>📄 Phase 3</span> / <span>Progress Report</span>
            </div>
            <h1>{title}</h1>
            <div class="metadata">
                <span class="badge badge-success">WAVE 4 COMPLETE</span>
                <span class="badge badge-info">83% Overall</span>
                <span>📅 2025-01-14</span>
            </div>
        </header>
        
        <div class="content">
            {content_html}
        </div>
        
        <footer class="page-footer">
            <p>© 2025 Bella ERP · Phase 3 Documentation</p>
        </footer>
    </div>
</body>
</html>"""
    
    # Write HTML file
    html_path = Path(output_file)
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    
    print(f"✅ Created {html_path}")

def get_css_styles():
    """Return CSS styles"""
    return """
        :root {
            --primary-color: #4F46E5;
            --secondary-color: #06B6D4;
            --success-color: #10B981;
            --warning-color: #F59E0B;
            --bg-color: #F9FAFB;
            --card-bg: #FFFFFF;
            --text-primary: #111827;
            --text-secondary: #6B7280;
            --border-color: #E5E7EB;
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: var(--bg-color);
            margin: 0;
            padding: 0;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        header {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            color: white;
            padding: 3rem 2rem;
            margin-bottom: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(79, 70, 229, 0.3);
        }
        
        header h1 {
            margin: 0.5rem 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        
        .breadcrumb {
            font-size: 0.9rem;
            opacity: 0.9;
            margin-bottom: 0.5rem;
        }
        
        .metadata {
            margin-top: 1rem;
            font-size: 0.9rem;
        }
        
        .content {
            background: var(--card-bg);
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
            color: var(--primary-color);
            font-size: 2rem;
            font-weight: 700;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        
        h2 {
            color: var(--primary-color);
            font-size: 1.75rem;
            font-weight: 600;
            border-bottom: 3px solid var(--primary-color);
            padding-bottom: 0.5rem;
            margin-top: 2.5rem;
            margin-bottom: 1.5rem;
        }
        
        h3 {
            color: var(--text-primary);
            font-size: 1.5rem;
            font-weight: 600;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        
        h4 {
            color: var(--text-secondary);
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }
        
        p {
            margin: 1rem 0;
            line-height: 1.7;
        }
        
        strong {
            color: var(--text-primary);
            font-weight: 600;
        }
        
        code {
            background: #F3F4F6;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
            font-size: 0.9em;
            color: #E11D48;
        }
        
        pre {
            background: #1F2937;
            padding: 1.5rem;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1.5rem 0;
        }
        
        pre code {
            background: transparent;
            padding: 0;
            color: #E5E7EB;
        }
        
        .badge {
            display: inline-block;
            padding: 0.35rem 0.85rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-right: 0.5rem;
            letter-spacing: 0.3px;
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
        
        ul, ol {
            margin: 1rem 0;
            padding-left: 2rem;
        }
        
        li {
            margin: 0.5rem 0;
            line-height: 1.6;
        }
        
        a {
            color: var(--primary-color);
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s;
        }
        
        a:hover {
            border-bottom-color: var(--primary-color);
        }
        
        .progress-table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .progress-table thead {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            color: white;
        }
        
        .progress-table th {
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.95rem;
        }
        
        .progress-table td {
            padding: 0.9rem 1rem;
            border-bottom: 1px solid var(--border-color);
        }
        
        .progress-table tbody tr:hover {
            background: #F9FAFB;
        }
        
        .progress-table tbody tr:last-child td {
            border-bottom: none;
        }
        
        hr {
            border: none;
            border-top: 2px solid var(--border-color);
            margin: 2rem 0;
        }
        
        .page-footer {
            text-align: center;
            padding: 2rem 0;
            color: var(--text-secondary);
            font-size: 0.9rem;
            margin-top: 3rem;
            border-top: 1px solid var(--border-color);
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            header {
                padding: 2rem 1.5rem;
            }
            
            header h1 {
                font-size: 1.75rem;
            }
            
            .content {
                padding: 1.5rem;
            }
            
            h1 {
                font-size: 1.5rem;
            }
            
            h2 {
                font-size: 1.35rem;
            }
            
            .progress-table {
                font-size: 0.85rem;
            }
            
            .progress-table th,
            .progress-table td {
                padding: 0.6rem;
            }
        }
    """

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python convert-progress-report.py <input.md> <output.html>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    create_html_file(input_file, output_file)
