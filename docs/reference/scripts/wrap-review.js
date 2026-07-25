const fs = require('fs');

const content = fs.readFileSync('docs/BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026_basic.html', 'utf8');

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bella ERP - Executive Codebase Review 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, sans-serif; 
            line-height: 1.8; 
            color: #1f2937;
            background: linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        h1 { 
            font-size: 3.5rem; 
            font-weight: 800; 
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 3rem 0 2rem;
            text-align: center;
        }
        h2 { 
            font-size: 2rem; 
            font-weight: 700; 
            color: #667eea;
            margin: 3rem 0 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 3px solid #667eea;
        }
        h3 { 
            font-size: 1.5rem; 
            font-weight: 600; 
            color: #374151;
            margin: 2rem 0 1rem;
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
        tbody tr:hover { background: #f9fafb; }
        code { 
            background: #f3f4f6; 
            padding: 0.2rem 0.6rem; 
            border-radius: 6px;
            font-size: 0.95em;
            color: #ec4899;
        }
        pre { 
            background: #1f2937; 
            color: #e5e7eb; 
            padding: 1.5rem; 
            border-radius: 12px;
            overflow-x: auto;
            margin: 1.5rem 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        pre code { 
            background: transparent; 
            color: inherit; 
            padding: 0;
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
    </style>
</head>
<body>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;

fs.writeFileSync('docs/BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026.html', html, 'utf8');
console.log('✅ Created BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026.html');
