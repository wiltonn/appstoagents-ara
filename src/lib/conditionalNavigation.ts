// Conditional Navigation System for Advanced Wizard UI
// Task 2.1: Enhanced wizard UI with conditional step navigation

import type { WizardStep, Question } from '../types/wizard';
import type { ConditionalLogic } from '../types/conditionalLogic';

export interface NavigationRule {
  condition: ConditionalLogic;
  action: 'skip' | 'require' | 'suggest' | 'block';
  targetStep?: string;
  message?: string;
}

export interface StepNavigation {
  canNavigateNext: boolean;
  canNavigatePrevious: boolean;
  nextStepId?: string;
  skipMessage?: string;
  blockMessage?: string;
  suggestedSteps?: string[];
}

export class ConditionalNavigationEngine {
  private navigationRules: Map<string, NavigationRule[]> = new Map();

  /**
   * Register navigation rules for a specific step
   */
  registerStepRules(stepId: string, rules: NavigationRule[]): void {
    this.navigationRules.set(stepId, rules);
  }

  /**
   * Evaluate navigation rules for a step
   */
  evaluateNavigation(
    currentStep: WizardStep,
    allSteps: WizardStep[],
    answers: Record<string, any>
  ): StepNavigation {
    const rules = this.navigationRules.get(currentStep.id) || [];
    
    let canNavigateNext = true;
    let canNavigatePrevious = true;
    let nextStepId: string | undefined;
    let skipMessage: string | undefined;
    let blockMessage: string | undefined;
    let suggestedSteps: string[] = [];

    // Evaluate each rule
    for (const rule of rules) {
      const conditionMet = this.evaluateCondition(rule.condition, answers);
      
      if (conditionMet) {
        switch (rule.action) {
          case 'skip':
            nextStepId = rule.targetStep || this.getNextStep(currentStep, allSteps)?.id;
            skipMessage = rule.message;
            break;
          
          case 'block':
            canNavigateNext = false;
            blockMessage = rule.message || 'Cannot proceed to next step';
            break;
          
          case 'require':
            // Custom logic for required steps
            if (!this.isStepCompleted(currentStep, answers)) {
              canNavigateNext = false;
              blockMessage = rule.message || 'Please complete all required fields';
            }
            break;
          
          case 'suggest':
            if (rule.targetStep) {
              suggestedSteps.push(rule.targetStep);
            }
            break;
        }
      }
    }

    // Check if current step is actually completable
    const stepCompleted = this.isStepCompleted(currentStep, answers);
    if (!stepCompleted && !blockMessage) {
      canNavigateNext = false;
      blockMessage = 'Please complete all required fields before continuing';
    }

    // Check for conditional questions within the step
    const conditionalQuestions = this.getConditionalQuestions(currentStep, answers);
    if (conditionalQuestions.some(q => q.required && !answers[q.id])) {
      canNavigateNext = false;
      blockMessage = 'Please answer all applicable questions';
    }

    return {
      canNavigateNext,
      canNavigatePrevious,
      nextStepId,
      skipMessage,
      blockMessage,
      suggestedSteps,
    };
  }

  /**
   * Determine the optimal step sequence based on answers
   */
  getOptimalStepSequence(
    allSteps: WizardStep[],
    answers: Record<string, any>
  ): WizardStep[] {
    const sequence: WizardStep[] = [];
    const processedSteps = new Set<string>();

    let currentStep = allSteps.find(step => step.order === 1);
    
    while (currentStep && !processedSteps.has(currentStep.id)) {
      processedSteps.add(currentStep.id);
      sequence.push(currentStep);

      const navigation = this.evaluateNavigation(currentStep, allSteps, answers);
      
      if (navigation.nextStepId) {
        // Follow conditional navigation
        currentStep = allSteps.find(step => step.id === navigation.nextStepId);
      } else {
        // Follow natural order
        currentStep = this.getNextStep(currentStep, allSteps);
      }
    }

    return sequence;
  }

  /**
   * Get questions that should be shown based on conditional logic
   */
  getConditionalQuestions(step: WizardStep, answers: Record<string, any>): Question[] {
    return step.questions.filter(question => {
      if (!question.conditionalLogic && !question.enhancedConditionalLogic) {
        return true; // Always show if no conditional logic
      }

      // Check enhanced conditional logic first
      if (question.enhancedConditionalLogic) {
        return this.evaluateCondition(question.enhancedConditionalLogic, answers);
      }

      // Fallback to legacy conditional logic
      if (question.conditionalLogic?.showIf) {
        const { questionId, value: conditionValue } = question.conditionalLogic.showIf;
        const currentAnswer = answers[questionId];
        
        if (Array.isArray(conditionValue)) {
          return Array.isArray(currentAnswer) 
            ? conditionValue.some(v => currentAnswer.includes(v))
            : conditionValue.includes(currentAnswer);
        }
        
        return currentAnswer === conditionValue;
      }

      return true;
    });
  }

  /**
   * Evaluate a conditional logic expression
   */
  private evaluateCondition(condition: ConditionalLogic, answers: Record<string, any>): boolean {
    if (condition.type === 'simple') {
      const answer = answers[condition.questionId];
      
      switch (condition.operator) {
        case 'equals':
          return answer === condition.value;
        case 'not_equals':
          return answer !== condition.value;
        case 'contains':
          return Array.isArray(answer) && answer.includes(condition.value);
        case 'not_contains':
          return !Array.isArray(answer) || !answer.includes(condition.value);
        case 'greater_than':
          return Number(answer) > Number(condition.value);
        case 'less_than':
          return Number(answer) < Number(condition.value);
        case 'greater_equal':
          return Number(answer) >= Number(condition.value);
        case 'less_equal':
          return Number(answer) <= Number(condition.value);
        case 'is_empty':
          return !answer || answer === '' || (Array.isArray(answer) && answer.length === 0);
        case 'is_not_empty':
          return Boolean(answer) && answer !== '' && (!Array.isArray(answer) || answer.length > 0);
        default:
          return false;
      }
    }

    if (condition.type === 'compound') {
      const leftResult = this.evaluateCondition(condition.left, answers);
      const rightResult = this.evaluateCondition(condition.right, answers);
      
      switch (condition.operator) {
        case 'and':
          return leftResult && rightResult;
        case 'or':
          return leftResult || rightResult;
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Check if a step is completed (all required questions answered)
   */
  private isStepCompleted(step: WizardStep, answers: Record<string, any>): boolean {
    const applicableQuestions = this.getConditionalQuestions(step, answers);
    
    return applicableQuestions.every(question => {
      if (!question.required) return true;
      
      const answer = answers[question.id];
      if (answer === undefined || answer === null || answer === '') {
        return false;
      }
      
      // Special validation for multi-select
      if (question.type === 'multi_select' && Array.isArray(answer)) {
        return answer.length > 0;
      }
      
      return true;
    });
  }

  /**
   * Get the next step in natural order
   */
  private getNextStep(currentStep: WizardStep, allSteps: WizardStep[]): WizardStep | undefined {
    const sortedSteps = allSteps.sort((a, b) => a.order - b.order);
    const currentIndex = sortedSteps.findIndex(step => step.id === currentStep.id);
    return sortedSteps[currentIndex + 1];
  }

  /**
   * Get the previous step in natural order
   */
  private getPreviousStep(currentStep: WizardStep, allSteps: WizardStep[]): WizardStep | undefined {
    const sortedSteps = allSteps.sort((a, b) => a.order - b.order);
    const currentIndex = sortedSteps.findIndex(step => step.id === currentStep.id);
    return sortedSteps[currentIndex - 1];
  }

  /**
   * Get intelligent step suggestions based on current answers
   */
  getStepSuggestions(
    currentAnswers: Record<string, any>,
    allSteps: WizardStep[]
  ): Array<{ step: WizardStep; reason: string; priority: 'high' | 'medium' | 'low' }> {
    const suggestions: Array<{ step: WizardStep; reason: string; priority: 'high' | 'medium' | 'low' }> = [];

    for (const step of allSteps) {
      const navigation = this.evaluateNavigation(step, allSteps, currentAnswers);
      
      if (navigation.suggestedSteps.length > 0) {
        suggestions.push({
          step,
          reason: `Based on your answers, this step may be particularly relevant`,
          priority: 'medium',
        });
      }

      // Analyze step relevance based on answers
      const relevantQuestions = step.questions.filter(q => {
        // Check if question relates to current answers
        return Object.keys(currentAnswers).some(answeredQuestion => {
          return q.id.includes(answeredQuestion) || q.title.toLowerCase().includes(answeredQuestion);
        });
      });

      if (relevantQuestions.length > 0) {
        suggestions.push({
          step,
          reason: `Contains questions related to your current focus areas`,
          priority: 'low',
        });
      }
    }

    // Sort by priority
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

// Export singleton instance
export const conditionalNavigation = new ConditionalNavigationEngine();

// Default navigation rules for common patterns
export const DEFAULT_NAVIGATION_RULES: Record<string, NavigationRule[]> = {
  // Skip technical questions for non-technical companies
  technical_readiness: [
    {
      condition: {
        type: 'simple',
        questionId: 'company_type',
        operator: 'equals',
        value: 'non_technical',
      },
      action: 'skip',
      targetStep: 'operational_readiness',
      message: 'Skipping technical questions for non-technical organizations',
    },
  ],
  
  // Require security clearance for enterprise
  security_readiness: [
    {
      condition: {
        type: 'simple',
        questionId: 'company_size',
        operator: 'equals',
        value: 'enterprise',
      },
      action: 'require',
      message: 'Security assessment is required for enterprise organizations',
    },
  ],
  
  // Suggest operational focus for startups
  operational_readiness: [
    {
      condition: {
        type: 'simple',
        questionId: 'company_size',
        operator: 'equals',
        value: 'startup',
      },
      action: 'suggest',
      message: 'Consider focusing on operational readiness as a startup priority',
    },
  ],
};