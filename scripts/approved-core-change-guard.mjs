import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CORE_FILE_PATTERN = /^src\/core\//;
const APPROVAL_BLOCK_PATTERN = /<!--\s*APPROVED_CORE_CHANGE_V1\s*([\s\S]*?)\s*-->/g;
const WILDCARD_PATTERN = /[*?[\]{}]/;

function normalizePath(file) {
  return String(file ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function runGit(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

function uniqueSorted(files) {
  return [...new Set(files.map(normalizePath).filter(Boolean))].sort();
}

function parseArgs(argv) {
  const options = {
    acrDir: 'docs/architecture/acr',
    files: null,
    base: null,
    head: null,
    pr: process.env.PR_NUMBER || process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--acr-dir') {
      options.acrDir = argv[++index];
    } else if (arg === '--base') {
      options.base = argv[++index];
    } else if (arg === '--head') {
      options.head = argv[++index];
    } else if (arg === '--pr') {
      options.pr = argv[++index];
    } else if (arg === '--files') {
      options.files = argv.slice(index + 1);
      break;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function changedFilesFromGit(base, head) {
  if (!base || !head) {
    throw new Error('Missing --base/--head for git diff file resolution.');
  }

  const output = runGit(['diff', '--name-only', base, head]);
  return output ? output.split(/\r?\n/) : [];
}

function readMarkdownFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((entry) => entry.toLowerCase().endsWith('.md'))
    .map((entry) => path.join(directory, entry))
    .filter((file) => statSync(file).isFile());
}

function parseApprovalBlocks(file) {
  const content = readFileSync(file, 'utf8');
  const approvals = [];
  let match;

  while ((match = APPROVAL_BLOCK_PATTERN.exec(content)) !== null) {
    try {
      approvals.push({
        file: normalizePath(file),
        metadata: JSON.parse(match[1]),
      });
    } catch (error) {
      throw new Error(`Malformed APPROVED_CORE_CHANGE_V1 metadata in ${file}: ${error.message}`);
    }
  }

  return approvals;
}

function collectApprovals(acrDir) {
  return readMarkdownFiles(acrDir).flatMap(parseApprovalBlocks);
}

function requireString(metadata, key) {
  const value = metadata[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Approval metadata missing required string: ${key}`);
  }
  return value.trim();
}

function requireBoolean(metadata, key) {
  const value = metadata[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Approval metadata missing required boolean: ${key}`);
  }
  return value;
}

function validateApprovedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Approval metadata must list approvedCoreFiles.');
  }

  const normalized = uniqueSorted(files);
  if (normalized.length !== files.length) {
    throw new Error('approvedCoreFiles must not contain duplicates or blank entries.');
  }

  for (const file of normalized) {
    if (!CORE_FILE_PATTERN.test(file)) {
      throw new Error(`Approved file is not under src/core: ${file}`);
    }
    if (WILDCARD_PATTERN.test(file) || file.endsWith('/')) {
      throw new Error(`Wildcard or directory-level Core approval is forbidden: ${file}`);
    }
  }

  return normalized;
}

function validateApproval(approval, prNumber) {
  const { metadata } = approval;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`Approval metadata must be an object in ${approval.file}.`);
  }
  if (metadata.version !== 1) {
    throw new Error(`Unsupported approved Core change contract version in ${approval.file}.`);
  }

  const acrId = requireString(metadata, 'acrId');
  const status = requireString(metadata, 'status');
  const approver = requireString(metadata, 'approver');
  const approvedDate = requireString(metadata, 'approvedDate');
  const purpose = requireString(metadata, 'purpose');

  if (status !== 'APPROVED') {
    throw new Error(`ACR ${acrId} is not APPROVED.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(approvedDate)) {
    throw new Error(`ACR ${acrId} approvedDate must be YYYY-MM-DD.`);
  }
  if (!approver || /^pending$/i.test(approver)) {
    throw new Error(`ACR ${acrId} approver is ambiguous.`);
  }
  if (!purpose) {
    throw new Error(`ACR ${acrId} purpose is required.`);
  }

  if (String(metadata.pr) !== String(prNumber)) {
    throw new Error(`ACR ${acrId} is bound to PR ${metadata.pr}, not PR ${prNumber}.`);
  }

  for (const key of ['contractChange', 'schemaChange', 'rpcChange', 'apiChange', 'ownershipChange']) {
    requireBoolean(metadata, key);
  }

  return {
    acrId,
    file: approval.file,
    approvedFiles: validateApprovedFiles(metadata.approvedCoreFiles),
  };
}

function sameSet(left, right) {
  const normalizedLeft = uniqueSorted(left);
  const normalizedRight = uniqueSorted(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((file, index) => file === normalizedRight[index]);
}

export function verifyApprovedCoreChange({
  changedFiles,
  approvals,
  prNumber,
}) {
  const actualCoreFiles = uniqueSorted(changedFiles).filter((file) => CORE_FILE_PATTERN.test(file));
  if (actualCoreFiles.length === 0) {
    return {
      status: 'PASS',
      reason: 'No src/core changes detected.',
      actualCoreFiles,
    };
  }

  if (!prNumber) {
    throw new Error('Core changes require a PR/change binding, but no PR number was provided.');
  }
  if (!approvals.length) {
    throw new Error('Core changes detected but no APPROVED_CORE_CHANGE_V1 metadata was found.');
  }

  const validatedApprovals = [];
  const validationErrors = [];
  for (const approval of approvals) {
    try {
      validatedApprovals.push(validateApproval(approval, prNumber));
    } catch (error) {
      validationErrors.push(error.message);
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(`Invalid approved Core change metadata.\n${validationErrors.join('\n')}`);
  }

  const matchingApprovals = validatedApprovals.filter((approval) =>
    sameSet(approval.approvedFiles, actualCoreFiles)
  );

  if (matchingApprovals.length !== 1) {
    const approvedSets = validatedApprovals
      .map((approval) => `${approval.acrId}: ${approval.approvedFiles.join(', ')}`)
      .join(' | ');
    const diagnostics = [
      `Actual Core files: ${actualCoreFiles.join(', ')}`,
      approvedSets ? `Approved Core file sets: ${approvedSets}` : 'Approved Core file sets: none',
    ].filter(Boolean).join('\n');

    throw new Error(`Core diff does not exactly match one approved ACR scope.\n${diagnostics}`);
  }

  return {
    status: 'PASS',
    reason: `Core change approved by ${matchingApprovals[0].acrId}.`,
    actualCoreFiles,
    acrId: matchingApprovals[0].acrId,
    acrFile: matchingApprovals[0].file,
  };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const changedFiles = options.files ?? changedFilesFromGit(options.base, options.head);
    const approvals = collectApprovals(options.acrDir);
    const result = verifyApprovedCoreChange({
      changedFiles,
      approvals,
      prNumber: options.pr,
    });

    console.log(`✅ Core Freeze Verification: ${result.reason}`);
    if (result.actualCoreFiles.length > 0) {
      console.log(`Approved Core files:\n${result.actualCoreFiles.map((file) => `- ${file}`).join('\n')}`);
      console.log(`ACR: ${result.acrId}`);
      console.log(`ACR file: ${result.acrFile}`);
    }
  } catch (error) {
    console.error('❌ Core Freeze Verification failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
