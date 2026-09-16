import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PRODUCT_SCOPES = {
  english_center: {
    label: 'English Center',
    patterns: [
      /^src\/products\/bella-english-center\//,
      /^src\/app\/api\/english-center\//,
      /^src\/app\/dashboard\/english-center\//,
      /^docs\/products\/bella-english-center\//,
    ],
  },
  education_preschool: {
    label: 'Bella Preschool',
    patterns: [
      /^src\/products\/bella-education\//,
      /^src\/app\/api\/education\//,
      /^src\/app\/dashboard\/education\//,
      /^docs\/architecture\/education\//,
    ],
  },
  healthcare: {
    label: 'Healthcare Products',
    patterns: [
      /^src\/products\/bella-(medical|hospital|dental)\//,
      /^src\/modules\/bella-healthcare\//,
      /^docs\/products\/(medical|hospital|dental)\//,
    ],
  },
  real_estate: {
    label: 'Bella Land',
    patterns: [
      /^src\/products\/bella-land\//,
      /^src\/app\/dashboard\/real-estate\//,
      /^src\/modules\/real_estate\//,
    ],
  },
  mobile: {
    label: 'Mobile App',
    patterns: [
      /^apps\/mobile\//,
    ],
  },
};

const OS_SCOPES = {
  education: {
    label: 'Education OS',
    patterns: [
      /^src\/platform\/education\//,
      /^docs\/architecture\/EDUCATION_VERTICAL_CODING_CONSTITUTION\.md$/,
      /^tsconfig\.education\.json$/,
      /^scripts\/apply_education_/,
      /^scripts\/.*education.*\.(mjs|js|cjs|ts|sql)$/,
    ],
    affectedProducts: ['education_preschool', 'english_center'],
  },
  beauty: {
    label: 'Beauty OS',
    patterns: [
      /^src\/platform\/beauty\//,
      /^src\/products\/nail\//,
      /^src\/app\/dashboard\/nail\//,
      /^tsconfig\.beauty\.json$/,
      /^docs\/products\/(haircut|nail)\//,
    ],
    affectedProducts: [],
  },
  healthcare: {
    label: 'Healthcare OS',
    patterns: [
      /^src\/platform\/healthcare\//,
      /^docs\/architecture\/HEALTHCARE_VERTICAL_CODING_CONSTITUTION\.md$/,
      /^scripts\/healthcare\//,
      /^scripts\/ci-healthcare-/,
    ],
    affectedProducts: ['healthcare'],
  },
  logistics: {
    label: 'Logistics OS',
    patterns: [
      /^src\/platform\/logistics\//,
      /^scripts\/logistics\//,
      /^scripts\/architecture\//,
    ],
    affectedProducts: [],
  },
  real_estate: {
    label: 'Real Estate OS',
    patterns: [
      /^src\/platform\/real-estate\//,
    ],
    affectedProducts: ['real_estate'],
  },
};

const CODE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_PATTERN = /(^|\/)(__tests__|tests)\/|(\.)(test|spec)\.(ts|tsx|js|jsx)$/;
const MIGRATION_PATTERN = /(^supabase\/migrations\/|^prisma\/migrations\/|^migrations\/|\.sql$)/;
const DEPENDENCY_PATTERN = /(^|\/)(package|package-lock)\.json$|(^|\/)\.npmrc$/;
const API_DOCS_PATTERN = /^(src\/app\/api\/|docs\/(guides\/)?api-reference\.md|docs\/technical\/api-versioning-policy\.md|docs\/api\/|scripts\/check-api-(docs|versioning)\.mjs)/;
const DOC_PATTERN = /^docs\//;
const WORKFLOW_PATTERN = /^\.github\/workflows\//;
const ROOT_PLATFORM_PATTERN = /^(src\/(core|lib|services|shared|types|components\/layout)\/|packages\/|next\.config\.|instrumentation|tsconfig\.json|jest\.config|playwright\.config|eslint|postcss|tailwind|middleware\.ts$|next-env\.d\.ts$)/;
const APP_CODE_PATTERN = /^(src\/|apps\/mobile\/|packages\/).*\.(ts|tsx|js|jsx|mts)$/;
const ROOT_TYPECHECK_SURFACE_PATTERN = /^(src\/(core|lib|services|shared|types|components\/layout)\/|packages\/|tsconfig\.json$|next-env\.d\.ts$|next\.config\.|instrumentation|sentry\..*\.ts$|middleware\.ts$|package-lock\.json$)/;
const TYPECHECK_CONFIG_PATTERN = /^tsconfig(\..+)?\.json$/;
const DB_RUNTIME_SURFACE_PATTERN = /^(src\/(app|core|lib|modules|platform|products|services|shared)\/|supabase\/|database\/|prisma\/|migrations\/|.*\.sql$)/;
const SECURITY_SCRIPT_PATTERN = /^scripts\/(audit-production|check-secret-leaks|check-ci-quality-env)\.mjs$/;

function normalize(file) {
  return file.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
}

function gitOutput(args) {
  const result = run('git', args);
  if (result.status !== 0) {
    return '';
  }
  return result.stdout.trim();
}

function resolveChangedFiles() {
  const explicitFilesIndex = process.argv.indexOf('--files');
  if (explicitFilesIndex >= 0) {
    return process.argv.slice(explicitFilesIndex + 1).map(normalize).filter(Boolean);
  }

  const stdinIndex = process.argv.indexOf('--stdin');
  if (stdinIndex >= 0) {
    return readFileSync(0, 'utf8').split(/\r?\n/).map(normalize).filter(Boolean);
  }

  const eventName = process.env.GITHUB_EVENT_NAME;
  const baseRef = process.env.GITHUB_BASE_REF;

  if (eventName === 'pull_request' && baseRef) {
    run('git', ['fetch', '--no-tags', '--depth=1', 'origin', baseRef], { stdio: 'ignore' });
    const diff = gitOutput(['diff', '--name-only', `origin/${baseRef}...HEAD`]);
    return diff ? diff.split(/\r?\n/).map(normalize).filter(Boolean) : [];
  }

  const originMain = gitOutput(['rev-parse', '--verify', 'origin/main']);
  if (originMain) {
    const diff = gitOutput(['diff', '--name-only', 'origin/main...HEAD']);
    if (diff) {
      return diff.split(/\r?\n/).map(normalize).filter(Boolean);
    }
  }

  const previousCommit = gitOutput(['rev-parse', '--verify', 'HEAD^']);
  if (previousCommit) {
    const diff = gitOutput(['diff', '--name-only', 'HEAD^', 'HEAD']);
    return diff ? diff.split(/\r?\n/).map(normalize).filter(Boolean) : [];
  }

  return [];
}

function matchesAny(file, patterns) {
  return patterns.some((pattern) => pattern.test(file));
}

export function classifyFiles(files) {
  const normalizedFiles = files.map(normalize).filter(Boolean);
  const products = new Set();
  const os = new Set();

  let hasCode = false;
  let hasTest = false;
  let hasMigration = false;
  let hasDependencies = false;
  let hasApiDocs = false;
  let hasDocs = false;
  let hasWorkflow = false;
  let hasPlatform = false;
  let hasInfra = false;
  let hasSecuritySurface = false;
  let hasCore = false;
  let hasAppCode = false;
  let hasRootTypecheckSurface = false;
  let hasTypecheckConfig = false;
  let hasDbRuntimeSurface = false;

  for (const file of normalizedFiles) {
    hasCode ||= CODE_PATTERN.test(file);
    hasTest ||= TEST_PATTERN.test(file);
    hasMigration ||= MIGRATION_PATTERN.test(file);
    hasDependencies ||= DEPENDENCY_PATTERN.test(file);
    hasApiDocs ||= API_DOCS_PATTERN.test(file);
    hasDocs ||= DOC_PATTERN.test(file);
    hasWorkflow ||= WORKFLOW_PATTERN.test(file);
    hasSecuritySurface ||= SECURITY_SCRIPT_PATTERN.test(file);
    hasCore ||= /^src\/core\//.test(file);
    hasAppCode ||= APP_CODE_PATTERN.test(file) && !TEST_PATTERN.test(file);
    hasRootTypecheckSurface ||= ROOT_TYPECHECK_SURFACE_PATTERN.test(file);
    hasTypecheckConfig ||= TYPECHECK_CONFIG_PATTERN.test(file);
    hasDbRuntimeSurface ||= DB_RUNTIME_SURFACE_PATTERN.test(file);

    for (const [key, scope] of Object.entries(PRODUCT_SCOPES)) {
      if (matchesAny(file, scope.patterns)) {
        products.add(key);
      }
    }

    for (const [key, scope] of Object.entries(OS_SCOPES)) {
      if (matchesAny(file, scope.patterns)) {
        os.add(key);
      }
    }

    if (ROOT_PLATFORM_PATTERN.test(file) || hasWorkflow || hasDependencies) {
      hasPlatform = true;
    }

    if (/^(\.github\/|scripts\/|config\/|load-tests\/|e2e\/)/.test(file)) {
      hasInfra = true;
    }
  }

  const affectedProducts = new Set(products);
  for (const osKey of os) {
    for (const product of OS_SCOPES[osKey].affectedProducts) {
      affectedProducts.add(product);
    }
  }

  const docsOnly = normalizedFiles.length > 0
    && normalizedFiles.every((file) => DOC_PATTERN.test(file) || /^\.github\/pull_request_template\.md$/.test(file));
  const sourceTouched = hasCode || hasDependencies;
  const needsTypecheck = (hasAppCode || hasRootTypecheckSurface || hasTypecheckConfig) && !docsOnly;

  let scopeLevel = 'infra_only';
  if (hasPlatform) {
    scopeLevel = 'platform';
  } else if (os.size > 0) {
    scopeLevel = 'os';
  } else if (products.size > 0) {
    scopeLevel = 'product';
  } else if (docsOnly) {
    scopeLevel = 'docs_only';
  }

  const multiProductWithoutOs = scopeLevel === 'product' && products.size > 1;
  const scopeStatus = multiProductWithoutOs ? 'BLOCK' : 'ALLOW';
  const productLabels = [...products].map((key) => PRODUCT_SCOPES[key].label);
  const osLabels = [...os].map((key) => OS_SCOPES[key].label);
  const affectedProductLabels = [...affectedProducts].map((key) => PRODUCT_SCOPES[key]?.label ?? key);

  const needsTests = (hasCode || hasTest) && !docsOnly;
  const needsBuild = (hasCode || hasDependencies || scopeLevel === 'platform') && !hasMigration && !docsOnly;
  const needsArchitectureGuard = hasCode && !docsOnly;
  const needsRealDbE2e = hasMigration || (scopeLevel === 'platform' && hasDbRuntimeSurface);
  const needsE2e = scopeLevel === 'platform' || products.size > 0 || hasDependencies;
  const needsMigrationGates = hasMigration;
  const needsApiDocs = hasApiDocs;
  const needsDependencySecurityDeep = hasDependencies || hasSecuritySurface;
  const needsSecurityLightweight = sourceTouched || hasInfra;

  let typecheckMode = 'skip';
  if (needsTypecheck) {
    if (hasRootTypecheckSurface) {
      typecheckMode = 'full';
    } else if (scopeLevel === 'os' || os.size > 0 || affectedProducts.size > 1 || hasTypecheckConfig) {
      typecheckMode = 'affected';
    } else {
      typecheckMode = 'changed';
    }
  }

  const messageParts = [];
  messageParts.push(`scope=${scopeLevel}`);
  if (productLabels.length) messageParts.push(`products=${productLabels.join(', ')}`);
  if (osLabels.length) messageParts.push(`os=${osLabels.join(', ')}`);
  if (affectedProductLabels.length) messageParts.push(`affected=${affectedProductLabels.join(', ')}`);
  if (scopeStatus === 'BLOCK') {
    messageParts.push('multi-product product-only PR must be split or promoted through an OS/platform change');
  }

  return {
    changed_files: normalizedFiles,
    file_count: normalizedFiles.length,
    scope_status: scopeStatus,
    scope_level: scopeLevel,
    products: [...products],
    os: [...os],
    affected_products: [...affectedProducts],
    has_code: hasCode,
    has_app_code: hasAppCode,
    has_tests: hasTest,
    migrations_changed: hasMigration,
    dependencies_changed: hasDependencies,
    api_docs_changed: hasApiDocs,
    docs_changed: hasDocs,
    workflows_changed: hasWorkflow,
    core_changed: hasCore,
    has_db_runtime_surface: hasDbRuntimeSurface,
    needs_typecheck: needsTypecheck,
    needs_tests: needsTests,
    needs_build: needsBuild,
    needs_architecture_guard: needsArchitectureGuard,
    needs_real_db_e2e: needsRealDbE2e,
    needs_e2e: needsE2e,
    needs_migration_gates: needsMigrationGates,
    needs_api_docs: needsApiDocs,
    needs_dependency_security_deep: needsDependencySecurityDeep,
    needs_security_lightweight: needsSecurityLightweight,
    typecheck_mode: typecheckMode,
    scope_message: messageParts.join('; '),
  };
}

function githubValue(value) {
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function writeGithubOutputs(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const keys = [
    'scope_status',
    'scope_level',
    'products',
    'os',
    'affected_products',
    'migrations_changed',
    'dependencies_changed',
    'api_docs_changed',
    'core_changed',
    'needs_typecheck',
    'needs_tests',
    'needs_build',
    'needs_architecture_guard',
    'needs_real_db_e2e',
    'needs_e2e',
    'needs_migration_gates',
    'needs_api_docs',
    'needs_dependency_security_deep',
    'needs_security_lightweight',
    'typecheck_mode',
    'scope_message',
    'file_count',
  ];

  for (const key of keys) {
    appendFileSync(outputPath, `${key}=${githubValue(result[key])}\n`);
  }
}

function printSummary(result) {
  console.log('Dependency-aware CI routing result:');
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = classifyFiles(resolveChangedFiles());
  printSummary(result);
  writeGithubOutputs(result);
  if (process.argv.includes('--fail-on-block') && result.scope_status === 'BLOCK') {
    process.exit(1);
  }
}
