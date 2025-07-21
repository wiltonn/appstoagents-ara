// Wizard Question Types and Schema
// Based on ARA System Design specifications

export type QuestionType = 
  | 'single_select'
  | 'multi_select' 
  | 'text_input'
  | 'number_input'
  | 'scale_rating'
  | 'yes_no'
  | 'percentage'
  | 'checkbox_grid';

export interface QuestionOption {
  id: string;
  label: string;
  value: string | number;
  description?: string;
  weight?: number; // For scoring
}

export interface Question {
  id: string;
  stepId: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: QuestionOption[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  scoring?: {
    pillar: string;
    weight: number;
    scoringFunction: 'linear' | 'threshold' | 'weighted';
  };
  conditionalLogic?: {
    showIf?: {
      questionId: string;
      value: any;
    };
  };
  enhancedConditionalLogic?: import('./conditionalLogic').EnhancedConditionalLogic;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  order: number;
  isOptional?: boolean;
  estimatedTimeMinutes?: number;
  conditionalLogic?: import('./conditionalLogic').StepConditionalLogic;
}

export interface WizardAnswer {
  questionId: string;
  value: any;
  timestamp: Date;
}

export interface WizardProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  answers: Record<string, any>;
  sessionId: string;
  userId?: string;
  startedAt: Date;
  lastUpdated: Date;
  status: 'draft' | 'in_progress' | 'completed' | 'abandoned';
}

export interface WizardConfig {
  steps: WizardStep[];
  metadata: {
    title: string;
    description: string;
    version: string;
    estimatedTimeMinutes: number;
  };
}

// Scoring pillars based on ARA design
export const SCORING_PILLARS = {
  TECHNICAL_READINESS: 'technical_readiness',
  OPERATIONAL_READINESS: 'operational_readiness', 
  BUSINESS_READINESS: 'business_readiness',
  SECURITY_READINESS: 'security_readiness',
} as const;

export type ScoringPillar = typeof SCORING_PILLARS[keyof typeof SCORING_PILLARS];