const fs = require('fs');

const content = fs.readFileSync('docs/REFACTORING_ROADMAP_2026_basic.html', 'utf8');

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bella ERP - Lộ Trình Refactoring 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            line-height: 1.8; 
            color: #1f2937;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 2rem 0;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 0 2rem;
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem;
            border-radius: 24px 24px 0 0;
            margin: 0 -3rem 3rem -3rem;
            text-align: center;
        }
        .content-wrapper {
            padding: 3rem;
        }
        h1 { 
            font-size: 3rem; 
            font-weight: 800; 
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        h2 { 
            font-size: 2rem; 
            font-weight: 700; 
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 3rem 0 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 3px solid #667eea;
        }
        h3 { 
            font-size: 1.5rem; 
            font-weight: 600; 
            color: #374151;
            margin: 2rem 0 1rem;
            padding-left: 1rem;
            border-left: 4px solid #667eea;
        }
        h4 { 
            font-size: 1.25rem; 
            font-weight: 600; 
            color: #6b7280;
            margin: 1.5rem 0 0.75rem;
        }
        p { 
            margin: 1rem 0; 
            color: #374151;
            font-size: 1.05rem;
        }
        ul, ol {
            margin: 1rem 0 1rem 2rem;
            color: #374151;
        }
        li {
            margin: 0.5rem 0;
            line-height: 1.6;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 2rem 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-radius: 12px;
            overflow: hidden;
        }
        thead { 
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        th { 
            padding: 1.25rem; 
            text-align: left; 
            font-weight: 600;
            font-size: 1.05rem;
        }
        td { 
            padding: 1rem 1.25rem; 
            border-bottom: 1px solid #e5e7eb;
        }
        tbody tr:hover { 
            background: #f9fafb;
            transition: background 0.2s;
        }
        code { 
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            padding: 0.2rem 0.6rem; 
            border-radius: 6px;
            font-size: 0.9em;
            color: #92400e;
            font-family: 'Monaco', 'Courier New', monospace;
        }
        pre { 
            background: #1f2937; 
            color: #e5e7eb; 
            padding: 1.5rem; 
            border-radius: 12px;
            overflow-x: auto;
            margin: 1.5rem 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border: 1px solid #374151;
        }
        pre code { 
            background: transparent; 
            color: inherit; 
            padding: 0;
            border-radius: 0;
        }
        hr { 
            border: none; 
            border-top: 2px solid #e5e7eb; 
            margin: 3rem 0;
        }
        strong { 
            color: #1f2937; 
            font-weight: 600;
        }
        .badge {
            display: inline-block;
            padding: 0.35rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin: 0 0.25rem;
        }
        .badge-high {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        .badge-medium {
            background: linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%);
            color: #92400e;
        }
        .badge-low {
            background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
            color: #1e3a8a;
        }
        .meta-info {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin-top: 1.5rem;
            flex-wrap: wrap;
        }
        .meta-item {
            background: rgba(255,255,255,0.2);
            padding: 0.75rem 1.5rem;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            font-size: 0.95rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Bella ERP - Lộ Trình Refactoring 2026</h1>
            <div class="meta-info">
                <div class="meta-item">📅 17 tháng 6, 2026</div>
                <div class="meta-item">📊 Current: 94.2/100</div>
                <div class="meta-item">🎯 Target: 97.8/100</div>
                <div class="meta-item">⏱️ 6-8 tuần</div>
            </div>
        </div>
        <div class="content-wrapper">
            ${content}
        </div>
    </div>
</body>
</html>`;

fs.writeFileSync('docs/REFACTORING_ROADMAP_2026.html', html, 'utf8');
console.log('✅ Created REFACTORING_ROADMAP_2026.html with professional styling');
