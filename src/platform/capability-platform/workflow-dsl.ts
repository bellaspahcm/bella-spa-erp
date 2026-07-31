export interface DSLTransitionRule {
  from: string;
  to: string;
  action: string;
  condition?: string; // e.g. "attempts < 2"
}

export interface DSLWorkflowDefinition {
  states: string[];
  initialState: string;
  terminalStates: string[];
  transitions: DSLTransitionRule[];
}

export class WorkflowDSLEngine {
  public static evaluateTransition(
    definition: DSLWorkflowDefinition,
    currentState: string,
    action: string,
    _context: Record<string, unknown> = {}
  ): {
    isValid: boolean;
    nextState: string;
    isTerminal: boolean;
  } {
    const transition = definition.transitions.find(
      t => t.from === currentState && t.action === action
    );

    if (!transition) {
      return {
        isValid: false,
        nextState: currentState,
        isTerminal: definition.terminalStates.includes(currentState),
      };
    }

    return {
      isValid: true,
      nextState: transition.to,
      isTerminal: definition.terminalStates.includes(transition.to),
    };
  }
}
