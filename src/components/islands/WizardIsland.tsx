import React, { useEffect, useCallback, useState } from 'react';
import { useWizardStore } from '../../store/wizard';
import { WIZARD_CONFIG } from '../../config/wizard';
import { WizardStep } from '../wizard/WizardStep';
import { ProgressBar } from '../wizard/ProgressBar';
import { StepNavigation } from '../wizard/StepNavigation';
import { ScorePreview } from '../wizard/ScorePreview';
import { ChatInterface } from '../chat/ChatInterface';
import type { ChatContext } from '../../types/chat';

interface WizardIslandProps {
  sessionId?: string;
  userId?: string;
  onComplete?: (answers: Record<string, any>, sessionId: string) => void;
  className?: string;
  showChat?: boolean;
  chatVariant?: 'sidebar' | 'modal' | 'embedded';
}

export const WizardIsland: React.FC<WizardIslandProps> = ({
  sessionId,
  userId,
  onComplete,
  className = '',
  showChat = true,
  chatVariant = 'sidebar',
}) => {
  const {
    currentStep,
    totalSteps,
    answers,
    isLoading,
    error,
    progress,
    completedSteps,
    currentStepData,
    currentScore,
    scoringPreview,
    showScorePreview,
    setCurrentStep,
    nextStep,
    previousStep,
    setAnswer,
    setSessionId,
    setLoading,
    setError,
    isStepValid,
    toggleScorePreview,
    recalculateScore,
  } = useWizardStore();

  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [chatContext, setChatContext] = useState<ChatContext | null>(null);

  // Update chat context helper - moved before useEffect
  const updateChatContext = useCallback(() => {
    if (!currentStepData) return;

    const context: ChatContext = {
      currentStep,
      totalSteps,
      stepTitle: currentStepData.title,
      stepDescription: currentStepData.description,
      currentAnswers: answers,
      completedSteps: completedSteps.map(step => parseInt(step.replace('step_', ''))),
      pillarScores: currentScore?.pillarScores.reduce((acc, pillar) => {
        acc[pillar.pillar] = pillar.percentage;
        return acc;
      }, {} as Record<string, number>),
      overallProgress: progress,
    };

    setChatContext(context);
  }, [currentStep, totalSteps, currentStepData, answers, completedSteps, currentScore, progress]);

  // Initialize session
  useEffect(() => {
    if (sessionId) {
      setSessionId(sessionId);
      // Load existing progress if available
      loadExistingProgress(sessionId);
    } else {
      // Generate new session ID
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
    }
  }, [sessionId, setSessionId]);

  // Initial score calculation and chat context setup
  useEffect(() => {
    const initializeScoring = async () => {
      await recalculateScore();
      updateChatContext();
    };
    
    initializeScoring();
  }, [recalculateScore, updateChatContext]);

  // Update chat context when wizard state changes
  useEffect(() => {
    updateChatContext();
  }, [updateChatContext]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Set new timeout for auto-save (30 seconds after last change)
    const timeout = setTimeout(() => {
      handleAutoSave();
    }, 30000);

    setAutoSaveTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [answers]);

  const generateSessionId = (): string => {
    return `wizard_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  const loadExistingProgress = async (_sessionId: string) => {
    try {
      setLoading(true);
      // TODO: Implement API call to load existing progress
      // For now, we'll just clear any existing errors
      setError(undefined);
    } catch (err) {
      console.error('Error loading wizard progress:', err);
      setError('Failed to load existing progress');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSave = useCallback(async () => {
    try {
      // TODO: Implement API call to save progress
      // For now, we'll just simulate the save and update last saved time
      await new Promise(resolve => setTimeout(resolve, 100));
      setLastSaved(new Date());
      setError(undefined);
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Don't show error for auto-save failures to avoid disrupting user flow
    }
  }, [answers, currentStep, setError]);

  const handleManualSave = async () => {
    try {
      setLoading(true);
      await handleAutoSave();
    } finally {
      setLoading(false);
    }
  };

  const validateCurrentStep = (): boolean => {
    if (!currentStepData) return false;

    const errors: Record<string, string> = {};
    
    currentStepData.questions.forEach(question => {
      if (question.required) {
        const answer = answers[question.id];
        
        if (answer === undefined || answer === null || answer === '') {
          errors[question.id] = 'This field is required';
        } else if (question.type === 'multi_select' && Array.isArray(answer) && answer.length === 0) {
          errors[question.id] = 'Please select at least one option';
        } else if (question.validation) {
          // Custom validation
          const { min, max, pattern } = question.validation;
          
          if (typeof answer === 'number') {
            if (min !== undefined && answer < min) {
              errors[question.id] = `Value must be at least ${min}`;
            } else if (max !== undefined && answer > max) {
              errors[question.id] = `Value must be at most ${max}`;
            }
          }
          
          if (typeof answer === 'string' && pattern) {
            const regex = new RegExp(pattern);
            if (!regex.test(answer)) {
              errors[question.id] = question.validation.message || 'Invalid format';
            }
          }
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswer(questionId, value);
    
    // Clear validation error for this question
    if (validationErrors[questionId]) {
      const newErrors = { ...validationErrors };
      delete newErrors[questionId];
      setValidationErrors(newErrors);
    }
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    try {
      setLoading(true);
      
      if (currentStep === totalSteps) {
        // Complete the wizard
        await handleComplete();
      } else {
        // Save current progress and move to next step
        await handleAutoSave();
        nextStep();
      }
    } catch (err) {
      console.error('Error proceeding to next step:', err);
      setError('Failed to proceed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      previousStep();
      setValidationErrors({});
    }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      
      // Final validation
      let allValid = true;
      for (const step of WIZARD_CONFIG.steps) {
        if (!isStepValid(step.id)) {
          allValid = false;
          break;
        }
      }
      
      if (!allValid) {
        setError('Please complete all required fields before submitting');
        return;
      }

      // TODO: Implement API call to submit final answers
      const finalSessionId = useWizardStore.getState().sessionId || generateSessionId();
      
      if (onComplete) {
        onComplete(answers, finalSessionId);
      }
      
      setError(undefined);
    } catch (err) {
      console.error('Error completing wizard:', err);
      setError('Failed to complete audit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = WIZARD_CONFIG.steps.map(step => step.title);

  // Handle chat context updates from chat interface
  const handleChatContextUpdate = useCallback((newContext: ChatContext) => {
    // If chat wants to navigate to a different step
    if (newContext.currentStep !== currentStep && newContext.currentStep >= 1 && newContext.currentStep <= totalSteps) {
      setCurrentStep(newContext.currentStep);
    }
  }, [currentStep, totalSteps, setCurrentStep]);

  const wizardContent = (
    <div className={`wizard-content ${showChat && chatVariant === 'sidebar' ? 'pr-8' : ''}`}>
      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {error}
              </h3>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-8">
        <ProgressBar
          currentStep={currentStep}
          totalSteps={totalSteps}
          completedSteps={completedSteps}
          stepTitles={stepTitles}
        />
      </div>

      {/* Score Preview */}
      <div className="mb-8">
        <ScorePreview
          score={currentScore}
          preview={scoringPreview}
          isVisible={showScorePreview}
          onToggle={toggleScorePreview}
        />
      </div>

      {/* Current Step */}
      {currentStepData && (
        <div className="mb-8">
          <WizardStep
            step={currentStepData}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            errors={validationErrors}
            variant="enhanced"
            showValidationSummary={true}
          />
        </div>
      )}

      {/* Step Navigation */}
      <div className="border-t border-gray-200 pt-6">
        <StepNavigation
          currentStep={currentStep}
          totalSteps={totalSteps}
          canGoNext={isStepValid()}
          canGoPrevious={currentStep > 1}
          isLoading={isLoading}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSave={handleManualSave}
          showSaveButton={true}
        />
      </div>

      {/* Auto-save Status */}
      {lastSaved && (
        <div className="mt-4 text-center text-xs text-gray-500">
          Last saved: {lastSaved.toLocaleTimeString()}
        </div>
      )}

      {/* Debug Info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded-md text-xs text-gray-600">
          <div>Current Step: {currentStep}/{totalSteps}</div>
          <div>Progress: {Math.round(progress)}%</div>
          <div>Answers: {Object.keys(answers).length}</div>
          <div>Session ID: {useWizardStore.getState().sessionId}</div>
          <div>Step Valid: {isStepValid() ? 'Yes' : 'No'}</div>
          <div>Chat Context: {chatContext ? 'Active' : 'None'}</div>
          {Object.keys(validationErrors).length > 0 && (
            <div className="mt-2">
              <div>Validation Errors:</div>
              <pre className="text-xs">{JSON.stringify(validationErrors, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render with or without chat based on configuration
  if (!showChat) {
    return (
      <div className={`wizard-island max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
        {wizardContent}
      </div>
    );
  }

  if (chatVariant === 'sidebar') {
    return (
      <div className={`wizard-island-with-chat flex max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
        {/* Main wizard content */}
        <div className="flex-1 min-w-0">
          <div className="max-w-4xl">
            {wizardContent}
          </div>
        </div>
        
        {/* Chat sidebar */}
        <div className="flex-shrink-0 ml-8">
          <div className="sticky top-8">
            <ChatInterface
              sessionId={useWizardStore.getState().sessionId || 'unknown'}
              context={chatContext || undefined}
              onContextUpdate={handleChatContextUpdate}
              variant="sidebar"
              className="h-[calc(100vh-4rem)]"
            />
          </div>
        </div>
      </div>
    );
  }

  if (chatVariant === 'modal') {
    return (
      <div className={`wizard-island max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
        {wizardContent}
        
        {/* Chat modal overlay - would typically be controlled by state */}
        <ChatInterface
          sessionId={useWizardStore.getState().sessionId || 'unknown'}
          context={chatContext || undefined}
          onContextUpdate={handleChatContextUpdate}
          variant="modal"
        />
      </div>
    );
  }

  // Embedded variant
  return (
    <div className={`wizard-island max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {wizardContent}
      
      {/* Embedded chat */}
      <div className="mt-8 border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
        <ChatInterface
          sessionId={useWizardStore.getState().sessionId || 'unknown'}
          context={chatContext || undefined}
          onContextUpdate={handleChatContextUpdate}
          variant="embedded"
        />
      </div>
    </div>
  );
};