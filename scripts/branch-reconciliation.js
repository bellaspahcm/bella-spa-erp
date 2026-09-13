#!/usr/bin/env node
/**
 * Branch Reconciliation Script
 * 
 * Detects stale, superseded, and merged branches
 * Generates daily reconciliation report
 * 
 * Usage:
 *   node scripts/branch-reconciliation.js
 * 
 * Output:
 *   BRANCH_RECONCILIATION_REPORT.md
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  STALE_DAYS: 7,
  ALERT_DAYS: 14,
  MAX_BRANCH_AGE_DAYS: 30,
  REPORT_PATH: 'BRANCH_RECONCILIATION_REPORT.md'
};

// Execute git command
function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf-8' }).trim();
  } catch (error) {
    return '';
  }
}

// Get all remote branches
function getRemoteBranches() {
  const output = git('branch -r --format="%(refname:short)|%(committerdate:iso)|%(authorname)"');
  if (!output) return [];
  
  return output.split('\n')
    .filter(line => line && !line.includes('HEAD'))
    .map(line => {
      const [ref, date, author] = line.split('|');
      return {
        name: ref.replace('origin/', ''),
        ref,
        date: new Date(date),
        author,
        age: Math.floor((Date.now() - new Date(date)) / (1000 * 60 * 60 * 24))
      };
    });
}

// Check if branch is merged to main
function isMerged(branchName) {
  const merged = git('branch -r --merged origin/main --format="%(refname:short)"');
  return merged.includes(`origin/${branchName}`);
}

// Get open PRs for branch
function getOpenPR(branchName) {
  try {
    const output = execSync(`gh pr list --head ${branchName} --json number,title,state`, { encoding: 'utf-8' });
    const prs = JSON.parse(output);
    return prs.find(pr => pr.state === 'OPEN');
  } catch {
    return null;
  }
}

// Check if branch work is superseded (in main via different commit)
function isSuperseded(branchName) {
  // Get branch's unique commits
  const commits = git(`log origin/${branchName} --not origin/main --format="%s"`);
  if (!commits) return false;
  
  // Check if commit messages appear in main history
  const commitMessages = commits.split('\n').filter(Boolean);
  const mainLog = git('log origin/main --format="%s"');
  
  // If all commit subjects are in main, likely superseded
  const supersededCount = commitMessages.filter(msg => mainLog.includes(msg)).length;
  return supersededCount > 0 && supersededCount >= commitMessages.length * 0.7; // 70% threshold
}

// Get file count in branch diff
function getFileCount(branchName) {
  try {
    const files = git(`diff --name-only origin/main...origin/${branchName}`);
    return files ? files.split('\n').filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

// Detect scope from branch name and files
function detectScope(branchName, fileCount) {
  const scopes = [];
  
  // Infer from branch name
  if (branchName.includes('platform/')) scopes.push('Platform');
  if (branchName.includes('product/')) scopes.push('Product');
  if (branchName.includes('english-center')) scopes.push('English Center');
  if (branchName.includes('bella-land')) scopes.push('Bella Land');
  if (branchName.includes('finance')) scopes.push('Finance');
  if (branchName.includes('identity')) scopes.push('Identity');
  
  // Warning if too many files
  if (fileCount > 100) scopes.push('⚠️ LARGE');
  
  return scopes.length > 0 ? scopes.join(', ') : 'Unknown';
}

// Classify branch
function classifyBranch(branch) {
  if (branch.name === 'main' || branch.name === 'master') {
    return { status: 'PROTECTED', priority: 0, action: 'None' };
  }
  
  const merged = isMerged(branch.name);
  if (merged) {
    return { status: 'MERGED', priority: 1, action: 'Auto-delete' };
  }
  
  const superseded = isSuperseded(branch.name);
  if (superseded) {
    return { status: 'SUPERSEDED', priority: 2, action: 'Close + Delete' };
  }
  
  const openPR = getOpenPR(branch.name);
  if (openPR) {
    return { status: 'PR_OPEN', priority: 3, action: `Monitor PR #${openPR.number}`, pr: openPR };
  }
  
  if (branch.age > CONFIG.ALERT_DAYS) {
    return { status: 'STALE (ALERT)', priority: 4, action: 'Immediate review required' };
  }
  
  if (branch.age > CONFIG.STALE_DAYS) {
    return { status: 'STALE', priority: 5, action: 'Review or open PR' };
  }
  
  return { status: 'ACTIVE', priority: 6, action: 'Continue work' };
}

// Generate markdown report
function generateReport(branches) {
  const now = new Date().toISOString();
  
  let report = `---
date: ${now.split('T')[0]}
generated: ${now}
---

# BRANCH RECONCILIATION REPORT

**Generated:** ${now}  
**Total Branches:** ${branches.length}

---

## 📊 SUMMARY

\`\`\`
`;

  // Count by status
  const statusCounts = {};
  branches.forEach(b => {
    statusCounts[b.classification.status] = (statusCounts[b.classification.status] || 0) + 1;
  });
  
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    const icon = status.includes('STALE') ? '⚠️' : status === 'MERGED' ? '✅' : status === 'ACTIVE' ? '🔄' : '📋';
    report += `${icon} ${status.padEnd(20)} ${count}\n`;
  });
  
  report += `\`\`\`

---

## 🚨 PRIORITY ACTIONS

### Critical (Immediate Action Required)

`;

  const critical = branches.filter(b => b.classification.priority <= 4);
  if (critical.length === 0) {
    report += `✅ No critical actions required.\n\n`;
  } else {
    critical.sort((a, b) => a.classification.priority - b.classification.priority).forEach(b => {
      report += `**${b.name}**\n`;
      report += `- Status: ${b.classification.status}\n`;
      report += `- Age: ${b.age} days\n`;
      report += `- Action: ${b.classification.action}\n`;
      report += `- Files: ${b.fileCount}\n\n`;
    });
  }

  report += `---

## 📋 BRANCH INVENTORY

`;

  // Group by status
  const byStatus = {};
  branches.forEach(b => {
    const status = b.classification.status;
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(b);
  });

  Object.entries(byStatus).sort((a, b) => {
    const priorityA = a[1][0]?.classification.priority || 999;
    const priorityB = b[1][0]?.classification.priority || 999;
    return priorityA - priorityB;
  }).forEach(([status, branchList]) => {
    report += `### ${status} (${branchList.length})\n\n`;
    report += `| Branch | Age | Files | Scope | Action |\n`;
    report += `|--------|-----|-------|-------|--------|\n`;
    
    branchList.forEach(b => {
      report += `| \`${b.name}\` | ${b.age}d | ${b.fileCount} | ${b.scope} | ${b.classification.action} |\n`;
    });
    
    report += `\n`;
  });

  report += `---

## 🎯 RECOMMENDATIONS

`;

  const staleCount = branches.filter(b => b.classification.status.includes('STALE')).length;
  const supersededCount = branches.filter(b => b.classification.status === 'SUPERSEDED').length;
  const mergedCount = branches.filter(b => b.classification.status === 'MERGED').length;
  const activeCount = branches.filter(b => b.classification.status === 'ACTIVE').length;
  
  if (mergedCount > 0) {
    report += `1. **Auto-delete ${mergedCount} merged branches** (already in main)\n`;
  }
  
  if (supersededCount > 0) {
    report += `2. **Close + delete ${supersededCount} superseded branches** (work merged via different path)\n`;
  }
  
  if (staleCount > 0) {
    report += `3. **Review ${staleCount} stale branches:**\n`;
    report += `   - Open PR if work is complete\n`;
    report += `   - Close if work is abandoned\n`;
    report += `   - Archive if historical reference needed\n`;
  }
  
  if (activeCount > 5) {
    report += `4. **${activeCount} active branches:** Consider completing/merging incrementally\n`;
  }

  report += `\n---

## 📈 BRANCH HEALTH METRICS

\`\`\`
Avg branch age:         ${(branches.reduce((sum, b) => sum + b.age, 0) / branches.length).toFixed(1)} days
Stale rate:             ${((staleCount / branches.length) * 100).toFixed(1)}%
Merge completion rate:  ${((mergedCount / branches.length) * 100).toFixed(1)}%
Active work-in-progress: ${activeCount}
\`\`\`

### Health Status

`;

  const avgAge = branches.reduce((sum, b) => sum + b.age, 0) / branches.length;
  const staleRate = (staleCount / branches.length) * 100;
  
  if (avgAge < 5 && staleRate < 10) {
    report += `✅ **HEALTHY** - Good branch hygiene\n`;
  } else if (avgAge < 10 && staleRate < 20) {
    report += `⚠️ **ATTENTION NEEDED** - Some cleanup required\n`;
  } else {
    report += `❌ **UNHEALTHY** - Immediate cleanup required\n`;
  }

  report += `\n---

**Next Reconciliation:** ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}  
**Report Location:** \`${CONFIG.REPORT_PATH}\`

`;

  return report;
}

// Main execution
function main() {
  console.log('🔍 Starting branch reconciliation...\n');
  
  // Fetch latest
  console.log('Fetching latest from remote...');
  git('fetch --all --prune');
  
  // Get branches
  console.log('Analyzing branches...');
  const remoteBranches = getRemoteBranches();
  
  // Classify each branch
  const branches = remoteBranches.map(branch => {
    const fileCount = getFileCount(branch.name);
    const scope = detectScope(branch.name, fileCount);
    const classification = classifyBranch(branch);
    
    return {
      ...branch,
      fileCount,
      scope,
      classification
    };
  });
  
  // Generate report
  console.log('Generating report...');
  const report = generateReport(branches);
  
  // Write report
  fs.writeFileSync(CONFIG.REPORT_PATH, report);
  console.log(`✅ Report generated: ${CONFIG.REPORT_PATH}\n`);
  
  // Output summary
  const staleCount = branches.filter(b => b.classification.status.includes('STALE')).length;
  const supersededCount = branches.filter(b => b.classification.status === 'SUPERSEDED').length;
  const mergedCount = branches.filter(b => b.classification.status === 'MERGED').length;
  
  console.log('📊 Summary:');
  console.log(`   Total branches: ${branches.length}`);
  console.log(`   Merged: ${mergedCount}`);
  console.log(`   Superseded: ${supersededCount}`);
  console.log(`   Stale: ${staleCount}`);
  
  // Exit with warning if stale branches found
  if (staleCount > 0) {
    console.log('\n⚠️ Warning: Stale branches detected!');
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main();
}

module.exports = { getRemoteBranches, classifyBranch, generateReport };
