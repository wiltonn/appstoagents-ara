import React from 'react';

interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isLoading?: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onSave?: () => void;
  className?: string;
  showSaveButton?: boolean;
  // Enhanced navigation props
  blockMessage?: string;
  skipMessage?: string;
  suggestedSteps?: string[];
  conditionalNextStep?: string;
  onSkipStep?: () => void;
  onJumpToStep?: (stepId: string) => void;
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  canGoNext,
  canGoPrevious,
  isLoading = false,
  onNext,
  onPrevious,
  onSave,
  className = '',
  showSaveButton = true,
  // Enhanced navigation props
  blockMessage,
  skipMessage,
  suggestedSteps = [],
  conditionalNextStep,
  onSkipStep,
  onJumpToStep,
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className={`step-navigation ${className}`}>
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0">
        {/* Previous Button */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious || isLoading}
          className={`
            flex items-center justify-center px-4 py-3 sm:py-2 text-sm font-medium rounded-md
            transition-colors duration-200 touch-manipulation
            ${canGoPrevious && !isLoading
              ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
            }
          `}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Previous
        </button>

        {/* Center: Save Button (if enabled) */}
        {showSaveButton && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isLoading}
            className={`
              flex items-center px-4 py-2 text-sm font-medium rounded-md
              transition-colors duration-200
              ${isLoading
                ? 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }
            `}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Save Progress
              </>
            )}
          </button>
        )}

        {/* Next/Complete Button */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isLoading}
          className={`
            flex items-center justify-center px-6 py-3 sm:py-2 text-sm font-medium rounded-md
            transition-colors duration-200 touch-manipulation min-h-[44px] sm:min-h-0
            ${canGoNext && !isLoading
              ? 'text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed'
            }
          `}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isLastStep ? 'Completing...' : 'Loading...'}
            </>
          ) : (
            <>
              {isLastStep ? 'Complete Audit' : 'Next'}
              {!isLastStep && (
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </>
          )}
        </button>
      </div>

      {/* Step Information and Messages */}
      <div className="mt-4 space-y-3">
        {/* Block Message */}
        {blockMessage && !canGoNext && (
          <div className="flex items-start p-3 bg-amber-50 border border-amber-200 rounded-md">
            <svg className="w-5 h-5 text-amber-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800">Cannot proceed</p>
              <p className="text-sm text-amber-700 mt-1">{blockMessage}</p>
            </div>
          </div>
        )}

        {/* Skip Message */}
        {skipMessage && onSkipStep && (
          <div className="flex items-start justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-800">Step can be skipped</p>
                <p className="text-sm text-blue-700 mt-1">{skipMessage}</p>
              </div>
            </div>
            <button
              onClick={onSkipStep}
              className="ml-3 text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
            >
              Skip
            </button>
          </div>
        )}

        {/* Suggested Steps */}
        {suggestedSteps.length > 0 && onJumpToStep && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Suggested steps based on your answers</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedSteps.slice(0, 3).map((stepId) => (
                    <button
                      key={stepId}
                      onClick={() => onJumpToStep(stepId)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Jump to {stepId.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standard Step Information */}
        <div className="text-center">
          <div className="text-xs text-gray-500">
            {isLastStep 
              ? 'Review your answers and complete the audit'
              : conditionalNextStep 
                ? `Step ${currentStep} of ${totalSteps} - Next: ${conditionalNextStep.replace('_', ' ')}`
                : `Step ${currentStep} of ${totalSteps} - Continue when ready`
            }
          </div>
        </div>
      </div>
    </div>
  );
};