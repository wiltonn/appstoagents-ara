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
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className={`step-navigation ${className}`}>
      <div className="flex justify-between items-center">
        {/* Previous Button */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoPrevious || isLoading}
          className={`
            flex items-center px-4 py-2 text-sm font-medium rounded-md
            transition-colors duration-200
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
            flex items-center px-6 py-2 text-sm font-medium rounded-md
            transition-colors duration-200
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

      {/* Step Information */}
      <div className="mt-4 text-center">
        <div className="text-xs text-gray-500">
          {isLastStep 
            ? 'Review your answers and complete the audit'
            : `Step ${currentStep} of ${totalSteps} - Continue when ready`
          }
        </div>
      </div>
    </div>
  );
};