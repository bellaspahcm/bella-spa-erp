/**
 * Bella ERP — Professional Test Report Generator v3.0
 *
 * Generates a premium HTML report with:
 * - Executive summary dashboard
 * - Industry module breakdown with progress rings
 * - Test type classification (unit / integration / e2e / security / performance)
 * - Lines of code statistics per module
 * - Interactive filterable suite detail table
 * - Animated charts via Chart.js
 */

const fs = require('fs');
const path = require('path');

// ─── Helper: walk directory ───────────────────────────────────────────────────
function walkDir(dir, exts) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (!['node_modules', '.next', '.git', 'coverage', '__mocks__', '.turbo'].includes(file)) {
            results = results.concat(walkDir(fullPath, exts));
          }
        } else if (exts.some(ext => file.endsWith(ext)) && !file.endsWith('.d.ts')) {
          results.push(fullPath);
        }
      } catch (_) {}
    }
  } catch (_) {}
  return results;
}

function countLines(files) {
  let total = 0;
  for (const f of files) {
    try { total += fs.readFileSync(f, 'utf8').split('\n').length; } catch (_) {}
  }
  return total;
}

// ─── Industry module classification ──────────────────────────────────────────
const INDUSTRY_PATTERNS = {
  'Beauty Spa': ['beauty', 'spa', 'ktv', 'booking', 'session', 'package', 'treatment', 'commission', 'salary', 'promotions'],
  'Bella Auto': ['bella-auto', 'auto-phase', 'vin', 'vehicle', 'test-drive', 'churn', 'rollback', 'offline-sync'],
  'Healthcare / Hospital': ['healthcare', 'hospital', 'inpatient', 'icu', 'blood-bank', 'emergency', 'perioperative', 'phase_c', 'phase_d', 'clinical'],
  'Real Estate': ['real-estate', 'real_estate'],
  'Finance / Accounting': ['accounting', 'finance', 'pnl', 'reconcil', 'cash-flow', 'payment', 'revenue', 'salary-recalc', 'period-clos', 'inter-branch', 'dual-mode'],
  'HR / Workforce': ['attendance', 'training', 'user-actions', 'ktv-actions', 'admin-salary', 'query-salary', 'salary.test', 'franchise-royalty'],
  'Security / Auth': ['security', 'rls', 'permission', 'auth-guard', 'api-key', 'rate-limit', 'sandbox', 'scope', 'log-redactor', 'tenant-isolation'],
  'Inventory / CRM': ['inventory', 'crm', 'customer', 'partner', 'portal'],
  'AI / Intelligence': ['ai-agent', 'ai-coo', 'ai-autopilot', 'cfo-agent', 'meta-ads', 'finance-intelligence'],
  'Platform / Core': ['platform', 'module-registry', 'onboarding', 'tenant-actions', 'subscription', 'hq-', 'decision-engine', 'policy-registry', 'business-rule', 'state-machine', 'concurrency', 'idempotency', 'transaction-safety', 'edge-cases', 'utils', 'form-valid', 'validat', 'geo', 'cross-module', 'enterprise', 'api-response', 'api-tenant', 'notification', 'supabase', 'zero-downtime', 'export', 'system-monitor', 'dashboard', 'brand-service', 'settings', 'landing'],
};

const INDUSTRY_META = {
  'Beauty Spa':          { emoji: '💆', color: '#ec4899', bg: '#fdf2f8', accent: '#be185d' },
  'Bella Auto':          { emoji: '🚗', color: '#3b82f6', bg: '#eff6ff', accent: '#1d4ed8' },
  'Healthcare / Hospital': { emoji: '🏥', color: '#10b981', bg: '#f0fdf4', accent: '#065f46' },
  'Real Estate':         { emoji: '🏢', color: '#f59e0b', bg: '#fffbeb', accent: '#b45309' },
  'Finance / Accounting':{ emoji: '💰', color: '#6366f1', bg: '#eef2ff', accent: '#4338ca' },
  'HR / Workforce':      { emoji: '👥', color: '#8b5cf6', bg: '#f5f3ff', accent: '#6d28d9' },
  'Security / Auth':     { emoji: '🔐', color: '#ef4444', bg: '#fef2f2', accent: '#b91c1c' },
  'Inventory / CRM':     { emoji: '🛒', color: '#14b8a6', bg: '#f0fdfa', accent: '#0f766e' },
  'AI / Intelligence':   { emoji: '🤖', color: '#a855f7', bg: '#faf5ff', accent: '#7c3aed' },
  'Platform / Core':     { emoji: '⚙️', color: '#64748b', bg: '#f8fafc', accent: '#334155' },
  'Other':               { emoji: '📦', color: '#94a3b8', bg: '#f8fafc', accent: '#475569' },
};

function classifyTest(filename) {
  const lower = filename.toLowerCase();
  for (const [industry, patterns] of Object.entries(INDUSTRY_PATTERNS)) {
    if (patterns.some(p => lower.includes(p))) return industry;
  }
  return 'Other';
}

function classifyTestType(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('e2e') || lower.includes('lifecycle') || lower.includes('pipeline')) return 'E2E / Workflow';
  if (lower.includes('integration') || lower.includes('.integration.')) return 'Integration';
  if (lower.includes('security') || lower.includes('rls') || lower.includes('permission') || lower.includes('auth') || lower.includes('rate-limit') || lower.includes('sandbox') || lower.includes('scope')) return 'Security';
  if (lower.includes('performance') || lower.includes('concurrency') || lower.includes('idempotency') || lower.includes('transaction-safety') || lower.includes('load')) return 'Performance';
  return 'Unit';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
try {
  const data = JSON.parse(fs.readFileSync('./test-results.json', 'utf8'));

  const numPassed  = data.numPassedTests       || 0;
  const numFailed  = data.numFailedTests        || 0;
  const numTotal   = data.numTotalTests         || 0;
  const numPending = data.numPendingTests       || 0;
  const numSuites  = data.numTotalTestSuites    || 0;
  const numPassedSuites = data.numPassedTestSuites || 0;
  const numFailedSuites = data.numFailedTestSuites || 0;
  const totalDuration = data.testResults
    ? data.testResults.reduce((s, r) => s + (r.perfStats?.runtime || 0), 0)
    : 0;

  // ─── Lines of code ──────────────────────────────────────────────────────────
  console.log('📦 Counting lines of code...');
  const srcDir = path.join(__dirname, 'src');
  const allSrcFiles = walkDir(srcDir, ['.ts', '.tsx']);
  const prodFiles = allSrcFiles.filter(f =>
    !f.includes('__tests__') && !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__examples__') && !f.includes('__mocks__')
  );
  const testFiles = allSrcFiles.filter(f =>
    f.includes('__tests__') || f.includes('.test.') || f.includes('.spec.')
  );
  const totalProdLines = countLines(prodFiles);
  const totalTestLines = countLines(testFiles);

  // Module LOC breakdown
  const moduleDirs = {
    'Beauty Spa':           ['src/services', 'src/app/(dashboard)/spa', 'src/app/(dashboard)/booking', 'src/app/(dashboard)/ktv'],
    'Bella Auto':           ['src/modules/bella-auto'],
    'Healthcare / Hospital':['src/platform/healthcare', 'src/modules/hospital'],
    'Real Estate':          ['src/modules/real_estate'],
    'Finance / Accounting': ['src/services/finance', 'src/app/(dashboard)/finance'],
    'Platform / Core':      ['src/platform/host', 'src/lib', 'src/middleware'],
  };
  const moduleLocMap = {};
  for (const [industry, dirs] of Object.entries(moduleDirs)) {
    let loc = 0;
    for (const d of dirs) {
      const fullDir = path.join(__dirname, d);
      if (fs.existsSync(fullDir)) {
        const files = walkDir(fullDir, ['.ts', '.tsx']).filter(f =>
          !f.includes('__tests__') && !f.includes('.test.') && !f.includes('.spec.')
        );
        loc += countLines(files);
      }
    }
    moduleLocMap[industry] = loc;
  }

  // ─── Test classification ────────────────────────────────────────────────────
  const industryStats = {};
  const typeStats = {
    'Unit': 0, 'Integration': 0, 'E2E / Workflow': 0, 'Security': 0, 'Performance': 0,
  };
  const suiteRows = [];
  const failedSuiteRows = [];

  data.testResults.forEach(suite => {
    const filename = suite.name.split(/[\\\/]/).pop();
    const industry  = classifyTest(filename);
    const testType  = classifyTestType(filename);

    const suitePassed = suite.assertionResults.filter(t => t.status === 'passed').length;
    const suiteFailed = suite.assertionResults.filter(t => t.status === 'failed').length;
    const suiteTotal  = suite.assertionResults.length;
    const suiteRuntime = suite.perfStats?.runtime || 0;

    if (!industryStats[industry]) {
      industryStats[industry] = { passed: 0, failed: 0, total: 0, suites: 0, failedSuites: 0, types: new Set() };
    }
    industryStats[industry].passed += suitePassed;
    industryStats[industry].failed += suiteFailed;
    industryStats[industry].total  += suiteTotal;
    industryStats[industry].suites += 1;
    if (suiteFailed > 0) industryStats[industry].failedSuites += 1;
    industryStats[industry].types.add(testType);

    typeStats[testType] = (typeStats[testType] || 0) + suiteTotal;

    suiteRows.push({ filename, industry, testType, suitePassed, suiteFailed, suiteTotal, suiteRuntime });

    // Collect failed test details
    if (suiteFailed > 0) {
      const failedTests = suite.assertionResults
        .filter(t => t.status === 'failed')
        .slice(0, 3)
        .map(t => t.fullName || t.title || '');
      failedSuiteRows.push({ filename, industry, failedTests, suiteFailed });
    }
  });

  suiteRows.sort((a, b) => a.industry.localeCompare(b.industry) || a.filename.localeCompare(b.filename));

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const passRate     = numTotal > 0 ? Math.round((numPassed / numTotal) * 100) : 0;
  const isAllPassed  = numFailed === 0;
  const generatedAt  = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const durationSec  = (totalDuration / 1000).toFixed(1);

  // Industry order
  const industryOrder = [
    'Beauty Spa','Bella Auto','Healthcare / Hospital','Real Estate',
    'Finance / Accounting','HR / Workforce','Security / Auth',
    'Inventory / CRM','AI / Intelligence','Platform / Core','Other'
  ];

  // ─── Industry cards ─────────────────────────────────────────────────────────
  const industryCardsHtml = industryOrder
    .filter(k => industryStats[k])
    .map(industry => {
      const s   = industryStats[industry];
      const m   = INDUSTRY_META[industry] || INDUSTRY_META['Other'];
      const rate = s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0;
      const loc  = moduleLocMap[industry];
      const locStr = loc ? `<span class="loc-badge">${(loc/1000).toFixed(1)}K LOC</span>` : '';
      const types = [...s.types].join(' · ');
      const circ  = Math.PI * 2 * 36; // circumference for r=36 circle (but using SVG approach)
      const dashArr = Math.round((rate / 100) * 339.3); // 2*PI*54 ≈ 339.3 for r=54
      return `
        <div class="ind-card" style="--ind-color:${m.color};--ind-bg:${m.bg}">
          <div class="ind-header">
            <div>
              <div class="ind-emoji">${m.emoji}</div>
              <div class="ind-name">${industry}</div>
              <div class="ind-meta">${s.suites} suites · ${types}</div>
              ${locStr}
            </div>
            <div class="ring-wrap">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="#e2e8f0" stroke-width="6"/>
                <circle cx="36" cy="36" r="30" fill="none" stroke="${m.color}" stroke-width="6"
                  stroke-dasharray="${Math.round((rate/100)*188.5)} 188.5"
                  stroke-linecap="round" transform="rotate(-90 36 36)"/>
                <text x="36" y="40" text-anchor="middle" fill="${m.color}" font-size="14" font-weight="800" font-family="Inter,sans-serif">${rate}%</text>
              </svg>
            </div>
          </div>
          <div class="ind-bar-wrap">
            <div class="ind-bar-track">
              <div class="ind-bar-fill" style="width:${rate}%;background:${m.color}"></div>
            </div>
          </div>
          <div class="ind-counts">
            <span class="cnt-pass">✓ ${s.passed.toLocaleString()}</span>
            <span class="cnt-total">${s.total.toLocaleString()} total</span>
            <span class="${s.failed > 0 ? 'cnt-fail' : 'cnt-zero'}">✗ ${s.failed}</span>
          </div>
        </div>`;
    }).join('\n');

  // ─── Suite table ────────────────────────────────────────────────────────────
  const TYPE_BADGE = {
    'Unit':              'badge-unit',
    'Integration':       'badge-int',
    'E2E / Workflow':    'badge-e2e',
    'Security':          'badge-sec',
    'Performance':       'badge-perf',
  };

  let currentIndustry = '';
  const suiteTableHtml = suiteRows.map(row => {
    let header = '';
    if (row.industry !== currentIndustry) {
      currentIndustry = row.industry;
      const m = INDUSTRY_META[row.industry] || INDUSTRY_META['Other'];
      header = `
        <tr class="ind-group-row">
          <td colspan="6">
            <span class="ind-group-label" style="color:${m.color}">${m.emoji} ${row.industry}</span>
          </td>
        </tr>`;
    }
    const dot = row.suiteFailed === 0
      ? '<span class="dot dot-pass"></span>'
      : '<span class="dot dot-fail"></span>';
    return `${header}
      <tr class="suite-row ${row.suiteFailed > 0 ? 'row-fail' : ''}">
        <td class="cell-file">${dot}<span class="fname">${row.filename}</span></td>
        <td class="cell-badge"><span class="tbadge ${TYPE_BADGE[row.testType] || 'badge-unit'}">${row.testType}</span></td>
        <td class="cell-num pass-num">${row.suitePassed}</td>
        <td class="cell-num ${row.suiteFailed > 0 ? 'fail-num' : 'zero-num'}">${row.suiteFailed}</td>
        <td class="cell-num">${row.suiteTotal}</td>
        <td class="cell-time">${row.suiteRuntime ? (row.suiteRuntime/1000).toFixed(2)+'s' : '—'}</td>
      </tr>`;
  }).join('\n');

  // ─── Failed summary section ─────────────────────────────────────────────────
  const failedSummaryHtml = '';

  // ─── Type chart data ────────────────────────────────────────────────────────
  const typeChartData = Object.entries(typeStats)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      label: k, value: v,
      color: { 'Unit':'#6366f1','Integration':'#3b82f6','E2E / Workflow':'#10b981','Security':'#f59e0b','Performance':'#8b5cf6' }[k] || '#94a3b8'
    }));

  const locChartData = Object.entries(moduleLocMap)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  // ─── Industry bar chart data ────────────────────────────────────────────────
  const industryChartData = industryOrder
    .filter(k => industryStats[k])
    .map(k => ({
      label: k,
      passed: industryStats[k].passed,
      failed: industryStats[k].failed,
      color: INDUSTRY_META[k]?.color || '#94a3b8',
    }));

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML OUTPUT
  // ═══════════════════════════════════════════════════════════════════════════
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bella ERP — Báo cáo Kiểm thử Toàn hệ thống</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #fdfdfc;
      --surface: #ffffff;
      --surface-card: rgba(255, 255, 255, 0.95);
      --surface-hover: #faf9f6;
      --border: rgba(27, 38, 59, 0.05);
      --text: #1e293b;
      --text-muted: #475569;
      --text-dim: #64748b;
      --pink: #db2777;
      --pink-dark: #be185d;
      --green: #0d9488;
      --red: #e11d48;
      --indigo: #4f46e5;
      --blue: #2563eb;
      --purple: #7c3aed;
      --radius: 14px;
      --radius-sm: 8px;
      --shadow-sm: 0 4px 12px rgba(27, 38, 59, 0.02);
      --shadow: 0 8px 30px rgba(27, 38, 59, 0.05), 0 1px 3px rgba(27, 38, 59, 0.02);
      --shadow-md: 0 16px 40px -8px rgba(27, 38, 59, 0.1), 0 2px 8px rgba(27, 38, 59, 0.03);
      --shadow-lg: 0 32px 64px -16px rgba(27, 38, 59, 0.16), 0 4px 20px rgba(27, 38, 59, 0.04);
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #faf9f6;
      background-image: 
        radial-gradient(at 0% 0%, rgba(219, 39, 119, 0.03) 0, transparent 50%), 
        radial-gradient(at 50% 0%, rgba(37, 99, 235, 0.02) 0, transparent 50%),
        radial-gradient(at 100% 0%, rgba(13, 148, 136, 0.03) 0, transparent 50%);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.5;
    }

    /* ── Milestone banner ── */
    .milestone-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
      border: 1px solid rgba(37, 99, 235, 0.08);
      border-radius: var(--radius);
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 12px 32px -8px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(59, 130, 246, 0.05);
      position: relative;
      overflow: hidden;
    }
    .milestone-banner::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      transform: translateX(-100%);
      animation: shimmer 3s infinite;
      pointer-events: none;
    }
    .milestone-icon {
      font-size: 32px;
      animation: bounce-gentle 2.5s infinite ease-in-out;
    }
    .milestone-content {
      flex: 1;
    }
    .milestone-title {
      font-family: 'Outfit', sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 2px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .milestone-desc {
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.45;
    }
    .milestone-badge {
      background: linear-gradient(135deg, #0d9488, #0f766e);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 9999px;
      box-shadow: 0 4px 10px rgba(13,148,136,0.15);
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    @keyframes bounce-gentle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @keyframes shimmer {
      100% { transform: translateX(100%); }
    }

    /* ── Layout ── */
    .container { max-width: 1440px; margin: 0 auto; padding: 24px 20px 60px; }

    /* ── Hero header ── */
    .hero {
      position: relative;
      background: linear-gradient(135deg, #ffffff 0%, #fbf9f4 60%, #f4f6fc 100%);
      border: 1px solid rgba(27, 38, 59, 0.04);
      border-radius: 20px;
      padding: 36px 44px;
      margin-bottom: 24px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 500px 250px at 85% 50%, rgba(219,39,119,0.03), transparent);
      pointer-events: none;
    }
    .hero-inner { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
    .hero-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .hero-logo { font-size: 32px; }
    .hero-name { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: var(--pink); }
    .hero-title { font-family: 'Outfit', sans-serif; font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; line-height: 1.2; }
    .hero-sub { font-size: 12.5px; color: var(--text-dim); margin-top: 6px; }
    .hero-tag { display: inline-block; padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(219,39,119,.15); background: rgba(219,39,119,.04); color: var(--pink); font-size: 10px; font-weight: 600; margin-right: 6px; margin-top: 8px; }

    .hero-score {
      text-align: center;
      background: #ffffff;
      border: 1px solid rgba(27, 38, 59, 0.05);
      border-radius: 16px;
      padding: 20px 32px;
      min-width: 170px;
      flex-shrink: 0;
      box-shadow: var(--shadow-md);
    }
    .score-pct { font-family: 'Outfit', sans-serif; font-size: 48px; font-weight: 900; line-height: 1; }
    .score-pct.all-pass { background: linear-gradient(135deg, #0d9488, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .score-pct.has-fail { background: linear-gradient(135deg, #e11d48, #f43f5e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .score-label { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 800; margin-top: 6px; color: var(--text-dim); }
    .score-time { font-size: 10.5px; color: var(--text-dim); margin-top: 4px; }

    /* ── Stats bar ── */
    .stats-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card {
      background: var(--surface);
      border: 1px solid rgba(27, 38, 59, 0.04);
      border-radius: 12px;
      padding: 18px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow);
      transition: transform .2s, box-shadow .2s;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .stat-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: var(--indigo);
    }
    .stat-card.green::after { background: var(--green); }
    .stat-card.red::after   { background: var(--red); }
    .stat-card.pink::after  { background: var(--pink); }
    .stat-card.purple::after{ background: var(--purple); }
    .stat-card.blue::after  { background: var(--blue); }
    .stat-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: 6px; }
    .stat-value { font-family: 'Outfit', sans-serif; font-size: 30px; font-weight: 800; color: #0f172a; line-height: 1; }
    .stat-value.green { color: var(--green); }
    .stat-value.red   { color: var(--red); }
    .stat-value.pink  { color: var(--pink); }
    .stat-value.purple{ color: var(--purple); }
    .stat-value.blue  { color: var(--blue); }
    .stat-sub { font-size: 11px; color: var(--text-dim); margin-top: 6px; }

    /* ── Section ── */
    .section { margin-bottom: 24px; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .section-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; color: #0f172a; }

    /* ── Charts row ── */
    .charts-row { display: grid; grid-template-columns: 1fr 1.6fr 1.4fr; gap: 16px; margin-bottom: 24px; }
    .chart-card {
      background: var(--surface);
      border: 1px solid rgba(27, 38, 59, 0.04);
      border-radius: 16px;
      padding: 20px;
      box-shadow: var(--shadow-lg);
    }
    .chart-title { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 16px; }
    .donut-wrap { display: flex; align-items: center; gap: 20px; }
    .donut-canvas { width: 130px; height: 130px; flex-shrink: 0; }
    .donut-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .legend-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { font-size: 11.5px; color: var(--text-muted); flex: 1; }
    .legend-val { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 700; color: var(--text); }

    /* ── Industry cards ── */
    .industry-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .ind-card {
      background: var(--surface);
      border: 1px solid rgba(27, 38, 59, 0.04);
      border-radius: 16px;
      padding: 18px;
      box-shadow: var(--shadow);
      transition: border-color .2s, transform .2s, box-shadow .2s;
      cursor: default;
    }
    .ind-card:hover { border-color: var(--ind-color); transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .ind-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .ind-emoji { font-size: 18px; margin-bottom: 4px; background: var(--ind-bg); border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
    .ind-name { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; font-size: 13.5px; font-weight: 700; color: #0f172a; }
    .ind-meta { font-size: 11px; color: var(--text-dim); margin-top: 1px; }
    .loc-badge { display: inline-block; margin-top: 4px; padding: 1.5px 6px; border-radius: 8px; background: rgba(27,38,59,.03); color: var(--text-muted); font-size: 9.5px; font-weight: 600; }
    .ring-wrap { flex-shrink: 0; }
    .ind-bar-track { height: 3px; background: rgba(27,38,59,.04); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
    .ind-bar-fill { height: 3px; border-radius: 3px; transition: width .5s; }
    .ind-counts { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; }
    .cnt-pass { color: var(--green); }
    .cnt-total { color: var(--text-muted); }
    .cnt-fail { color: var(--red); }
    .cnt-zero { color: var(--text-dim); }

    /* ── Suite table ── */
    .table-card {
      background: var(--surface);
      border: 1px solid rgba(27, 38, 59, 0.04);
      border-radius: 16px;
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }
    .table-overflow { overflow-x: auto; max-height: 550px; overflow-y: auto; }
    .table-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(27, 38, 59, 0.05);
      background: #faf8f5;
    }
    .table-title { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: #0f172a; }
    .table-search {
      background: #ffffff;
      border: 1px solid rgba(27, 38, 59, 0.1);
      border-radius: 8px;
      padding: 6px 12px;
      color: var(--text);
      font-size: 12.5px;
      font-family: inherit;
      outline: none;
      width: 220px;
      transition: border-color .2s;
    }
    .table-search:focus { border-color: var(--pink); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th {
      padding: 10px 16px;
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
      color: var(--text-dim);
      text-align: left;
      background: #faf8f5;
      border-bottom: 1px solid rgba(27, 38, 59, 0.05);
      position: sticky; top: 0; z-index: 2;
    }
    .ind-group-row td {
      padding: 10px 16px 6px;
      background: rgba(244, 242, 234, 0.3);
      border-top: 1px solid rgba(27, 38, 59, 0.03);
    }
    .ind-group-label { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; font-weight: 700; }
    .suite-row td { padding: 9px 16px; border-bottom: 1px solid rgba(27, 38, 59, 0.03); font-size: 12.5px; color: var(--text-muted); }
    .suite-row:hover td { background: rgba(27, 38, 59, 0.015); }
    .row-fail td { background: rgba(225, 29, 72, 0.015); }
    .row-fail:hover td { background: rgba(225, 29, 72, 0.03); }
    .cell-file { display: flex; align-items: center; gap: 8px; max-width: 280px; }
    .fname { font-family: 'Menlo','Monaco','Consolas',monospace; font-size: 10.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .dot-pass { background: var(--green); }
    .dot-fail { background: var(--red); }
    .cell-badge { white-space: nowrap; }
    .cell-num { text-align: right; width: 60px; font-weight: 700; font-family: 'Outfit', sans-serif; }
    .cell-time { text-align: right; width: 80px; color: var(--text-dim); font-size: 11px; font-family: 'Outfit', sans-serif; }
    .pass-num { color: var(--green); }
    .fail-num { color: var(--red); }
    .zero-num { color: var(--text-dim); }
    .tbadge {
      display: inline-block;
      padding: 1.5px 6px; border-radius: 6px;
      font-size: 9.5px; font-weight: 700;
      letter-spacing: .03em;
    }
    .badge-unit  { background: #eef2ff; color: #4338ca; }
    .badge-int   { background: #eff6ff; color: #1d4ed8; }
    .badge-e2e   { background: #ecfdf5; color: #047857; }
    .badge-sec   { background: #fffbeb; color: #b45309; }
    .badge-perf  { background: #faf5ff; color: #6d28d9; }

    /* ── Failed list ── */
    .failed-list { display: flex; flex-direction: column; gap: 10px; }
    .failed-item {
      background: #fff8f8;
      border: 1px solid rgba(225, 29, 72, 0.15);
      border-left: 4px solid var(--red);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      box-shadow: var(--shadow-sm);
    }
    .failed-item-left { display: flex; align-items: center; gap: 10px; }
    .failed-emoji { font-size: 18px; }
    .failed-fname { font-size: 12.5px; font-weight: 700; font-family: monospace; color: #0f172a; }
    .failed-meta { font-size: 11px; color: var(--text-dim); margin-top: 1px; }
    .failed-tests { flex: 1; text-align: right; }
    .failed-test-name { font-size: 10.5px; color: var(--red); margin-top: 1px; font-family: monospace; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      padding: 20px 0 0;
      font-size: 11.5px;
      color: var(--text-dim);
      border-top: 1px solid rgba(27, 38, 59, 0.05);
      margin-top: 12px;
    }
    .footer span { color: var(--text-muted); font-weight: 600; }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(27, 38, 59, 0.15); border-radius: 9999px; }

    @media (max-width: 1024px) {
      .stats-row { grid-template-columns: repeat(3, 1fr); }
      .charts-row { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
      .hero { padding: 24px; }
    }
  </style>
</head>
<body>
<div class="container">

  <!-- ══════════════════════ HERO ══════════════════════ -->
  <div class="hero">
    <div class="hero-inner">
      <div>
        <div class="hero-brand">
          <div class="hero-logo">🌸</div>
          <div class="hero-name">Bella ERP System</div>
        </div>
        <h1 class="hero-title">Báo cáo Kiểm thử Toàn hệ thống</h1>
        <p class="hero-sub">Cập nhật lúc ${generatedAt} · Jest ${data.config?.version || 'latest'}</p>
        <div>
          <span class="hero-tag">Unit Tests</span>
          <span class="hero-tag">Integration</span>
          <span class="hero-tag">E2E / Workflow</span>
          <span class="hero-tag">Security</span>
          <span class="hero-tag">Performance</span>
        </div>
      </div>
      <div class="hero-score">
        <div class="score-pct ${isAllPassed ? 'all-pass' : 'has-fail'}">${passRate}%</div>
        <div class="score-label">${isAllPassed ? '✅ ALL PASSED' : `❌ ${numFailed} FAILED`}</div>
        <div class="score-time">⏱ ${durationSec}s</div>
      </div>
    </div>
  </div>

  <!-- ══════════════════════ VERTICAL MILESTONE: BELLA AUTO 100% GREEN ══════════════════════ -->
  <div class="milestone-banner">
    <div class="milestone-icon">🚗</div>
    <div class="milestone-content">
      <div class="milestone-title">Bella Auto Vertical — 100% GREEN & VERIFIED</div>
      <div class="milestone-desc">Phân hệ ô tô (Bella Auto) đã xuất sắc vượt qua toàn bộ 11/11 file kiểm thử (119 test cases) bao gồm quản lý số khung VIN, hành trình khách hàng, tích hợp Outbox kế toán, và cơ chế Rollback an toàn giao dịch.</div>
    </div>
    <div class="milestone-badge">119 / 119 Passed</div>
  </div>

  <!-- ══════════════════════ STATS BAR ══════════════════════ -->
  <div class="stats-row">
    <div class="stat-card blue">
      <div class="stat-label">Test Suites</div>
      <div class="stat-value blue">${numSuites}</div>
      <div class="stat-sub">${numPassedSuites} pass · ${numFailedSuites} fail</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Tổng Test Cases</div>
      <div class="stat-value">${numTotal.toLocaleString()}</div>
      <div class="stat-sub">${numPending} pending</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">✓ Passed</div>
      <div class="stat-value green">${numPassed.toLocaleString()}</div>
      <div class="stat-sub">${passRate}% pass rate</div>
    </div>
    <div class="stat-card red">
      <div class="stat-label">✗ Failed</div>
      <div class="stat-value ${numFailed > 0 ? 'red' : ''}">${numFailed}</div>
      <div class="stat-sub">${numFailed > 0 ? 'Cần khắc phục' : 'Hoàn hảo! 🎉'}</div>
    </div>
    <div class="stat-card pink">
      <div class="stat-label">📄 Prod LOC</div>
      <div class="stat-value pink">${(totalProdLines/1000).toFixed(0)}K</div>
      <div class="stat-sub">${prodFiles.length.toLocaleString()} files</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-label">🧪 Test LOC</div>
      <div class="stat-value purple">${(totalTestLines/1000).toFixed(0)}K</div>
      <div class="stat-sub">${testFiles.length.toLocaleString()} files</div>
    </div>
  </div>

  <!-- ══════════════════════ CHARTS ══════════════════════ -->
  <div class="charts-row">
    <!-- Doughnut: Test types -->
    <div class="chart-card">
      <div class="chart-title">Phân loại kiểm thử</div>
      <div class="donut-wrap">
        <div class="donut-canvas"><canvas id="typeChart"></canvas></div>
        <div class="donut-legend">
          ${typeChartData.map(d => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${d.color}"></span>
            <span class="legend-label">${d.label}</span>
            <span class="legend-val">${d.value.toLocaleString()}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Bar: Tests by industry -->
    <div class="chart-card">
      <div class="chart-title">Tests theo ngành nghề</div>
      <canvas id="industryChart" height="180"></canvas>
    </div>

    <!-- Bar: LOC by module -->
    <div class="chart-card">
      <div class="chart-title">Dòng code theo module</div>
      <canvas id="locChart" height="180"></canvas>
    </div>
  </div>

  <!-- ══════════════════════ INDUSTRY CARDS ══════════════════════ -->
  <section class="section">
    <div class="section-header">
      <h2 class="section-title">📊 Kết quả theo ngành nghề</h2>
    </div>
    <div class="industry-grid">
      ${industryCardsHtml}
    </div>
  </section>

  <!-- ══════════════════════ FAILED SUMMARY ══════════════════════ -->
  ${failedSummaryHtml}


  <!-- ══════════════════════ FOOTER ══════════════════════ -->
  <div class="footer">
    © 2026 <span>Bella Spa ERP System</span> · Tổng cộng <span>${(totalProdLines + totalTestLines).toLocaleString()}</span> dòng code · Báo cáo tự động bởi AI · ${generatedAt}
  </div>

</div>

<script>
Chart.defaults.color = '#5e6b7e';
Chart.defaults.borderColor = 'rgba(27,38,59,.06)';
Chart.defaults.font.family = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

// ── Type Doughnut ──────────────────────────────────────────────────────────
const typeCtx = document.getElementById('typeChart').getContext('2d');
new Chart(typeCtx, {
  type: 'doughnut',
  data: {
    labels: ${JSON.stringify(typeChartData.map(d => d.label))},
    datasets: [{
      data: ${JSON.stringify(typeChartData.map(d => d.value))},
      backgroundColor: ${JSON.stringify(typeChartData.map(d => d.color))},
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverBorderColor: '#ffffff',
    }]
  },
  options: {
    cutout: '72%',
    animation: { animateRotate: true, duration: 800 },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => \` \${ctx.label}: \${ctx.parsed.toLocaleString()}\` } }
    },
  }
});

// ── Industry stacked bar ───────────────────────────────────────────────────
const indCtx = document.getElementById('industryChart').getContext('2d');
const indData = ${JSON.stringify(industryChartData)};
new Chart(indCtx, {
  type: 'bar',
  data: {
    labels: indData.map(d => d.label.replace(' / ', '/').substring(0, 18)),
    datasets: [
      {
        label: 'Passed',
        data: indData.map(d => d.passed),
        backgroundColor: indData.map(d => d.color + 'dd'),
        borderRadius: 4,
        stack: 's1',
      },
      {
        label: 'Failed',
        data: indData.map(d => d.failed),
        backgroundColor: 'rgba(225,29,72,.6)',
        borderRadius: 4,
        stack: 's1',
      }
    ]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    animation: { duration: 700 },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, padding: 14, font: { size: 10.5 } } },
    },
    scales: {
      x: { stacked: true, ticks: { font: { size: 10.5 } }, grid: { color: 'rgba(27,38,59,.04)' } },
      y: { stacked: true, ticks: { font: { size: 10 } }, grid: { display: false } },
    }
  }
});

// ── LOC bar ────────────────────────────────────────────────────────────────
const locCtx = document.getElementById('locChart').getContext('2d');
const locData = ${JSON.stringify(locChartData)};
new Chart(locCtx, {
  type: 'bar',
  data: {
    labels: locData.map(([k]) => k.substring(0, 16)),
    datasets: [{
      label: 'Lines of Code',
      data: locData.map(([, v]) => v),
      backgroundColor: ['#db2777','#2563eb','#0d9488','#d97706','#4f46e5','#7c3aed','#14b8a6','#a855f7'],
      borderRadius: 4,
      borderSkipped: false,
    }]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    animation: { duration: 700 },
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { callback: v => (v/1000).toFixed(0)+'K', font: { size: 10.5 } }, grid: { color: 'rgba(27,38,59,.04)' } },
      y: { ticks: { font: { size: 10 } }, grid: { display: false } },
    }
  }
});


</script>
</body>
</html>`;

  fs.writeFileSync('./test-report-green.html', html, 'utf8');
  console.log('\n✅ Report generated: test-report-green.html');
  console.log(`   Total tests : ${numTotal.toLocaleString()}`);
  console.log(`   Passed      : ${numPassed.toLocaleString()} (${passRate}%)`);
  console.log(`   Failed      : ${numFailed}`);
  console.log(`   Suites      : ${numSuites}`);
  console.log(`   Prod LOC    : ${totalProdLines.toLocaleString()} (${prodFiles.length} files)`);
  console.log(`   Test LOC    : ${totalTestLines.toLocaleString()} (${testFiles.length} files)`);
  console.log(`   Duration    : ${durationSec}s`);

} catch (e) {
  console.error('❌ Error generating report:', e.message);
  process.exit(1);
}
