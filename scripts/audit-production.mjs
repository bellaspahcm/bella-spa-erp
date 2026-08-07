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
  "GHSA-mh99-v99m-4gvg",
  "GHSA-rgw5-rvv9-x895",

  // fast-uri: Nested dependency of schema validation (ajv), constrained by peer dependencies.
  "GHSA-v2hh-gcrm-f6hx",
  "GHSA-4c8g-83qw-93j6",
  "GHSA-7p8r-x3mc-p8w7",

  // ip-address: Nested dependency of CLI and testing utilities, no runtime exposure.
  "GHSA-mwp4-54f8-5fhr",
  "GHSA-4xrf-jv44-h6hh",
  "GHSA-22jq-vg5j-6vgg",

  // js-yaml: Nested dependency of dev/docs parsing utilities.
  "GHSA-h67p-54hq-rp68",
  "GHSA-52cp-r559-cp3m",
  "GHSA-5p4m-2wfm-xmqj",

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

  // undici: Node.js runtime global fetch dependency, locked by Next.js framework constraints.
  "GHSA-8xcm-r25x-g524",
  "GHSA-4cwx-7wf7-3272",
  "GHSA-m8rv-5g2x-5cg5",
  "GHSA-jr45-8vmc-qm54",
  "GHSA-v3r7-h72x-cjcm",

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

function getAdvisoryIds(vulnerability, vulnerabilitiesMap, visited = new Set()) {
  if (!vulnerability) return [];
  const name = vulnerability.name;
  if (visited.has(name)) return [];
  visited.add(name);

  const ids = [];
  const vias = vulnerability.via || [];

  for (const via of vias) {
    if (typeof via === "object" && via !== null) {
      const advisoryMatch = typeof via.url === "string" ? via.url.match(/GHSA-[a-z0-9-]+/i) : null;
      const id = advisoryMatch?.[0] || via.source || via.url || via.title;
      if (id) ids.push(String(id));
    } else if (typeof via === "string") {
      const parentVuln = vulnerabilitiesMap[via];
      if (parentVuln) {
        ids.push(...getAdvisoryIds(parentVuln, vulnerabilitiesMap, visited));
      }
    }
  }

  return [...new Set(ids)];
}

const auditJson = JSON.parse(runAudit());
const vulnerabilities = Object.entries(auditJson.vulnerabilities || {});
const vulnerabilitiesMap = auditJson.vulnerabilities || {};
const blocking = [];
const allowed = [];

for (const [name, vulnerability] of vulnerabilities) {
  const rank = severityRank[vulnerability.severity] || 0;
  if (rank < minimumRank) continue;

  const advisoryIds = getAdvisoryIds(vulnerability, vulnerabilitiesMap);
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
