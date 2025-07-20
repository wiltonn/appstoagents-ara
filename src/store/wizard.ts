import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { WizardProgress, WizardAnswer, WizardStep } from '../types/wizard';
import { WIZARD_CONFIG } from '../config/wizard';

interface WizardState {
  // Current wizard state
  currentStep: number;
  totalSteps: number;
  answers: Record<string, any>;
  sessionId?: string;
  isLoading: boolean;
  error?: string;
  
  // Computed values
  progress: number;
  completedSteps: string[];
  currentStepData?: WizardStep;
  
  // Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  setAnswer: (questionId: string, value: any) => void;
  setAnswers: (answers: Record<string, any>) => void;
  setSessionId: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  reset: () => void;
  loadProgress: (progress: WizardProgress) => void;
  
  // Validation
  isStepValid: (stepId?: string) => boolean;
  getStepProgress: (stepId: string) => number;
  
  // Internal methods
  updateComputedValues: () => void;
}

const initialState = {
  currentStep: 1,
  totalSteps: WIZARD_CONFIG.steps.length,
  answers: {},
  isLoading: false,
  error: undefined,
  progress: 0,
  completedSteps: [],
  currentStepData: WIZARD_CONFIG.steps[0],
};

export const useWizardStore = create<WizardState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    setCurrentStep: (step: number) => {
      const clampedStep = Math.max(1, Math.min(step, get().totalSteps));
      const stepData = WIZARD_CONFIG.steps.find(s => s.order === clampedStep);
      
      set({ 
        currentStep: clampedStep,
        currentStepData: stepData,
        error: undefined,
      });
    },
    
    nextStep: () => {
      const { currentStep, totalSteps } = get();
      if (currentStep < totalSteps) {
        get().setCurrentStep(currentStep + 1);
      }
    },
    
    previousStep: () => {
      const { currentStep } = get();
      if (currentStep > 1) {
        get().setCurrentStep(currentStep - 1);
      }
    },
    
    setAnswer: (questionId: string, value: any) => {
      set(state => ({
        answers: {
          ...state.answers,
          [questionId]: value,
        },
        error: undefined,
      }));
      
      // Update computed values
      get().updateComputedValues();
    },
    
    setAnswers: (answers: Record<string, any>) => {
      set({ answers, error: undefined });
      get().updateComputedValues();
    },
    
    setSessionId: (sessionId: string) => {
      set({ sessionId });
    },
    
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },
    
    setError: (error?: string) => {
      set({ error });
    },
    
    reset: () => {
      set({
        ...initialState,
        currentStepData: WIZARD_CONFIG.steps[0],
      });
    },
    
    loadProgress: (progress: WizardProgress) => {
      const stepData = WIZARD_CONFIG.steps.find(s => s.order === progress.currentStep);
      
      set({
        currentStep: progress.currentStep,
        answers: progress.answers,
        sessionId: progress.sessionId,
        completedSteps: progress.completedSteps,
        currentStepData: stepData,
        error: undefined,
      });
      
      get().updateComputedValues();
    },
    
    isStepValid: (stepId?: string) => {
      const { currentStepData, answers } = get();
      const targetStep = stepId 
        ? WIZARD_CONFIG.steps.find(s => s.id === stepId)
        : currentStepData;
      
      if (!targetStep) return false;
      
      // Check if all required questions in the step are answered
      return targetStep.questions.every(question => {
        if (!question.required) return true;
        
        const answer = answers[question.id];
        if (answer === undefined || answer === null || answer === '') {
          return false;
        }
        
        // For multi-select, check if at least one option is selected
        if (question.type === 'multi_select' && Array.isArray(answer)) {
          return answer.length > 0;
        }
        
        return true;
      });
    },
    
    getStepProgress: (stepId: string) => {
      const { answers } = get();
      const step = WIZARD_CONFIG.steps.find(s => s.id === stepId);
      
      if (!step) return 0;
      
      const totalQuestions = step.questions.length;
      const answeredQuestions = step.questions.filter(q => {
        const answer = answers[q.id];
        return answer !== undefined && answer !== null && answer !== '';
      }).length;
      
      return totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
    },
    
    // Internal method to update computed values
    updateComputedValues: () => {
      const { currentStep, totalSteps, answers } = get();
      
      // Calculate overall progress
      const answeredQuestions = Object.keys(answers).length;
      const totalQuestions = WIZARD_CONFIG.steps.reduce(
        (total, step) => total + step.questions.length, 
        0
      );
      const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;
      
      // Calculate completed steps
      const completedSteps = WIZARD_CONFIG.steps
        .filter(step => get().isStepValid(step.id))
        .map(step => step.id);
      
      set({ 
        progress,
        completedSteps,
      });
    },
  }))
);

// Selector hooks for optimized re-renders
export const useCurrentStep = () => useWizardStore(state => state.currentStep);
export const useCurrentStepData = () => useWizardStore(state => state.currentStepData);
export const useWizardProgress = () => useWizardStore(state => state.progress);
export const useWizardAnswers = () => useWizardStore(state => state.answers);
export const useWizardLoading = () => useWizardStore(state => state.isLoading);
export const useWizardError = () => useWizardStore(state => state.error);