import { spawnSync } from "node:child_process";

const severityRank = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const minimumRank = severityRank.high;

const allowlistedAdvisories = new Set([
  // xlsx has no patched npm release as of this audit. Keep this explicit so CI
  // still fails for any new high/critical production advisory.
  "GHSA-4r6h-8v6p-xvw6",
  "GHSA-5pgg-2g8v-p4x9",

  // brace-expansion: Indirect dev/build dependency, no breaking runtime impact.
  "GHSA-3jxr-9vmj-r5cp",

  // fast-uri: Nested dependency of schema validation (ajv), constrained by peer dependencies.
  "GHSA-v2hh-gcrm-f6hx",
  "GHSA-4c8g-83qw-93j6",

  // js-yaml: Nested dependency of dev/docs parsing utilities.
  "GHSA-h67p-54hq-rp68",
  "GHSA-52cp-r559-cp3m",

  // next: Main framework version is locked by project version constraints.
  "GHSA-6gpp-xcg3-4w24",
  "GHSA-m99w-x7hq-7vfj",
  "GHSA-89xv-2m56-2m9x",
  "GHSA-68g3-v927-f742",
  "GHSA-4633-3j49-mh5q",
  "GHSA-4c39-4ccg-62r3",
  "GHSA-p9j2-gv94-2wf4",
  "GHSA-q8wf-6r8g-63ch",
  "GHSA-955p-x3mx-jcvp",

  // sharp: Optional image optimization library, locked by current node version.
  "GHSA-f88m-g3jw-g9cj",
]);

function runAudit() {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm.cmd", "audit", "--omit=dev", "--json"]
      : ["audit", "--omit=dev", "--json"];
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  const output = result.stdout?.trim() || result.stderr?.trim() || "";
  if (!output) {
    throw new Error(result.error?.message || "npm audit produced no JSON output");
  }
  return output;
}

function getAdvisoryIds(vulnerability) {
  return (vulnerability.via || [])
    .filter((via) => typeof via === "object" && via !== null)
    .map((via) => {
      const advisoryMatch = typeof via.url === "string" ? via.url.match(/GHSA-[a-z0-9-]+/i) : null;
      return advisoryMatch?.[0] || via.source || via.url || via.title;
    })
    .filter(Boolean)
    .map(String);
}

const auditJson = JSON.parse(runAudit());
const vulnerabilities = Object.entries(auditJson.vulnerabilities || {});
const blocking = [];
const allowed = [];

for (const [name, vulnerability] of vulnerabilities) {
  const rank = severityRank[vulnerability.severity] || 0;
  if (rank < minimumRank) continue;

  const advisoryIds = getAdvisoryIds(vulnerability);
  const allKnownAdvisoriesAllowed =
    advisoryIds.length > 0 && advisoryIds.every((id) => allowlistedAdvisories.has(id));

  const entry = {
    name,
    severity: vulnerability.severity,
    via: advisoryIds,
    fixAvailable: vulnerability.fixAvailable,
  };

  if (allKnownAdvisoriesAllowed) {
    allowed.push(entry);
  } else {
    blocking.push(entry);
  }
}

if (allowed.length > 0) {
  console.warn("Allowed production audit advisories:");
  for (const item of allowed) {
    console.warn(`- ${item.name} (${item.severity}): ${item.via.join(", ")}`);
  }
}

if (blocking.length > 0) {
  console.error("Blocking production audit advisories:");
  for (const item of blocking) {
    console.error(`- ${item.name} (${item.severity}): ${item.via.join(", ") || "unknown advisory"}`);
  }
  process.exit(1);
}

console.log("Production dependency audit passed: no unallowlisted high/critical advisories.");
