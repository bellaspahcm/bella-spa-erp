/**
 * Rule Management UI - Rule Test Simulator API
 * 
 * POST /api/rules/[ruleId]/test - Test rule with input data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { Json } from '@/types/database.types';

interface RouteParams {
  params: Promise<{
    ruleId: string;
  }>;
}

export interface TestRuleRequest {
  inputData: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  testName?: string;
}

/**
 * POST /api/rules/[ruleId]/test
 * Test rule with provided input data
 * 
 * Body:
 * - inputData: object (required) - input data to test rule against
 * - expectedOutput: object - expected output for comparison
 * - testName: string - name for this test run
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now();
  
  try {
    const { ruleId } = await params;

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
    const body: TestRuleRequest = await request.json();

    if (!body.inputData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: inputData'
        },
        { status: 400 }
      );
    }

    // Get rule
    const { data: rule, error: getRuleError } = await supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (getRuleError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rule not found'
        },
        { status: 404 }
      );
    }

    // Execute rule using Decision Engine
    let actualOutput: unknown;
    let passed = true;
    let errorMessage: string | null = null;
    let trace: Array<{ step: string; result: unknown }> = [];
    let matchedConditions: Array<unknown> = [];
    let executedActions: Array<unknown> = [];

    try {
      // Evaluate conditions
      trace.push({ step: 'Evaluating conditions', result: 'started' });
      
      const conditions = rule.conditions as Array<{
        field: string;
        operator: string;
        value: unknown;
        logicalOperator?: 'AND' | 'OR';
      }>;

      let allConditionsMet = true;
      
      for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const fieldValue = getNestedValue(body.inputData, condition.field);
        const conditionMet = evaluateCondition(fieldValue, condition.operator, condition.value);
        
        trace.push({
          step: `Condition ${i + 1}: ${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`,
          result: conditionMet ? 'matched' : 'not matched'
        });

        if (conditionMet) {
          matchedConditions.push(condition);
        }

        // Handle logical operators
        if (i === 0) {
          allConditionsMet = conditionMet;
        } else {
          const logicalOp = conditions[i - 1].logicalOperator || 'AND';
          if (logicalOp === 'AND') {
            allConditionsMet = allConditionsMet && conditionMet;
          } else {
            allConditionsMet = allConditionsMet || conditionMet;
          }
        }
      }

      trace.push({ step: 'All conditions evaluated', result: allConditionsMet ? 'all met' : 'not all met' });

      // Execute actions if conditions met
      if (allConditionsMet) {
        trace.push({ step: 'Executing actions', result: 'started' });
        
        const actions = rule.actions as Array<{
          type: string;
          field?: string;
          operation?: string;
          value?: unknown;
          reason?: string;
        }>;

        let modifiedOutput = { ...body.inputData };

        for (const action of actions) {
          trace.push({ step: `Action: ${action.type}`, result: 'executing' });
          
          if (action.type === 'modify' && action.field && action.operation) {
            const currentValue = getNestedValue(modifiedOutput, action.field) as number;
            let newValue = currentValue;

            if (action.operation === 'add') {
              newValue = currentValue + (action.value as number);
            } else if (action.operation === 'multiply') {
              newValue = currentValue * (action.value as number);
            } else if (action.operation === 'set') {
              newValue = action.value as number;
            }

            setNestedValue(modifiedOutput, action.field, newValue);
            executedActions.push({ ...action, oldValue: currentValue, newValue });
            
            trace.push({ 
              step: `Modified ${action.field}`, 
              result: `${currentValue} → ${newValue}` 
            });
          } else {
            executedActions.push(action);
            trace.push({ step: `Action ${action.type}`, result: 'executed' });
          }
        }

        actualOutput = modifiedOutput;
        trace.push({ step: 'All actions executed', result: 'success' });
      } else {
        actualOutput = body.inputData;
        trace.push({ step: 'No actions executed', result: 'conditions not met' });
      }

      // Compare with expected output if provided
      if (body.expectedOutput) {
        const matches = JSON.stringify(actualOutput) === JSON.stringify(body.expectedOutput);
        passed = matches;
        if (!matches) {
          errorMessage = 'Actual output does not match expected output';
        }
      }

    } catch (error) {
      passed = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error during rule execution';
      trace.push({ step: 'Error occurred', result: errorMessage });
    }

    const executionTime = Date.now() - startTime;

    // Save test result to database
    const { error: saveError } = await supabase
      .from('rule_test_results')
      .insert({
        tenant_id: userData.tenant_id,
        rule_id: ruleId,
        test_type: 'single',
        test_name: body.testName || `Test ${new Date().toISOString()}`,
        input_data: body.inputData as unknown as Json,
        expected_output: (body.expectedOutput || null) as unknown as Json,
        actual_output: actualOutput as unknown as Json,
        passed,
        error_message: errorMessage,
        execution_time_ms: executionTime,
        trace: trace as unknown as Json,
        matched_conditions: matchedConditions as unknown as Json,
        executed_actions: executedActions as unknown as Json,
        tested_by: user.id,
        tested_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('[API] Failed to save test result:', saveError);
      // Don't fail the request if saving fails
    }

    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        testName: body.testName || null,
        passed,
        errorMessage,
        executionTimeMs: executionTime,
        inputData: body.inputData,
        expectedOutput: body.expectedOutput || null,
        actualOutput,
        trace,
        matchedConditions,
        executedActions
      }
    });

  } catch (error) {
    console.error('[API] Test rule failed: %s', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

// Helper function to get nested object value by path
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

// Helper function to set nested object value by path
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current: Record<string, unknown> = obj;
  
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[lastKey] = value;
}

// Helper function to evaluate condition
function evaluateCondition(fieldValue: unknown, operator: string, targetValue: unknown): boolean {
  switch (operator) {
    case 'equals':
    case '==':
    case '===':
      return fieldValue === targetValue;
    
    case 'not_equals':
    case '!=':
    case '!==':
      return fieldValue !== targetValue;
    
    case 'greater_than':
    case 'gt':
    case '>':
      return (fieldValue as number) > (targetValue as number);
    
    case 'greater_than_or_equal':
    case 'gte':
    case '>=':
      return (fieldValue as number) >= (targetValue as number);
    
    case 'less_than':
    case 'lt':
    case '<':
      return (fieldValue as number) < (targetValue as number);
    
    case 'less_than_or_equal':
    case 'lte':
    case '<=':
      return (fieldValue as number) <= (targetValue as number);
    
    case 'in':
      return Array.isArray(targetValue) && targetValue.includes(fieldValue);
    
    case 'not_in':
      return Array.isArray(targetValue) && !targetValue.includes(fieldValue);
    
    case 'contains':
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return fieldValue.includes(targetValue);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(targetValue);
      }
      return false;
    
    case 'not_contains':
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return !fieldValue.includes(targetValue);
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(targetValue);
      }
      return false;
    
    case 'starts_with':
      return typeof fieldValue === 'string' && typeof targetValue === 'string' && fieldValue.startsWith(targetValue);
    
    case 'ends_with':
      return typeof fieldValue === 'string' && typeof targetValue === 'string' && fieldValue.endsWith(targetValue);
    
    case 'is_null':
      return fieldValue === null || fieldValue === undefined;
    
    case 'is_not_null':
      return fieldValue !== null && fieldValue !== undefined;
    
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

