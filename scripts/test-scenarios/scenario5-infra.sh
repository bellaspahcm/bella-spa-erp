#!/bin/bash

# Phase 4B.1 Test Scenario 5: Infra Change
#
# Purpose: Test infrastructure routing (critical changes)
#
# Expected classification:
# - infra_changed: true
# - risk_class: HIGH (infrastructure = critical)
#
# Expected routing:
# - test-routing-infra job runs
# - All other routing jobs skip

echo "Scenario 5: Infrastructure change test"
echo "This script modifies tooling/infrastructure"
