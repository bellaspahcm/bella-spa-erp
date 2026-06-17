#!/usr/bin/env python3
"""
Convert core-platform.md to HTML with beautiful styling.
Usage: python convert-to-html.py
"""

import re
from pathlib import Path

def markdown_to_html(md_content):
    """Convert markdown to HTML"""
    html = md_content
    
    # Code blocks
    html = re.sub(r'```(\w+)?\n(.*?)```', r'<pre><code class="language-\1">\2</code></pre>', html, flags=re.DOTALL)
    
    # Headers
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
    
    # Paragraphs
    html = re.sub(r'\n\n', r'</p><p>', html)
    html = f'<p>{html}</p>'
    
    return html

def create_html_file():
    """Create beautiful HTML file from markdown"""
    
    # Read markdown
    md_path = Path('core-platform.md')
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Convert to HTML
    content_html = markdown_to_html(md_content)
    
    # HTML template with styling
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Core Platform Architecture - Bella ERP</title>
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
            <h1>Core Platform Architecture</h1>
            <div class="metadata">
                <span class="badge badge-info">Version 1.0</span>
                <span class="badge badge-success">Active</span>
                <span>Last Updated: 2025-06-01</span>
            </div>
        </header>
        
        <div class="content">
            {content_html}
        </div>
        
        <footer>
            <p>© 2025 Bella ERP. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>"""
    
    # Write HTML file
    html_path = Path('core-platform.html')
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    
    print(f"✅ Created {html_path}")

def get_css_styles():
    """Return CSS styles"""
    return """
        :root {
            --primary-color: #4F46E5;
            --secondary-color: #06B6D4;
            --bg-color: #F9FAFB;
            --card-bg: #FFFFFF;
            --text-primary: #111827;
            --text-secondary: #6B7280;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
        
        .content {
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
            padding-bottom: 0.5rem;
            margin-top: 2rem;
        }
        
        code {
            background: #F3F4F6;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
        }
        
        pre {
            background: #1F2937;
            padding: 1.5rem;
            border-radius: 8px;
            overflow-x: auto;
        }
        
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-right: 0.5rem;
        }
        
        .badge-success {
            background: #D1FAE5;
            color: #065F46;
        }
        
        .badge-info {
            background: #DBEAFE;
            color: #1E40AF;
        }
    """

if __name__ == '__main__':
    create_html_file()
