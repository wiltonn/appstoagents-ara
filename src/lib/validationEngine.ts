// Enhanced Validation Engine for Advanced Wizard UI
// Task 2.1: Validation feedback with helpful error messages

import type { Question, ValidationRule } from '../types/wizard';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  type: 'required' | 'format' | 'range' | 'pattern' | 'custom';
  message: string;
  severity: 'error' | 'warning';
  helpText?: string;
  fixSuggestion?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  recommendation?: string;
}

export interface ValidationSuggestion {
  field: string;
  message: string;
  action?: string;
}

export class ValidationEngine {
  /**
   * Validate a single question answer
   */
  validateQuestion(question: Question, value: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Required field validation
    if (question.required && this.isEmpty(value)) {
      errors.push({
        field: question.id,
        type: 'required',
        message: this.getRequiredMessage(question),
        severity: 'error',
        helpText: this.getRequiredHelpText(question),
        fixSuggestion: this.getRequiredFixSuggestion(question),
      });
    }

    // Skip other validations if empty (unless required)
    if (this.isEmpty(value)) {
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
      };
    }

    // Type-specific validation
    this.validateByType(question, value, errors, warnings, suggestions);

    // Custom validation rules
    if (question.validation) {
      this.validateCustomRules(question, value, errors, warnings, suggestions);
    }

    // Business logic validation
    this.validateBusinessLogic(question, value, errors, warnings, suggestions);

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate multiple questions (entire step)
   */
  validateStep(questions: Question[], answers: Record<string, any>): ValidationResult {
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];
    const allSuggestions: ValidationSuggestion[] = [];

    for (const question of questions) {
      const result = this.validateQuestion(question, answers[question.id]);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
      allSuggestions.push(...result.suggestions);
    }

    // Cross-field validation
    this.validateCrossFields(questions, answers, allErrors, allWarnings, allSuggestions);

    return {
      isValid: allErrors.filter(e => e.severity === 'error').length === 0,
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
    };
  }

  /**
   * Get user-friendly error messages based on question context
   */
  private getRequiredMessage(question: Question): string {
    const fieldName = question.title.toLowerCase();
    
    if (question.type === 'single_select') {
      return `Please select ${fieldName.includes('an ') ? 'an' : 'a'} ${fieldName}`;
    }
    
    if (question.type === 'multi_select') {
      return `Please select at least one ${fieldName} option`;
    }
    
    if (question.type === 'scale_rating') {
      return `Please rate ${fieldName}`;
    }
    
    if (question.type === 'yes_no') {
      return `Please answer yes or no for ${fieldName}`;
    }
    
    return `${question.title} is required`;
  }

  /**
   * Get helpful text to guide users
   */
  private getRequiredHelpText(question: Question): string {
    switch (question.type) {
      case 'single_select':
        return 'Choose the option that best describes your situation';
      case 'multi_select':
        return 'You can select multiple options if applicable';
      case 'scale_rating':
        return 'Use the slider to indicate your rating on the scale';
      case 'text_input':
        return 'Enter the requested information in the text field';
      case 'number_input':
        return 'Enter a numeric value';
      case 'percentage':
        return 'Enter a percentage value between 0 and 100';
      case 'yes_no':
        return 'Select yes or no based on your situation';
      default:
        return 'This field is required to continue';
    }
  }

  /**
   * Get actionable fix suggestions
   */
  private getRequiredFixSuggestion(question: Question): string {
    switch (question.type) {
      case 'single_select':
        return 'Click on one of the available options';
      case 'multi_select':
        return 'Check at least one checkbox that applies';
      case 'scale_rating':
        return 'Drag the slider to select a rating';
      case 'text_input':
        return 'Type your answer in the text box';
      case 'number_input':
        return 'Enter a number in the input field';
      default:
        return 'Complete this field to proceed';
    }
  }

  /**
   * Validate based on question type
   */
  private validateByType(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    switch (question.type) {
      case 'number_input':
      case 'percentage':
        this.validateNumeric(question, value, errors, warnings);
        break;
      
      case 'text_input':
        this.validateText(question, value, errors, warnings);
        break;
      
      case 'scale_rating':
        this.validateScale(question, value, errors, warnings);
        break;
      
      case 'multi_select':
        this.validateMultiSelect(question, value, errors, warnings, suggestions);
        break;
      
      case 'single_select':
        this.validateSingleSelect(question, value, errors, warnings, suggestions);
        break;
    }
  }

  /**
   * Validate numeric inputs
   */
  private validateNumeric(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      errors.push({
        field: question.id,
        type: 'format',
        message: 'Please enter a valid number',
        severity: 'error',
        helpText: 'Only numeric values are allowed',
        fixSuggestion: 'Remove any non-numeric characters',
      });
      return;
    }

    if (question.validation?.min !== undefined && numValue < question.validation.min) {
      errors.push({
        field: question.id,
        type: 'range',
        message: `Value must be at least ${question.validation.min}`,
        severity: 'error',
        helpText: `The minimum allowed value is ${question.validation.min}`,
        fixSuggestion: `Enter a value of ${question.validation.min} or higher`,
      });
    }

    if (question.validation?.max !== undefined && numValue > question.validation.max) {
      errors.push({
        field: question.id,
        type: 'range',
        message: `Value must be at most ${question.validation.max}`,
        severity: 'error',
        helpText: `The maximum allowed value is ${question.validation.max}`,
        fixSuggestion: `Enter a value of ${question.validation.max} or lower`,
      });
    }

    // Warning for suspicious values
    if (question.type === 'percentage' && numValue > 100) {
      warnings.push({
        field: question.id,
        message: 'Percentage value seems unusually high',
        recommendation: 'Double-check that this is a percentage, not a whole number',
      });
    }
  }

  /**
   * Validate text inputs
   */
  private validateText(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const strValue = String(value);

    if (question.validation?.minLength && strValue.length < question.validation.minLength) {
      errors.push({
        field: question.id,
        type: 'format',
        message: `Must be at least ${question.validation.minLength} characters`,
        severity: 'error',
        helpText: `Current length: ${strValue.length}, required: ${question.validation.minLength}`,
        fixSuggestion: 'Add more detail to your answer',
      });
    }

    if (question.validation?.maxLength && strValue.length > question.validation.maxLength) {
      errors.push({
        field: question.id,
        type: 'format',
        message: `Must be no more than ${question.validation.maxLength} characters`,
        severity: 'error',
        helpText: `Current length: ${strValue.length}, maximum: ${question.validation.maxLength}`,
        fixSuggestion: 'Shorten your answer to fit the limit',
      });
    }

    if (question.validation?.pattern) {
      const regex = new RegExp(question.validation.pattern);
      if (!regex.test(strValue)) {
        errors.push({
          field: question.id,
          type: 'pattern',
          message: question.validation.message || 'Invalid format',
          severity: 'error',
          helpText: this.getPatternHelpText(question.validation.pattern),
          fixSuggestion: this.getPatternFixSuggestion(question.validation.pattern),
        });
      }
    }
  }

  /**
   * Validate scale ratings
   */
  private validateScale(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const numValue = Number(value);
    const min = question.validation?.min || 1;
    const max = question.validation?.max || 10;

    if (numValue < min || numValue > max) {
      errors.push({
        field: question.id,
        type: 'range',
        message: `Rating must be between ${min} and ${max}`,
        severity: 'error',
        helpText: `Use the slider to select a value in the valid range`,
        fixSuggestion: `Choose a rating between ${min} and ${max}`,
      });
    }

    // Suggest extreme values might need consideration
    if (numValue === min || numValue === max) {
      warnings.push({
        field: question.id,
        message: `You selected an extreme value (${numValue})`,
        recommendation: 'Consider if this accurately reflects your situation',
      });
    }
  }

  /**
   * Validate multi-select inputs
   */
  private validateMultiSelect(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    if (!Array.isArray(value)) {
      errors.push({
        field: question.id,
        type: 'format',
        message: 'Invalid selection format',
        severity: 'error',
        helpText: 'Please use the checkboxes to make selections',
        fixSuggestion: 'Click on the checkboxes to select options',
      });
      return;
    }

    const selectedCount = value.length;
    
    if (question.validation?.minItems && selectedCount < question.validation.minItems) {
      errors.push({
        field: question.id,
        type: 'range',
        message: `Please select at least ${question.validation.minItems} option${question.validation.minItems > 1 ? 's' : ''}`,
        severity: 'error',
        helpText: `You have selected ${selectedCount}, minimum required: ${question.validation.minItems}`,
        fixSuggestion: `Select ${question.validation.minItems - selectedCount} more option${question.validation.minItems - selectedCount > 1 ? 's' : ''}`,
      });
    }

    if (question.validation?.maxItems && selectedCount > question.validation.maxItems) {
      errors.push({
        field: question.id,
        type: 'range',
        message: `Please select no more than ${question.validation.maxItems} option${question.validation.maxItems > 1 ? 's' : ''}`,
        severity: 'error',
        helpText: `You have selected ${selectedCount}, maximum allowed: ${question.validation.maxItems}`,
        fixSuggestion: `Deselect ${selectedCount - question.validation.maxItems} option${selectedCount - question.validation.maxItems > 1 ? 's' : ''}`,
      });
    }

    // Suggest reviewing if too many/few selections
    const optionCount = question.options?.length || 0;
    if (selectedCount === optionCount && optionCount > 3) {
      suggestions.push({
        field: question.id,
        message: 'You selected all available options',
        action: 'Consider if all options truly apply to your situation',
      });
    }
  }

  /**
   * Validate single-select inputs
   */
  private validateSingleSelect(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    const validValues = question.options?.map(opt => opt.value) || [];
    
    if (!validValues.includes(value)) {
      errors.push({
        field: question.id,
        type: 'format',
        message: 'Please select a valid option',
        severity: 'error',
        helpText: 'Choose from the available options',
        fixSuggestion: 'Click on one of the provided choices',
      });
    }
  }

  /**
   * Validate custom business rules
   */
  private validateCustomRules(
    question: Question,
    value: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    // Add business-specific validation logic here
    // For example, validate company size vs employee count consistency
    
    if (question.id === 'employee_count' && question.id === 'company_size') {
      // This would be called with context from other answers
      // Implementation would depend on having access to other form values
    }
  }

  /**
   * Validate relationships between multiple fields
   */
  private validateCrossFields(
    questions: Question[],
    answers: Record<string, any>,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    // Example: Validate consistency between company size and employee count
    const companySize = answers.company_size;
    const employeeCount = Number(answers.employee_count);

    if (companySize && employeeCount) {
      if (companySize === 'startup' && employeeCount > 50) {
        warnings.push({
          field: 'employee_count',
          message: 'Employee count seems high for a startup',
          recommendation: 'Consider if "startup" is the right company size category',
        });
      }
      
      if (companySize === 'enterprise' && employeeCount < 100) {
        warnings.push({
          field: 'company_size',
          message: 'Company size may not match employee count',
          recommendation: 'Verify the company size classification',
        });
      }
    }

    // Example: Suggest related answers
    if (answers.current_ai_usage === 'none' && answers.tech_stack_maturity > 7) {
      suggestions.push({
        field: 'current_ai_usage',
        message: 'High tech maturity but no AI usage',
        action: 'Consider exploring AI integration opportunities',
      });
    }
  }

  /**
   * Get help text for pattern validation
   */
  private getPatternHelpText(pattern: string): string {
    // Common pattern explanations
    if (pattern.includes('@')) {
      return 'Please enter a valid email address';
    }
    if (pattern.includes('\\d')) {
      return 'Must contain at least one number';
    }
    if (pattern.includes('[A-Z]')) {
      return 'Must contain at least one uppercase letter';
    }
    return 'Please match the required format';
  }

  /**
   * Get fix suggestions for pattern validation
   */
  private getPatternFixSuggestion(pattern: string): string {
    if (pattern.includes('@')) {
      return 'Enter format: name@domain.com';
    }
    if (pattern.includes('\\d')) {
      return 'Add numbers to your input';
    }
    if (pattern.includes('[A-Z]')) {
      return 'Include uppercase letters';
    }
    return 'Check the format requirements and try again';
  }

  /**
   * Check if a value is considered empty
   */
  private isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'number' && isNaN(value)) return true;
    return false;
  }
}

// Export singleton instance
export const validationEngine = new ValidationEngine();