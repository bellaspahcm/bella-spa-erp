import { readFileSync } from 'node:fs';

const resultsPath = process.env.PLAYWRIGHT_RESULTS_FILE || 'playwright-results.json';
const expectedTotal = Number(process.env.E2E_VISUAL_EXPECTED_TESTS || 0);

function collectTestsFromSuite(suite, tests = []) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const finalResult = test.results?.at(-1);
      tests.push({
        title: `${suite.title} > ${spec.title}`,
        expectedStatus: test.expectedStatus || 'passed',
        status: finalResult?.status || test.expectedStatus || 'unknown',
      });
    }
  }

  for (const child of suite.suites || []) {
    collectTestsFromSuite(child, tests);
  }

  return tests;
}

function formatTestList(tests) {
  return tests
    .slice(0, 20)
    .map((test) => `- [${test.status}] ${test.title}`)
    .join('\n');
}

const payload = JSON.parse(readFileSync(resultsPath, 'utf8'));
const tests = (payload.suites || []).flatMap((suite) => collectTestsFromSuite(suite));
const skipped = tests.filter((test) => test.status === 'skipped' || test.expectedStatus === 'skipped');
const failed = tests.filter((test) => test.status !== 'passed');

if (expectedTotal > 0 && tests.length !== expectedTotal) {
  console.error(
    `Responsive visual smoke expected ${expectedTotal} tests but Playwright reported ${tests.length}.`,
  );
  process.exit(1);
}

if (skipped.length > 0) {
  console.error(`Responsive visual smoke has ${skipped.length} skipped tests.`);
  console.error(formatTestList(skipped));
  process.exit(1);
}

if (failed.length > 0) {
  console.error(`Responsive visual smoke has ${failed.length} tests that did not pass.`);
  console.error(formatTestList(failed));
  process.exit(1);
}

console.log(`Responsive visual smoke results are strict: ${tests.length}/${tests.length} passed, 0 skipped.`);
