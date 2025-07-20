import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  stepTitles?: string[];
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  completedSteps,
  stepTitles = [],
  className = '',
}) => {
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' => {
    if (stepIndex < currentStep - 1) return 'completed';
    if (stepIndex === currentStep - 1) return 'current';
    return 'upcoming';
  };

  const getStepClass = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-blue-600 text-white border-blue-600';
      case 'current':
        return 'bg-blue-100 text-blue-600 border-blue-600';
      case 'upcoming':
        return 'bg-gray-100 text-gray-400 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-400 border-gray-300';
    }
  };

  return (
    <div className={`progress-bar ${className}`}>
      {/* Progress Bar Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(progressPercentage)}% Complete
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Step Indicators (Desktop) */}
      <div className="hidden md:block">
        <div className="flex justify-between items-center">
          {Array.from({ length: totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const status = getStepStatus(index);
            const title = stepTitles[index] || `Step ${stepNumber}`;

            return (
              <div key={stepNumber} className="flex flex-col items-center">
                {/* Step Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full border-2 flex items-center justify-center
                    font-semibold text-sm transition-all duration-200
                    ${getStepClass(status)}
                  `}
                >
                  {status === 'completed' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Step Title */}
                <div className="mt-2 text-center">
                  <div className={`text-xs font-medium ${
                    status === 'completed' ? 'text-blue-600' : 
                    status === 'current' ? 'text-blue-600' : 
                    'text-gray-500'
                  }`}>
                    {title}
                  </div>
                </div>

                {/* Connector Line */}
                {index < totalSteps - 1 && (
                  <div className="absolute top-5 left-1/2 w-full h-0.5 bg-gray-200 -z-10">
                    <div
                      className={`h-full transition-all duration-300 ${
                        index < currentStep - 1 ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      style={{ width: index < currentStep - 1 ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Indicators (Mobile) */}
      <div className="md:hidden">
        <div className="flex justify-center space-x-2">
          {Array.from({ length: totalSteps }, (_, index) => {
            const status = getStepStatus(index);
            return (
              <div
                key={index}
                className={`
                  w-3 h-3 rounded-full transition-all duration-200
                  ${status === 'completed' ? 'bg-blue-600' : 
                    status === 'current' ? 'bg-blue-400' : 
                    'bg-gray-300'}
                `}
              />
            );
          })}
        </div>
        
        {/* Current Step Title (Mobile) */}
        <div className="text-center mt-3">
          <div className="text-sm font-medium text-gray-700">
            {stepTitles[currentStep - 1] || `Step ${currentStep}`}
          </div>
        </div>
      </div>
    </div>
  );
};