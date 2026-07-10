'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Play, RefreshCw, CheckCircle2, XCircle, Code2, Clipboard, AlertCircle } from 'lucide-react';

interface TestPageProps {
  params: Promise<{ ruleId: string }>;
}

export default function RuleTestPage({ params }: TestPageProps) {
  const { ruleId } = React.use(params);
  const [rule, setRule] = useState<any>(null);
  const [isLoadingRule, setIsLoadingRule] = useState(true);
  const [inputData, setInputData] = useState<string>('{\n  "customer": {\n    "tier": "VIP"\n  },\n  "booking": {\n    "price": 1500000\n  }\n}');
  const [expectedOutput, setExpectedOutput] = useState<string>('{\n  \n}');
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Fetch rule data on mount
  useEffect(() => {
    async function loadRule() {
      try {
        const response = await fetch(`/api/rules/${ruleId}`);
        if (!response.ok) throw new Error('Rule not found');
        const result = await response.json();
        setRule(result.data || result);
        
        // Generate a smart input sample based on conditions if available
        if (result.data?.conditions && Array.isArray(result.data.conditions) && result.data.conditions.length > 0) {
          const sample: Record<string, any> = {};
          result.data.conditions.forEach((c: any) => {
            if (c.field) {
              const keys = c.field.split('.');
              let current = sample;
              for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (i === keys.length - 1) {
                  current[key] = c.value !== undefined ? c.value : 'sample_value';
                } else {
                  current[key] = current[key] || {};
                  current = current[key];
                }
              }
            }
          });
          setInputData(JSON.stringify(sample, null, 2));
        }
      } catch (err) {
        toast.error('Failed to load rule metadata');
      } finally {
        setIsLoadingRule(false);
      }
    }

    loadRule();
  }, [ruleId]);

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      // Validate JSON input
      let parsedInput: any;
      try {
        parsedInput = JSON.parse(inputData);
      } catch (e) {
        toast.error('Invalid Input Data JSON format');
        setIsRunning(false);
        return;
      }

      let parsedExpected: any = null;
      if (expectedOutput.trim() && expectedOutput !== '{\n  \n}') {
        try {
          parsedExpected = JSON.parse(expectedOutput);
        } catch (e) {
          toast.error('Invalid Expected Output JSON format');
          setIsRunning(false);
          return;
        }
      }

      const response = await fetch(`/api/rules/${ruleId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputData: parsedInput,
          expectedOutput: parsedExpected,
          testName: `Web Test Run - ${new Date().toLocaleTimeString()}`
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Execution failed');
      }

      const result = await response.json();
      setTestResult(result.data);
      toast.success('Simulation executed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute test');
    } finally {
      setIsRunning(false);
    }
  };

  const loadSample = (type: string) => {
    if (type === 'vip') {
      setInputData(JSON.stringify({ customer: { tier: 'VIP' }, booking: { price: 2000000 } }, null, 2));
    } else if (type === 'basic') {
      setInputData(JSON.stringify({ customer: { tier: 'Standard' }, booking: { price: 500000 } }, null, 2));
    }
  };

  if (isLoadingRule) {
    return (
      <div className="container mx-auto py-12 text-center space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading simulator context...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-6xl space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="space-y-1">
          <Link
            href={`/dashboard/rules/${ruleId}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rule Details
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            Rule Simulator: <span className="text-primary">{rule?.name}</span>
          </h1>
          <p className="text-muted-foreground">
            Simulate and debug rule executions using mock payload data.
          </p>
        </div>

        <Button
          onClick={handleRunTest}
          disabled={isRunning}
          size="lg"
          className="gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
        >
          {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Simulation
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Inputs */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  Input Payload (JSON)
                </CardTitle>
                <CardDescription>Mock data structure to evaluate the rule conditions against.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="xs" onClick={() => loadSample('vip')} className="text-xs">VIP Sample</Button>
                <Button variant="ghost" size="xs" onClick={() => loadSample('basic')} className="text-xs">Standard Sample</Button>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                className="w-full h-64 p-4 font-mono text-sm border rounded-lg bg-black text-emerald-400 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none shadow-inner"
              />
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clipboard className="h-4 w-4 text-muted-foreground" />
                Expected Output JSON (Optional)
              </CardTitle>
              <CardDescription>If provided, simulator will assert if the result matches this schema.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                className="w-full h-32 p-4 font-mono text-sm border rounded-lg bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Results */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm bg-card/60 backdrop-blur-sm min-h-[500px]">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                Simulation Results
              </CardTitle>
              <CardDescription>Output logs, evaluated conditions, and action outcomes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!testResult && !isRunning && (
                <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg flex flex-col items-center justify-center space-y-3">
                  <Play className="h-10 w-10 text-muted-foreground/30 animate-pulse" />
                  <p>Click "Run Simulation" to execute the rule simulator.</p>
                </div>
              )}

              {isRunning && (
                <div className="text-center py-20 text-muted-foreground flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                  <p>Running rules evaluation engine...</p>
                </div>
              )}

              {testResult && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg flex items-center gap-3 border ${
                    testResult.passed 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-destructive/10 border-destructive/20 text-destructive'
                  }`}>
                    {testResult.passed ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-6 w-6 text-destructive shrink-0" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold text-sm">
                        {testResult.passed ? 'Execution Success & Passed' : 'Execution Failed / Mismatch'}
                      </p>
                      <p className="text-xs opacity-90">
                        Evaluated in {testResult.executionTimeMs}ms • {testResult.executedActions.length} action(s) triggered.
                      </p>
                      {testResult.errorMessage && (
                        <p className="text-xs font-mono font-bold mt-1 bg-black/5 dark:bg-black/35 p-1 rounded">
                          {testResult.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Conditions Evaluation Timeline */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      Step-by-Step Trace Log
                    </h3>
                    <div className="space-y-2 border-l-2 border-border pl-4 ml-2">
                      {testResult.trace?.map((step: any, idx: number) => {
                        const isMatch = step.result === 'matched' || step.result === 'all met' || step.result === 'success';
                        const isFail = step.result === 'not matched' || step.result === 'not all met';
                        
                        return (
                          <div key={idx} className="relative py-1">
                            {/* Dot Indicator */}
                            <span className={`absolute -left-[23px] top-[10px] w-2 h-2 rounded-full ring-4 ring-background ${
                              isMatch ? 'bg-emerald-500' : isFail ? 'bg-amber-500' : 'bg-muted-foreground'
                            }`} />
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-foreground">{step.step}</p>
                              <p className={`text-[10px] font-mono ${
                                isMatch ? 'text-emerald-500 font-bold' : isFail ? 'text-amber-500' : 'text-muted-foreground'
                              }`}>
                                Result: {step.result}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Output JSON */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-primary" />
                      Output Data Result
                    </h3>
                    <pre className="p-3 bg-muted rounded-lg font-mono text-xs overflow-auto max-h-48 border text-foreground">
                      {JSON.stringify(testResult.actualOutput, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
