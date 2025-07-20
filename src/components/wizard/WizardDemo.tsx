import React from 'react';
import { WizardIsland } from '../islands/WizardIsland';

/**
 * Demo component to showcase the Wizard functionality
 * This can be used for testing and development purposes
 */
export const WizardDemo: React.FC = () => {
  const handleComplete = (answers: Record<string, any>, sessionId: string) => {
    console.log('Wizard completed successfully!', {
      sessionId,
      totalAnswers: Object.keys(answers).length,
      answers: answers
    });
    
    alert(`Wizard completed!\nSession: ${sessionId}\nAnswers: ${Object.keys(answers).length}`);
  };

  return (
    <div className="wizard-demo-container">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Agent Readiness Audit - Demo
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          This is a demonstration of the Core Wizard Component implementing Task 1.4 
          from the ARA Implementation Plan. The wizard includes multi-step navigation, 
          form validation, auto-save functionality, and progress tracking.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <WizardIsland 
          onComplete={handleComplete}
          className="p-6"
        />
      </div>

      <div className="mt-8 text-sm text-gray-500 text-center">
        <p>Features implemented:</p>
        <ul className="mt-2 space-y-1">
          <li>✅ React island-based wizard component</li>
          <li>✅ Zustand state management for wizard flow</li>
          <li>✅ Step navigation with progress tracking</li>
          <li>✅ Form validation and error handling</li>
          <li>✅ Auto-save functionality with optimistic updates</li>
          <li>✅ Responsive design with mobile support</li>
          <li>✅ TypeScript support with strict types</li>
        </ul>
      </div>
    </div>
  );
};