'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Play, Check, X, Clock, AlertCircle, History, Code } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  conditions: unknown;
  actions: unknown;
  status: string;
}

interface TestResult {
  id: string;
  test_name: string;
  passed: boolean;
  error_message: string | null;
  execution_time_ms: number;
  input_data: unknown;
  expected_output: unknown | null;
  actual_output: unknown;
  trace: Array<{ step: string; result: unknown }>;
  matched_conditions: unknown[];
  executed_actions: unknown[];
  tested_at: string;
}

interface RuleTestSimulatorProps {
  rule: Rule;
  testHistory: TestResult[];
}

export default function RuleTestSimulator({ rule, testHistory }: RuleTestSimulatorProps) {
  const [inputData, setInputData] = useState('{\n  \n}');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [testName, setTestName] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResult, setTestResult] = useState<{
    passed: boolean;
    errorMessage: string | null;
    executionTimeMs: number;
    actualOutput: unknown;
    trace: Array<{ step: string; result: unknown }>;
    matchedConditions: unknown[];
    executedActions: unknown[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExecuteTest = async () => {
    setIsExecuting(true);
    setError(null);
    setTestResult(null);

    try {
      // Validate JSON input
      let parsedInput: Record<string, unknown>;
      try {
        parsedInput = JSON.parse(inputData);
      } catch {
        throw new Error('Invalid JSON in input data');
      }

      let parsedExpected: Record<string, unknown> | undefined;
      if (expectedOutput.trim()) {
        try {
          parsedExpected = JSON.parse(expectedOutput);
        } catch {
          throw new Error('Invalid JSON in expected output');
        }
      }

      // Call API
      const response = await fetch(`/api/rules/${rule.id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputData: parsedInput,
          expectedOutput: parsedExpected,
          testName: testName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Test execution failed');
      }

      setTestResult({
        passed: data.data.passed,
        errorMessage: data.data.errorMessage,
        executionTimeMs: data.data.executionTimeMs,
        actualOutput: data.data.actualOutput,
        trace: data.data.trace || [],
        matchedConditions: data.data.matchedConditions || [],
        executedActions: data.data.executedActions || [],
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExecuting(false);
    }
  };

  const loadTestFromHistory = (test: TestResult) => {
    setInputData(JSON.stringify(test.input_data, null, 2));
    setExpectedOutput(test.expected_output ? JSON.stringify(test.expected_output, null, 2) : '');
    setTestName(test.test_name);
    setTestResult({
      passed: test.passed,
      errorMessage: test.error_message,
      executionTimeMs: test.execution_time_ms,
      actualOutput: test.actual_output,
      trace: test.trace,
      matchedConditions: test.matched_conditions,
      executedActions: test.executed_actions,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Rule: {rule.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rule.description || 'No description'}
          </p>
        </div>
        <Badge variant={rule.status === 'active' ? 'default' : 'secondary'}>
          {rule.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input */}
        <div className="space-y-6">
          {/* Test Name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Name (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="e.g., VIP Customer Test"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                disabled={isExecuting}
              />
            </CardContent>
          </Card>

          {/* Input Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4" />
                Input Data (JSON)
              </CardTitle>
              <CardDescription>
                Enter the data to test against rule conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-64 px-3 py-2 border rounded-md font-mono text-sm"
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                disabled={isExecuting}
                placeholder='{\n  "customer": {\n    "tier": "VIP",\n    "totalSpent": 5000000\n  },\n  "booking": {\n    "totalAmount": 2000000\n  }\n}'
              />
            </CardContent>
          </Card>

          {/* Expected Output (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expected Output (Optional)</CardTitle>
              <CardDescription>
                Define expected output for automated assertion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full h-32 px-3 py-2 border rounded-md font-mono text-sm"
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                disabled={isExecuting}
                placeholder='{\n  "approved": true\n}'
              />
            </CardContent>
          </Card>

          {/* Execute Button */}
          <Button
            onClick={handleExecuteTest}
            disabled={isExecuting || !inputData.trim()}
            className="w-full"
            size="lg"
          >
            {isExecuting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Test
              </>
            )}
          </Button>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <div className="ml-2">
                <h4 className="font-semibold">Test Failed</h4>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </Alert>
          )}

          {/* Test Result */}
          {testResult && (
            <>
              {/* Result Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {testResult.passed ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <X className="h-5 w-5 text-red-600" />
                    )}
                    Test {testResult.passed ? 'Passed' : 'Failed'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Clock className="h-4 w-4" />
                    Execution time: {testResult.executionTimeMs}ms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {testResult.errorMessage && (
                    <Alert variant="destructive" className="mb-4">
                      <p className="text-sm">{testResult.errorMessage}</p>
                    </Alert>
                  )}

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Conditions Matched:</span>{' '}
                      <Badge variant="secondary">
                        {testResult.matchedConditions.length}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Actions Executed:</span>{' '}
                      <Badge variant="secondary">
                        {testResult.executedActions.length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actual Output */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actual Output</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-3 rounded-md overflow-auto text-xs font-mono max-h-64">
                    {JSON.stringify(testResult.actualOutput, null, 2)}
                  </pre>
                </CardContent>
              </Card>

              {/* Execution Trace */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Execution Trace</CardTitle>
                  <CardDescription>
                    Step-by-step execution log
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {testResult.trace.map((step, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-sm border-l-2 border-muted pl-3 py-1"
                      >
                        <span className="text-muted-foreground min-w-[20px]">
                          {index + 1}.
                        </span>
                        <div className="flex-1">
                          <div className="font-medium">{step.step}</div>
                          <div className="text-muted-foreground text-xs">
                            → {typeof step.result === 'object' 
                                ? JSON.stringify(step.result)
                                : String(step.result)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Test History */}
          {testHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Tests
                </CardTitle>
                <CardDescription>
                  Load previous test cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {testHistory.map((test) => (
                    <button
                      key={test.id}
                      onClick={() => loadTestFromHistory(test)}
                      className="w-full flex items-center justify-between p-2 border rounded-md hover:bg-muted text-left"
                      disabled={isExecuting}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {test.test_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(test.tested_at).toLocaleString()}
                        </div>
                      </div>
                      <Badge
                        variant={test.passed ? 'default' : 'destructive'}
                        className="ml-2"
                      >
                        {test.passed ? 'Passed' : 'Failed'}
                      </Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
