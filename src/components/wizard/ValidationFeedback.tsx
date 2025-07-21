// Enhanced Validation Feedback Component
// Task 2.1: Validation feedback with helpful error messages

import React from 'react';
import type { ValidationResult, ValidationError, ValidationWarning, ValidationSuggestion } from '../../lib/validationEngine';

interface ValidationFeedbackProps {
  validation: ValidationResult;
  showWarnings?: boolean;
  showSuggestions?: boolean;
  className?: string;
  compact?: boolean;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  validation,
  showWarnings = true,
  showSuggestions = true,
  className = '',
  compact = false,
}) => {
  const { errors, warnings, suggestions } = validation;
  const errorMessages = errors.filter(e => e.severity === 'error');
  const warningMessages = errors.filter(e => e.severity === 'warning').concat(warnings.map(w => ({
    field: w.field,
    type: 'custom' as const,
    message: w.message,
    severity: 'warning' as const,
    helpText: w.recommendation,
  })));

  if (errorMessages.length === 0 && (!showWarnings || warningMessages.length === 0) && (!showSuggestions || suggestions.length === 0)) {
    return null;
  }

  return (
    <div className={`validation-feedback ${className}`}>
      {/* Errors */}
      {errorMessages.length > 0 && (
        <div className="space-y-2">
          {errorMessages.map((error, index) => (
            <ValidationErrorItem
              key={`error-${error.field}-${index}`}
              error={error}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Warnings */}
      {showWarnings && warningMessages.length > 0 && (
        <div className={`space-y-2 ${errorMessages.length > 0 ? 'mt-3' : ''}`}>
          {warningMessages.map((warning, index) => (
            <ValidationWarningItem
              key={`warning-${warning.field}-${index}`}
              warning={warning}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className={`space-y-2 ${(errorMessages.length > 0 || warningMessages.length > 0) ? 'mt-3' : ''}`}>
          {suggestions.map((suggestion, index) => (
            <ValidationSuggestionItem
              key={`suggestion-${suggestion.field}-${index}`}
              suggestion={suggestion}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ValidationErrorItemProps {
  error: ValidationError;
  compact: boolean;
}

const ValidationErrorItem: React.FC<ValidationErrorItemProps> = ({ error, compact }) => {
  return (
    <div 
      className={`flex items-start ${compact ? 'p-2' : 'p-3'} bg-red-50 border border-red-200 rounded-md`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0">
        <svg 
          className="w-5 h-5 text-red-400 mt-0.5" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
            clipRule="evenodd" 
          />
        </svg>
      </div>
      <div className="ml-3 flex-1">
        <p className={`font-medium text-red-800 ${compact ? 'text-sm' : 'text-sm'}`}>
          {error.message}
        </p>
        {!compact && error.helpText && (
          <p className="text-sm text-red-700 mt-1">
            {error.helpText}
          </p>
        )}
        {!compact && error.fixSuggestion && (
          <div className="mt-2 text-sm">
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-100 text-red-800 font-medium">
              💡 {error.fixSuggestion}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ValidationWarningItemProps {
  warning: ValidationError;
  compact: boolean;
}

const ValidationWarningItem: React.FC<ValidationWarningItemProps> = ({ warning, compact }) => {
  return (
    <div 
      className={`flex items-start ${compact ? 'p-2' : 'p-3'} bg-amber-50 border border-amber-200 rounded-md`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0">
        <svg 
          className="w-5 h-5 text-amber-400 mt-0.5" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
            clipRule="evenodd" 
          />
        </svg>
      </div>
      <div className="ml-3 flex-1">
        <p className={`font-medium text-amber-800 ${compact ? 'text-sm' : 'text-sm'}`}>
          {warning.message}
        </p>
        {!compact && warning.helpText && (
          <p className="text-sm text-amber-700 mt-1">
            {warning.helpText}
          </p>
        )}
      </div>
    </div>
  );
};

interface ValidationSuggestionItemProps {
  suggestion: ValidationSuggestion;
  compact: boolean;
}

const ValidationSuggestionItem: React.FC<ValidationSuggestionItemProps> = ({ suggestion, compact }) => {
  return (
    <div 
      className={`flex items-start ${compact ? 'p-2' : 'p-3'} bg-blue-50 border border-blue-200 rounded-md`}
    >
      <div className="flex-shrink-0">
        <svg 
          className="w-5 h-5 text-blue-400 mt-0.5" 
          fill="currentColor" 
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path 
            fillRule="evenodd" 
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
            clipRule="evenodd" 
          />
        </svg>
      </div>
      <div className="ml-3 flex-1">
        <p className={`font-medium text-blue-800 ${compact ? 'text-sm' : 'text-sm'}`}>
          {suggestion.message}
        </p>
        {!compact && suggestion.action && (
          <p className="text-sm text-blue-700 mt-1">
            💡 {suggestion.action}
          </p>
        )}
      </div>
    </div>
  );
};

// Summary component for step-level validation
interface ValidationSummaryProps {
  validation: ValidationResult;
  title?: string;
  className?: string;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  validation,
  title = "Validation Summary",
  className = '',
}) => {
  const errorCount = validation.errors.filter(e => e.severity === 'error').length;
  const warningCount = validation.errors.filter(e => e.severity === 'warning').length + validation.warnings.length;
  const suggestionCount = validation.suggestions.length;

  if (errorCount === 0 && warningCount === 0 && suggestionCount === 0) {
    return (
      <div className={`p-4 bg-green-50 border border-green-200 rounded-lg ${className}`}>
        <div className="flex items-center">
          <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-green-800">All validations passed</h3>
            <p className="text-sm text-green-700">You can proceed to the next step</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        {/* Errors */}
        <div className="flex items-center">
          <div className={`w-4 h-4 rounded-full mr-2 ${errorCount > 0 ? 'bg-red-400' : 'bg-gray-300'}`} />
          <span className={errorCount > 0 ? 'text-red-700 font-medium' : 'text-gray-600'}>
            {errorCount} Error{errorCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Warnings */}
        <div className="flex items-center">
          <div className={`w-4 h-4 rounded-full mr-2 ${warningCount > 0 ? 'bg-amber-400' : 'bg-gray-300'}`} />
          <span className={warningCount > 0 ? 'text-amber-700 font-medium' : 'text-gray-600'}>
            {warningCount} Warning{warningCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Suggestions */}
        <div className="flex items-center">
          <div className={`w-4 h-4 rounded-full mr-2 ${suggestionCount > 0 ? 'bg-blue-400' : 'bg-gray-300'}`} />
          <span className={suggestionCount > 0 ? 'text-blue-700 font-medium' : 'text-gray-600'}>
            {suggestionCount} Suggestion{suggestionCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};