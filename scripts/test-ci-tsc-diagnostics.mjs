import assert from 'node:assert/strict';
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
