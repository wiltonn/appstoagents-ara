// Enhanced conditional logic types for wizard navigation

export type ComparisonOperator = 
  | 'equals' 
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty';

export type LogicalOperator = 'and' | 'or';

export interface ConditionalRule {
  questionId: string;
  operator: ComparisonOperator;
  value?: any;
  caseSensitive?: boolean;
}

export interface ConditionalGroup {
  operator: LogicalOperator;
  rules: ConditionalRule[];
  groups?: ConditionalGroup[];
}

export interface EnhancedConditionalLogic {
  showIf?: ConditionalGroup;
  hideIf?: ConditionalGroup;
  enableIf?: ConditionalGroup;
  disableIf?: ConditionalGroup;
}

export interface ConditionalAction {
  type: 'show' | 'hide' | 'enable' | 'disable' | 'require' | 'optional';
  condition: ConditionalGroup;
}

export interface StepConditionalLogic {
  skipIf?: ConditionalGroup;
  showIf?: ConditionalGroup;
  actions?: ConditionalAction[];
}

// Helper functions for conditional logic evaluation
export class ConditionalLogicEvaluator {
  static evaluateRule(rule: ConditionalRule, answers: Record<string, any>): boolean {
    const answerValue = answers[rule.questionId];
    const { operator, value, caseSensitive = false } = rule;

    // Handle case sensitivity for string comparisons
    const normalizeValue = (val: any) => {
      if (typeof val === 'string' && !caseSensitive) {
        return val.toLowerCase();
      }
      return val;
    };

    const normalizedAnswer = normalizeValue(answerValue);
    const normalizedRuleValue = normalizeValue(value);

    switch (operator) {
      case 'equals':
        return normalizedAnswer === normalizedRuleValue;
      
      case 'not_equals':
        return normalizedAnswer !== normalizedRuleValue;
      
      case 'greater_than':
        return Number(answerValue) > Number(value);
      
      case 'less_than':
        return Number(answerValue) < Number(value);
      
      case 'greater_than_or_equal':
        return Number(answerValue) >= Number(value);
      
      case 'less_than_or_equal':
        return Number(answerValue) <= Number(value);
      
      case 'contains':
        if (Array.isArray(answerValue)) {
          return answerValue.some(item => 
            normalizeValue(item) === normalizedRuleValue
          );
        }
        return String(normalizedAnswer).includes(String(normalizedRuleValue));
      
      case 'not_contains':
        if (Array.isArray(answerValue)) {
          return !answerValue.some(item => 
            normalizeValue(item) === normalizedRuleValue
          );
        }
        return !String(normalizedAnswer).includes(String(normalizedRuleValue));
      
      case 'in':
        if (Array.isArray(value)) {
          return value.some(val => normalizeValue(val) === normalizedAnswer);
        }
        return false;
      
      case 'not_in':
        if (Array.isArray(value)) {
          return !value.some(val => normalizeValue(val) === normalizedAnswer);
        }
        return true;
      
      case 'is_empty':
        return answerValue === undefined || 
               answerValue === null || 
               answerValue === '' ||
               (Array.isArray(answerValue) && answerValue.length === 0);
      
      case 'is_not_empty':
        return answerValue !== undefined && 
               answerValue !== null && 
               answerValue !== '' &&
               (!Array.isArray(answerValue) || answerValue.length > 0);
      
      default:
        console.warn(`Unknown comparison operator: ${operator}`);
        return false;
    }
  }

  static evaluateGroup(group: ConditionalGroup, answers: Record<string, any>): boolean {
    const { operator, rules = [], groups = [] } = group;

    // Evaluate all rules in this group
    const ruleResults = rules.map(rule => this.evaluateRule(rule, answers));
    
    // Evaluate all nested groups
    const groupResults = groups.map(nestedGroup => this.evaluateGroup(nestedGroup, answers));
    
    // Combine all results
    const allResults = [...ruleResults, ...groupResults];
    
    if (allResults.length === 0) {
      return true; // Empty group is considered true
    }

    switch (operator) {
      case 'and':
        return allResults.every(result => result);
      
      case 'or':
        return allResults.some(result => result);
      
      default:
        console.warn(`Unknown logical operator: ${operator}`);
        return false;
    }
  }

  static shouldShowQuestion(
    conditionalLogic: EnhancedConditionalLogic | undefined,
    answers: Record<string, any>
  ): boolean {
    if (!conditionalLogic) return true;

    const { showIf, hideIf } = conditionalLogic;

    // Check hide condition first (takes precedence)
    if (hideIf && this.evaluateGroup(hideIf, answers)) {
      return false;
    }

    // Check show condition
    if (showIf) {
      return this.evaluateGroup(showIf, answers);
    }

    return true; // Default to showing if no conditions
  }

  static shouldEnableQuestion(
    conditionalLogic: EnhancedConditionalLogic | undefined,
    answers: Record<string, any>
  ): boolean {
    if (!conditionalLogic) return true;

    const { enableIf, disableIf } = conditionalLogic;

    // Check disable condition first (takes precedence)
    if (disableIf && this.evaluateGroup(disableIf, answers)) {
      return false;
    }

    // Check enable condition
    if (enableIf) {
      return this.evaluateGroup(enableIf, answers);
    }

    return true; // Default to enabled if no conditions
  }

  static shouldSkipStep(
    stepLogic: StepConditionalLogic | undefined,
    answers: Record<string, any>
  ): boolean {
    if (!stepLogic?.skipIf) return false;
    return this.evaluateGroup(stepLogic.skipIf, answers);
  }

  static shouldShowStep(
    stepLogic: StepConditionalLogic | undefined,
    answers: Record<string, any>
  ): boolean {
    if (!stepLogic?.showIf) return true;
    return this.evaluateGroup(stepLogic.showIf, answers);
  }
}