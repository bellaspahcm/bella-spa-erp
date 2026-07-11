/**
 * Rule Simulation API
 * 
 * POST /api/rule-management/simulate - Test rules with sample data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';
import type { SimulateRuleRequest } from '@/types/rule-management.types';
import type { Json } from '@/types/database.types';

/**
 * POST /api/rule-management/simulate
 * Simulate rule execution with test data
 * 
 * Body:
 * - workflowId: string (required)
 * - ruleIds: string[] (optional) - If not provided, test all active rules
 * - testData: object (required) - Input data for simulation
 * - saveResult: boolean (default: false) - Save simulation result for history
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized'
        },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'User tenant not found'
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body: SimulateRuleRequest = await request.json();

    // Validate required fields
    if (!body.workflowId || !body.testData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workflowId, testData'
        },
        { status: 400 }
      );
    }

    // Verify workflow exists and belongs to tenant
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_definitions')
      .select('id, name, config')
      .eq('id', body.workflowId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (workflowError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow not found or access denied'
        },
        { status: 404 }
      );
    }

    // Get rules to test
    let query = supabase
      .from('workflow_rules')
      .select('*')
      .eq('workflow_id', body.workflowId)
      .eq('tenant_id', userData.tenant_id)
      .order('priority', { ascending: true });

    // Filter by specific rule IDs if provided
    if (body.ruleIds && body.ruleIds.length > 0) {
      query = query.in('id', body.ruleIds);
    } else {
      // Only test active rules if no specific IDs provided
      query = query.eq('is_active', true);
    }

    const { data: rules, error: rulesError } = await query;

    if (rulesError) {
      throw new Error(`Failed to get rules: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No rules found to test'
        },
        { status: 404 }
      );
    }

    // Execute simulation
    const simulationStartTime = Date.now();
    const results = [];

    for (const rule of rules) {
      const ruleStartTime = Date.now();
      let result;
      let error = null;

      try {
        // Execute rule based on type
        switch (rule.rule_type) {
          case 'condition':
            result = evaluateCondition(rule.config as Record<string, unknown>, body.testData);
            break;
          case 'action':
            result = evaluateAction(rule.config as Record<string, unknown>, body.testData);
            break;
          case 'decision':
            result = evaluateDecision(rule.config as Record<string, unknown>, body.testData);
            break;
          default:
            error = `Unknown rule type: ${rule.rule_type}`;
            result = null;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : 'Unknown error';
        result = null;
      }

      const executionTime = Date.now() - ruleStartTime;

      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.rule_type,
        passed: error === null && result !== null,
        result,
        error,
        executionTime
      });
    }

    const totalExecutionTime = Date.now() - simulationStartTime;

    const simulationResult = {
      workflowId: body.workflowId,
      workflowName: workflow.name,
      testData: body.testData,
      results,
      summary: {
        totalRules: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        executionTime: totalExecutionTime
      }
    };

    // Save simulation result if requested
    if (body.saveResult) {
      const { error: saveError } = await supabase
        .from('rule_simulations')
        .insert({
          workflow_id: body.workflowId,
          tenant_id: userData.tenant_id,
          test_data: body.testData as unknown as Json,
          results: simulationResult.results as unknown as Json,
          summary: simulationResult.summary as unknown as Json,
          created_by: user.id
        });

      if (saveError) {
        console.error('[API] Failed to save simulation result:', saveError);
        // Non-critical error, continue
      }
    }

    return NextResponse.json({
      success: true,
      data: simulationResult
    });

  } catch (error) {
    console.error('[API] Simulation failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Evaluate condition rule
 */
function evaluateCondition(config: Record<string, unknown>, data: Record<string, unknown>): boolean {
  const { operator, field, value } = config;

  if (!operator || !field) {
    throw new Error('Invalid condition config: missing operator or field');
  }

  const fieldValue = getNestedValue(data, field as string);

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'greaterThan':
      return Number(fieldValue) > Number(value);
    case 'lessThan':
      return Number(fieldValue) < Number(value);
    case 'greaterThanOrEqual':
      return Number(fieldValue) >= Number(value);
    case 'lessThanOrEqual':
      return Number(fieldValue) <= Number(value);
    case 'contains':
      return String(fieldValue).includes(String(value));
    case 'notContains':
      return !String(fieldValue).includes(String(value));
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'notIn':
      return Array.isArray(value) && !value.includes(fieldValue);
    default:
      throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Evaluate action rule
 */
function evaluateAction(config: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
  const { actionType, params } = config;

  if (!actionType) {
    throw new Error('Invalid action config: missing actionType');
  }

  // Simulate action execution
  return {
    actionType,
    params,
    input: data,
    status: 'simulated',
    message: `Action '${actionType}' would be executed with params: ${JSON.stringify(params)}`
  };
}

/**
 * Evaluate decision rule
 */
function evaluateDecision(config: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
  const { decisionType, rules } = config;

  if (!decisionType) {
    throw new Error('Invalid decision config: missing decisionType');
  }

  // Simulate decision evaluation
  const evaluatedRules = Array.isArray(rules)
    ? rules.map((rule: Record<string, unknown>) => {
        try {
          return {
            rule,
            result: evaluateCondition(rule, data),
            matched: true
          };
        } catch (err) {
          return {
            rule,
            result: null,
            matched: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          };
        }
      })
    : [];

  return {
    decisionType,
    input: data,
    evaluatedRules,
    decision: evaluatedRules.find(r => r.matched)?.rule || null
  };
}

/**
 * Get nested value from object by path (e.g., 'user.profile.age')
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' && key in current
      ? (current as Record<string, unknown>)[key]
      : undefined;
  }, obj as unknown);
}
