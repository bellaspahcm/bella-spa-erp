/**
 * Phase 4B.1 Test Scenario 4: Mixed Change (DB + App)
 * 
 * Purpose: Test mixed routing (migration + app deploy)
 * 
 * Expected classification:
 * - app_changed: true
 * - db_changed: true
 * - needs_migration: true
 * - needs_app_deploy: true
 * - risk_class: HIGH (migration present)
 * 
 * Expected routing:
 * - test-routing-mixed job runs
 * - All other routing jobs skip
 */

export const Scenario4Mixed = () => {
  return <div>Scenario 4: Mixed (DB + App) Change Test</div>;
};
