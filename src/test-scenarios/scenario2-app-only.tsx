/**
 * Phase 4B.1 Test Scenario 2: App-Only Change
 * 
 * Purpose: Test app-only routing (no migration)
 * 
 * Expected classification:
 * - app_changed: true
 * - needs_app_deploy: true
 * - needs_migration: false
 * - risk_class: MEDIUM
 * 
 * Expected routing:
 * - test-routing-app-only job runs
 * - All other routing jobs skip
 */

export const Scenario2AppOnly = () => {
  return <div>Scenario 2: App-Only Change Test</div>;
};
