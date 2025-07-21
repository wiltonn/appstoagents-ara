// Enhanced validation system with contextual error messages

import type { Question } from '../types/wizard';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  suggestion?: string;
}

export interface ValidationRule {
  name: string;
  validate: (value: any, question: Question, allAnswers?: Record<string, any>) => ValidationResult;
  priority: number; // Higher number = higher priority
}

export class WizardValidator {
  private static rules: ValidationRule[] = [
    // Required field validation
    {
      name: 'required',
      priority: 100,
      validate: (value: any, question: Question) => {
        if (!question.required) return { isValid: true };
        
        const isEmpty = value === undefined || 
                        value === null || 
                        value === '' ||
                        (Array.isArray(value) && value.length === 0);
        
        if (isEmpty) {
          return {
            isValid: false,
            error: `${question.title} is required. Please provide an answer to continue.`,
          };
        }
        
        return { isValid: true };
      },
    },

    // Number range validation
    {
      name: 'number_range',
      priority: 90,
      validate: (value: any, question: Question) => {
        if (question.type !== 'number_input' && question.type !== 'scale_rating' && question.type !== 'percentage') {
          return { isValid: true };
        }
        
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return {
            isValid: false,
            error: 'Please enter a valid number.',
          };
        }
        
        const { min, max } = question.validation || {};
        
        if (min !== undefined && numValue < min) {
          return {
            isValid: false,
            error: `Value must be at least ${min}. You entered ${numValue}.`,
            suggestion: `Try entering a value between ${min} and ${max || 'any number'}.`,
          };
        }
        
        if (max !== undefined && numValue > max) {
          return {
            isValid: false,
            error: `Value must be at most ${max}. You entered ${numValue}.`,
            suggestion: `Try entering a value between ${min || 'any number'} and ${max}.`,
          };
        }
        
        return { isValid: true };
      },
    },

    // Percentage validation
    {
      name: 'percentage',
      priority: 85,
      validate: (value: any, question: Question) => {
        if (question.type !== 'percentage') return { isValid: true };
        
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return {
            isValid: false,
            error: 'Please enter a valid percentage.',
          };
        }
        
        if (numValue < 0 || numValue > 100) {
          return {
            isValid: false,
            error: `Percentage must be between 0 and 100. You entered ${numValue}%.`,
            suggestion: 'Enter a value like 25 for 25%, or 0 for 0%.',
          };
        }
        
        return { isValid: true };
      },
    },

    // Pattern validation (regex)
    {
      name: 'pattern',
      priority: 80,
      validate: (value: any, question: Question) => {
        if (question.type !== 'text_input' || !question.validation?.pattern) {
          return { isValid: true };
        }
        
        const stringValue = String(value || '');
        if (!stringValue) return { isValid: true }; // Let required validation handle empty values
        
        const regex = new RegExp(question.validation.pattern);
        if (!regex.test(stringValue)) {
          const customMessage = question.validation.message;
          const defaultMessage = 'The format of your input is not valid.';
          
          return {
            isValid: false,
            error: customMessage || defaultMessage,
            suggestion: customMessage ? undefined : 'Please check the format and try again.',
          };
        }
        
        return { isValid: true };
      },
    },

    // Multi-select minimum selection
    {
      name: 'multi_select_minimum',
      priority: 75,
      validate: (value: any, question: Question) => {
        if (question.type !== 'multi_select') return { isValid: true };
        
        const arrayValue = Array.isArray(value) ? value : [];
        const minSelections = question.validation?.min || (question.required ? 1 : 0);
        
        if (arrayValue.length < minSelections) {
          const selectionText = minSelections === 1 ? 'option' : 'options';
          return {
            isValid: false,
            error: `Please select at least ${minSelections} ${selectionText}.`,
            suggestion: `You have selected ${arrayValue.length} ${selectionText}. Select ${minSelections - arrayValue.length} more.`,
          };
        }
        
        return { isValid: true };
      },
    },

    // Multi-select maximum selection
    {
      name: 'multi_select_maximum',
      priority: 70,
      validate: (value: any, question: Question) => {
        if (question.type !== 'multi_select' || !question.validation?.max) {
          return { isValid: true };
        }
        
        const arrayValue = Array.isArray(value) ? value : [];
        const maxSelections = question.validation.max;
        
        if (arrayValue.length > maxSelections) {
          const selectionText = maxSelections === 1 ? 'option' : 'options';
          return {
            isValid: false,
            error: `Please select at most ${maxSelections} ${selectionText}.`,
            suggestion: `You have selected ${arrayValue.length} options. Remove ${arrayValue.length - maxSelections} selections.`,
          };
        }
        
        return { isValid: true };
      },
    },

    // Text length validation
    {
      name: 'text_length',
      priority: 65,
      validate: (value: any, question: Question) => {
        if (question.type !== 'text_input') return { isValid: true };
        
        const stringValue = String(value || '');
        const { min, max } = question.validation || {};
        
        if (min !== undefined && stringValue.length < min) {
          return {
            isValid: false,
            error: `Please enter at least ${min} characters. Current length: ${stringValue.length}.`,
            suggestion: `Add ${min - stringValue.length} more characters.`,
          };
        }
        
        if (max !== undefined && stringValue.length > max) {
          return {
            isValid: false,
            error: `Please enter at most ${max} characters. Current length: ${stringValue.length}.`,
            suggestion: `Remove ${stringValue.length - max} characters.`,
          };
        }
        
        return { isValid: true };
      },
    },

    // Business logic validation
    {
      name: 'business_logic',
      priority: 50,
      validate: (value: any, question: Question, allAnswers = {}) => {
        // Custom business validation rules
        
        // Example: If company size is startup, certain features might not be applicable
        if (question.id === 'api_architecture' && allAnswers.company_size === 'startup') {
          if (value === 'microservices') {
            return {
              isValid: true,
              warning: 'Microservices can be complex for startups. Consider if this aligns with your current resources.',
            };
          }
        }
        
        // Example: If industry is healthcare, compliance becomes more critical
        if (question.id === 'compliance_requirements' && allAnswers.industry === 'healthcare') {
          const selectedCompliances = Array.isArray(value) ? value : [];
          if (!selectedCompliances.includes('hipaa')) {
            return {
              isValid: true,
              warning: 'Healthcare organizations typically need HIPAA compliance. Consider adding this requirement.',
            };
          }
        }
        
        // Example: If data is highly sensitive, certain security practices become critical
        if (question.id === 'security_practices' && allAnswers.data_sensitivity === 'regulated') {
          const selectedPractices = Array.isArray(value) ? value : [];
          const criticalPractices = ['encryption', 'access_control', 'audit_logs'];
          const missingPractices = criticalPractices.filter(practice => !selectedPractices.includes(practice));
          
          if (missingPractices.length > 0) {
            return {
              isValid: true,
              warning: `For regulated data, consider adding: ${missingPractices.join(', ')}`,
            };
          }
        }
        
        return { isValid: true };
      },
    },
  ];

  public static validateQuestion(
    question: Question, 
    value: any, 
    allAnswers?: Record<string, any>
  ): ValidationResult {
    // Sort rules by priority (highest first)
    const sortedRules = this.rules.sort((a, b) => b.priority - a.priority);
    
    // Run validation rules in priority order
    for (const rule of sortedRules) {
      const result = rule.validate(value, question, allAnswers);
      
      // Return first validation failure
      if (!result.isValid) {
        return result;
      }
      
      // Collect warnings (but continue validation)
      if (result.warning) {
        return result;
      }
    }
    
    return { isValid: true };
  }

  public static validateStep(
    questions: Question[],
    answers: Record<string, any>
  ): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    
    for (const question of questions) {
      const value = answers[question.id];
      results[question.id] = this.validateQuestion(question, value, answers);
    }
    
    return results;
  }

  public static hasErrors(validationResults: Record<string, ValidationResult>): boolean {
    return Object.values(validationResults).some(result => !result.isValid);
  }

  public static getErrorCount(validationResults: Record<string, ValidationResult>): number {
    return Object.values(validationResults).filter(result => !result.isValid).length;
  }

  public static getWarningCount(validationResults: Record<string, ValidationResult>): number {
    return Object.values(validationResults).filter(result => result.warning).length;
  }

  public static getFirstError(validationResults: Record<string, ValidationResult>): string | undefined {
    const firstError = Object.values(validationResults).find(result => !result.isValid);
    return firstError?.error;
  }

  // Real-time validation for better UX
  public static validateOnChange(
    question: Question,
    value: any,
    allAnswers: Record<string, any>
  ): ValidationResult {
    // For real-time validation, we might want to be less strict
    // or show suggestions instead of errors for incomplete input
    
    if (question.type === 'text_input' && question.validation?.pattern) {
      const stringValue = String(value || '');
      if (stringValue && question.validation.pattern) {
        const regex = new RegExp(question.validation.pattern);
        if (!regex.test(stringValue)) {
          return {
            isValid: false,
            suggestion: question.validation.message || 'Check the format as you type',
          };
        }
      }
    }
    
    return this.validateQuestion(question, value, allAnswers);
  }
}