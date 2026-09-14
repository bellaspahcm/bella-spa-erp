import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareDiagnostics, parseDiagnostics } from './ci-compare-tsc-diagnostics.mjs';

const baselineOutput = [
  "src/platform/education/contracts/enrollment.contract.impl.ts(40,7): error TS2322: Type 'string' is not assignable to type 'EnrollmentStatus'.",
  "src/products/bella-english-center/components/BranchHierarchyTree.tsx(28,28): error TS2339: Property 'children' does not exist on type 'OrgUnitHierarchy'.",
].join('\n');

const baseline = parseDiagnostics(baselineOutput);

const same = compareDiagnostics(baseline, parseDiagnostics(baselineOutput));
assert.equal(same.status, 'ALLOW');
assert.equal(same.baselineTotal, 2);
assert.equal(same.currentTotal, 2);
assert.equal(same.added.length, 0);
console.log('PASS SAME BASELINE = ALLOW');

const newErrorOutput = [
  baselineOutput,
  "src/products/bella-english-center/services/class.service.ts(12,3): error TS7006: Parameter 'input' implicitly has an 'any' type.",
].join('\n');
const newError = compareDiagnostics(baseline, parseDiagnostics(newErrorOutput));
assert.equal(newError.status, 'BLOCK');
assert.equal(newError.baselineTotal, 2);
assert.equal(newError.currentTotal, 3);
assert.equal(newError.added.length, 1);
console.log('PASS NEW ERROR = BLOCK');

const reducedOutput = [
  "src/platform/education/contracts/enrollment.contract.impl.ts(40,7): error TS2322: Type 'string' is not assignable to type 'EnrollmentStatus'.",
].join('\n');
const reduced = compareDiagnostics(baseline, parseDiagnostics(reducedOutput));
assert.equal(reduced.status, 'ALLOW');
assert.equal(reduced.baselineTotal, 2);
assert.equal(reduced.currentTotal, 1);
assert.equal(reduced.added.length, 0);
assert.equal(reduced.reduced.length, 1);
console.log('PASS DEBT REDUCTION = ALLOW');

const unionOrderBaseline = parseDiagnostics(
  "src/platform/education/contracts/enrollment.contract.impl.ts(40,7): error TS2322: Type 'string' is not assignable to type '\"cancelled\" | \"pending\" | \"completed\" | \"active\"'."
);
const unionOrderCurrent = parseDiagnostics(
  "src/platform/education/contracts/enrollment.contract.impl.ts(40,7): error TS2322: Type 'string' is not assignable to type '\"active\" | \"completed\" | \"cancelled\" | \"pending\"'."
);
const unionOrderSame = compareDiagnostics(unionOrderBaseline, unionOrderCurrent);
assert.equal(unionOrderSame.status, 'ALLOW');
assert.equal(unionOrderSame.baselineTotal, 1);
assert.equal(unionOrderSame.currentTotal, 1);
assert.equal(unionOrderSame.added.length, 0);
console.log('PASS UNION ORDER DRIFT = ALLOW');

const reviewedBaselines = JSON.parse(readFileSync('.github/ci/tsc-diagnostic-baselines.json', 'utf8'));
for (const scope of ['education-affected', 'english-center', 'english-center-affected']) {
  const reviewed = reviewedBaselines[scope]?.diagnostics;
  assert.ok(reviewed, `${scope} must have a reviewed diagnostic baseline`);

  const reviewedSame = compareDiagnostics(reviewed, reviewed);
  assert.equal(reviewedSame.status, 'ALLOW');
  assert.equal(reviewedSame.added.length, 0);

  const reviewedWithNewError = {
    ...reviewed,
    [`synthetic/${scope}.ts|TS9999|Synthetic proof diagnostic for baseline guard.`]: 1,
  };
  const reviewedNewError = compareDiagnostics(reviewed, reviewedWithNewError);
  assert.equal(reviewedNewError.status, 'BLOCK');
  assert.equal(reviewedNewError.added.length, 1);

  const [firstSignature, ...remainingSignatures] = Object.keys(reviewed);
  assert.ok(firstSignature, `${scope} baseline must not be empty`);
  const reviewedReduced = Object.fromEntries(remainingSignatures.map((signature) => [signature, reviewed[signature]]));
  const reviewedDebtReduction = compareDiagnostics(reviewed, reviewedReduced);
  assert.equal(reviewedDebtReduction.status, 'ALLOW');
  assert.equal(reviewedDebtReduction.added.length, 0);
  assert.ok(reviewedDebtReduction.currentTotal < reviewedDebtReduction.baselineTotal);

  console.log(`PASS REVIEWED ${scope} SAME/+1/-1 POLICY`);
}
