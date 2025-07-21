import React, { useState, useEffect, useMemo } from 'react';
import type { WizardStep as WizardStepType, Question } from '../../types/wizard';
import { QuestionRenderer } from './QuestionRenderer';
import { EnhancedQuestionRenderer } from './EnhancedQuestionRenderer';
import { WizardValidator } from '../../lib/validation';
import { ConditionalLogicEvaluator } from '../../types/conditionalLogic';

interface WizardStepProps {
  step: WizardStepType;
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  errors?: Record<string, string>;
  className?: string;
  variant?: 'default' | 'enhanced';
  showValidationSummary?: boolean;
}

export const WizardStep: React.FC<WizardStepProps> = ({
  step,
  answers,
  onAnswerChange,
  errors = {},
  className = '',
  variant = 'enhanced',
  showValidationSummary = true,
}) => {
  const [validationResults, setValidationResults] = useState<Record<string, any>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  
  const shouldShowQuestion = useMemo(
    () => (question: Question): boolean => {
      // Use enhanced conditional logic if available
      if (question.enhancedConditionalLogic) {
        return ConditionalLogicEvaluator.shouldShowQuestion(question.enhancedConditionalLogic, answers);
      }
      
      // Fall back to legacy conditional logic
      if (!question.conditionalLogic?.showIf) return true;
      
      const { questionId, value } = question.conditionalLogic.showIf;
      const currentAnswer = answers[questionId];
      
      // Handle different comparison types
      if (Array.isArray(value)) {
        return Array.isArray(currentAnswer) 
          ? value.some(v => currentAnswer.includes(v))
          : value.includes(currentAnswer);
      }
      
      return currentAnswer === value;
    },
    [answers] // Only recreate when answers change
  );

  const visibleQuestions = useMemo(
    () => step.questions.filter(shouldShowQuestion),
    [step.questions, shouldShowQuestion] // Only recompute when questions or shouldShowQuestion changes
  );

  // Real-time validation
  useEffect(() => {
    if (variant === 'enhanced') {
      const results = WizardValidator.validateStep(visibleQuestions, answers);
      setValidationResults(results);
      
      // Extract warnings
      const newWarnings: Record<string, string> = {};
      Object.entries(results).forEach(([questionId, result]) => {
        if (result.warning) {
          newWarnings[questionId] = result.warning;
        }
      });
      setWarnings(newWarnings);
    }
  }, [answers, visibleQuestions, variant]);

  const handleAnswerChange = (questionId: string, value: any) => {
    onAnswerChange(questionId, value);
    
    // Real-time validation for the specific question
    if (variant === 'enhanced') {
      const question = visibleQuestions.find(q => q.id === questionId);
      if (question) {
        const result = WizardValidator.validateOnChange(question, value, answers);
        setValidationResults(prev => ({
          ...prev,
          [questionId]: result
        }));
      }
    }
  };
  
  // Calculate validation summary
  const errorCount = variant === 'enhanced' ? WizardValidator.getErrorCount(validationResults) : 0;
  const warningCount = variant === 'enhanced' ? WizardValidator.getWarningCount(validationResults) : 0;
  const answeredCount = Object.keys(answers).filter(key => 
    visibleQuestions.some(q => q.id === key && answers[key] !== undefined && answers[key] !== null && answers[key] !== '')
  ).length;

  return (
    <div className={`wizard-step ${className}`}>
      {/* Step Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {step.title}
        </h2>
        {step.description && (
          <p className="text-gray-600 text-lg">
            {step.description}
          </p>
        )}
        {step.estimatedTimeMinutes && (
          <div className="flex items-center mt-2 text-sm text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Estimated time: {step.estimatedTimeMinutes} minutes
          </div>
        )}
      </div>

      {/* Validation Summary */}
      {variant === 'enhanced' && showValidationSummary && (errorCount > 0 || warningCount > 0) && (
        <div className="mb-6 space-y-3">
          {errorCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 font-medium">
                  {errorCount} validation {errorCount === 1 ? 'error' : 'errors'} found
                </span>
              </div>
              <p className="text-red-700 text-sm mt-1">
                Please review and correct the highlighted fields before continuing.
              </p>
            </div>
          )}
          
          {warningCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-amber-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-amber-800 font-medium">
                  {warningCount} {warningCount === 1 ? 'suggestion' : 'suggestions'} available
                </span>
              </div>
              <p className="text-amber-700 text-sm mt-1">
                Review the suggestions below to optimize your audit results.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-8">
        {visibleQuestions.map((question) => {
          const validationResult = validationResults[question.id];
          const effectiveError = errors[question.id] || (validationResult && !validationResult.isValid ? validationResult.error : undefined);
          
          return (
            <div key={question.id} className="question-container">
              {variant === 'enhanced' ? (
                <EnhancedQuestionRenderer
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => handleAnswerChange(question.id, value)}
                  error={effectiveError}
                  allAnswers={answers}
                  variant="enhanced"
                />
              ) : (
                <QuestionRenderer
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => handleAnswerChange(question.id, value)}
                  error={effectiveError}
                />
              )}
              
              {/* Warning message */}
              {variant === 'enhanced' && warnings[question.id] && !effectiveError && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-amber-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-amber-800 text-sm font-medium">Suggestion</p>
                      <p className="text-amber-700 text-sm mt-1">{warnings[question.id]}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress indicator for current step */}
      <div className="mt-8 flex items-center justify-between text-sm text-gray-500">
        <span>
          {answeredCount} of {visibleQuestions.length} questions answered
        </span>
        
        {variant === 'enhanced' && (
          <div className="flex items-center space-x-4">
            {errorCount > 0 && (
              <span className="text-red-600 flex items-center">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </span>
            )}
            
            {warningCount > 0 && errorCount === 0 && (
              <span className="text-amber-600 flex items-center">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {warningCount} suggestion{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            
            {errorCount === 0 && warningCount === 0 && answeredCount === visibleQuestions.length && (
              <span className="text-green-600 flex items-center">
                <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                All valid
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};