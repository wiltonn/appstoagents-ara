import React from 'react';
import type { Question } from '../../types/wizard';
import { ConditionalLogicEvaluator } from '../../types/conditionalLogic';
import { SingleSelectDropdown } from './inputs/SingleSelectDropdown';
import { MultiSelectCheckboxes } from './inputs/MultiSelectCheckboxes';
import { ScaleSlider } from './inputs/ScaleSlider';

interface EnhancedQuestionRendererProps {
  question: Question;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  allAnswers?: Record<string, any>;
  className?: string;
  variant?: 'default' | 'compact' | 'enhanced';
}

export const EnhancedQuestionRenderer: React.FC<EnhancedQuestionRendererProps> = ({
  question,
  value,
  onChange,
  error,
  allAnswers = {},
  className = '',
  variant = 'enhanced',
}) => {
  // Check if question should be shown and enabled based on conditional logic
  const shouldShow = question.enhancedConditionalLogic 
    ? ConditionalLogicEvaluator.shouldShowQuestion(question.enhancedConditionalLogic, allAnswers)
    : true;

  const shouldEnable = question.enhancedConditionalLogic
    ? ConditionalLogicEvaluator.shouldEnableQuestion(question.enhancedConditionalLogic, allAnswers)
    : true;

  // Fallback to legacy conditional logic if no enhanced logic is present
  const legacyShow = question.conditionalLogic?.showIf 
    ? (() => {
        const { questionId, value: conditionValue } = question.conditionalLogic.showIf;
        const currentAnswer = allAnswers[questionId];
        
        if (Array.isArray(conditionValue)) {
          return Array.isArray(currentAnswer) 
            ? conditionValue.some(v => currentAnswer.includes(v))
            : conditionValue.includes(currentAnswer);
        }
        
        return currentAnswer === conditionValue;
      })()
    : true;

  const isVisible = shouldShow && legacyShow;
  const isEnabled = shouldEnable;
  const hasError = Boolean(error);

  if (!isVisible) {
    return null;
  }

  const handleInputChange = (newValue: any) => {
    if (isEnabled) {
      onChange(newValue);
    }
  };

  const getInputAriaProps = () => ({
    'aria-describedby': error ? `${question.id}-error` : question.description ? `${question.id}-description` : undefined,
    'aria-invalid': hasError,
    'aria-required': question.required,
  });

  const renderEnhancedInput = () => {
    const commonProps = {
      disabled: !isEnabled,
      error: hasError,
      ...getInputAriaProps(),
    };

    switch (question.type) {
      case 'single_select':
        if (variant === 'enhanced' && question.options && question.options.length > 4) {
          return (
            <SingleSelectDropdown
              options={question.options}
              value={value}
              onChange={handleInputChange}
              placeholder={question.description}
              {...commonProps}
            />
          );
        }
        
        // Fall back to radio buttons for fewer options
        return (
          <div className="space-y-3">
            {question.options?.map((option) => (
              <label 
                key={option.id} 
                className={`
                  flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200
                  ${value === option.value 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-white border-gray-200 hover:border-gray-300'
                  }
                  ${isEnabled ? 'cursor-pointer hover:shadow-sm' : 'cursor-not-allowed opacity-50'}
                  ${hasError && value !== option.value ? 'border-red-200' : ''}
                `}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => handleInputChange(option.value)}
                  disabled={!isEnabled}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  {...getInputAriaProps()}
                />
                <div className="flex-1 min-w-0">
                  <span className={`
                    block font-medium
                    ${value === option.value ? 'text-blue-900' : 'text-gray-900'}
                    ${!isEnabled ? 'text-gray-400' : ''}
                  `}>
                    {option.label}
                  </span>
                  {option.description && (
                    <p className={`
                      text-sm mt-1
                      ${value === option.value ? 'text-blue-700' : 'text-gray-500'}
                      ${!isEnabled ? 'text-gray-400' : ''}
                    `}>
                      {option.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );

      case 'multi_select':
        return (
          <MultiSelectCheckboxes
            options={question.options || []}
            value={Array.isArray(value) ? value : []}
            onChange={handleInputChange}
            searchable={question.options && question.options.length > 6}
            layout={question.options && question.options.length > 6 ? 'grid' : 'list'}
            {...commonProps}
          />
        );

      case 'scale_rating':
        const min = question.validation?.min || 1;
        const max = question.validation?.max || 10;
        const currentValue = value || min;
        
        const scaleLabels = [];
        const tooltips = [];
        
        // Generate descriptive labels based on scale
        if (max - min <= 5) {
          const descriptors = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
          for (let i = 0; i <= max - min; i++) {
            scaleLabels.push(descriptors[i] || `${min + i}`);
          }
        }
        
        // Add contextual tooltips
        for (let i = min; i <= max; i++) {
          if (question.title.toLowerCase().includes('maturity')) {
            const maturityLevels = [
              'Basic/Legacy', 'Developing', 'Defined', 'Managed', 'Optimized'
            ];
            tooltips.push(maturityLevels[i - min] || `Level ${i}`);
          } else if (question.title.toLowerCase().includes('quality')) {
            const qualityLevels = [
              'Needs Improvement', 'Below Average', 'Average', 'Good', 'Excellent'
            ];
            tooltips.push(qualityLevels[i - min] || `Quality ${i}`);
          }
        }

        return (
          <ScaleSlider
            min={min}
            max={max}
            value={currentValue}
            onChange={handleInputChange}
            labels={scaleLabels}
            tooltips={tooltips.length > 0 ? tooltips : undefined}
            disabled={!isEnabled}
            error={hasError}
            showValue={true}
          />
        );

      case 'text_input':
        return (
          <div className="relative">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={question.description}
              disabled={!isEnabled}
              className={`
                w-full px-4 py-3 border rounded-lg shadow-sm transition-colors duration-200
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${hasError 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300'
                }
                ${!isEnabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
              `}
              {...getInputAriaProps()}
            />
            {question.validation?.pattern && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
          </div>
        );

      case 'number_input':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleInputChange(Number(e.target.value))}
            min={question.validation?.min}
            max={question.validation?.max}
            placeholder={question.description}
            disabled={!isEnabled}
            className={`
              w-full px-4 py-3 border rounded-lg shadow-sm transition-colors duration-200
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              ${hasError 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border-gray-300'
              }
              ${!isEnabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
            `}
            {...getInputAriaProps()}
          />
        );

      case 'yes_no':
        return (
          <div className="flex space-x-6">
            {[
              { value: true, label: 'Yes', color: 'green' },
              { value: false, label: 'No', color: 'gray' }
            ].map((option) => (
              <label 
                key={String(option.value)}
                className={`
                  flex items-center space-x-3 p-4 rounded-lg border-2 transition-all duration-200
                  ${value === option.value 
                    ? `border-${option.color}-500 bg-${option.color}-50` 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${isEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                `}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={value === option.value}
                  onChange={() => handleInputChange(option.value)}
                  disabled={!isEnabled}
                  className={`h-4 w-4 text-${option.color}-600 focus:ring-${option.color}-500 border-gray-300`}
                  {...getInputAriaProps()}
                />
                <span className={`font-medium ${
                  value === option.value ? `text-${option.color}-900` : 'text-gray-900'
                }`}>
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        );

      case 'percentage':
        return (
          <div className="space-y-3">
            <div className="relative">
              <input
                type="number"
                value={value || ''}
                onChange={(e) => handleInputChange(Number(e.target.value))}
                min={0}
                max={100}
                placeholder="Enter percentage (0-100)"
                disabled={!isEnabled}
                className={`
                  w-full px-4 py-3 pr-12 border rounded-lg shadow-sm transition-colors duration-200
                  focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${hasError 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-gray-300'
                  }
                  ${!isEnabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
                `}
                {...getInputAriaProps()}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 font-medium">%</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Enter a value between 0 and 100
            </div>
          </div>
        );

      default:
        return (
          <div className="text-red-500 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Unsupported question type: {question.type}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`enhanced-question-renderer ${className}`}>
      {/* Question Header */}
      <div className="mb-6">
        <label className="block text-lg font-semibold text-gray-900 mb-3">
          {question.title}
          {question.required && (
            <span className="text-red-500 ml-1" aria-label="required">*</span>
          )}
          {!isEnabled && (
            <span className="ml-2 text-sm font-normal text-gray-500 italic">
              (Conditional question)
            </span>
          )}
        </label>
        
        {question.description && (
          <p 
            id={`${question.id}-description`}
            className="text-gray-600 leading-relaxed"
          >
            {question.description}
          </p>
        )}
      </div>

      {/* Question Input */}
      <div className="mb-4">
        {renderEnhancedInput()}
      </div>

      {/* Error Message */}
      {error && (
        <div 
          id={`${question.id}-error`}
          className="mt-3 text-sm text-red-600 flex items-start"
          role="alert"
        >
          <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Help Text */}
      {question.validation?.message && !error && (
        <div className="mt-3 text-sm text-gray-500 flex items-start">
          <svg className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>{question.validation.message}</span>
        </div>
      )}
    </div>
  );
};