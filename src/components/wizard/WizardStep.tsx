import React from 'react';
import type { WizardStep as WizardStepType, Question } from '../../types/wizard';
import { QuestionRenderer } from './QuestionRenderer';

interface WizardStepProps {
  step: WizardStepType;
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  errors?: Record<string, string>;
  className?: string;
}

export const WizardStep: React.FC<WizardStepProps> = ({
  step,
  answers,
  onAnswerChange,
  errors = {},
  className = '',
}) => {
  const handleAnswerChange = (questionId: string, value: any) => {
    onAnswerChange(questionId, value);
  };

  const shouldShowQuestion = (question: Question): boolean => {
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
  };

  const visibleQuestions = step.questions.filter(shouldShowQuestion);

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

      {/* Questions */}
      <div className="space-y-8">
        {visibleQuestions.map((question) => (
          <div key={question.id} className="question-container">
            <QuestionRenderer
              question={question}
              value={answers[question.id]}
              onChange={(value) => handleAnswerChange(question.id, value)}
              error={errors[question.id]}
            />
          </div>
        ))}
      </div>

      {/* Progress indicator for current step */}
      <div className="mt-8 text-sm text-gray-500">
        {visibleQuestions.length > 0 && (
          <span>
            {Object.keys(answers).filter(key => 
              visibleQuestions.some(q => q.id === key && answers[key] !== undefined && answers[key] !== null && answers[key] !== '')
            ).length} of {visibleQuestions.length} questions answered
          </span>
        )}
      </div>
    </div>
  );
};