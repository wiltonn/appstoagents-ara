// Scoring System Types and Interfaces
// Implementation of Task 1.5: Basic Scoring Engine

export type ScoringFunction = 'linear' | 'exponential' | 'threshold' | 'weighted';

export interface ThresholdConfig {
  thresholds: Array<{
    min: number;
    max: number;
    score: number;
  }>;
}

export interface ExponentialConfig {
  base: number;
  multiplier: number;
  offset?: number;
}

export interface QuestionScoringConfig {
  weight: number;
  scoringFunction: ScoringFunction;
  maxScore: number;
  thresholdConfig?: ThresholdConfig;
  exponentialConfig?: ExponentialConfig;
}

export interface PillarScoringConfig {
  weight: number;
  questions: {
    [questionKey: string]: QuestionScoringConfig;
  };
}

export interface ScoringConfig {
  pillars: {
    [pillarName: string]: PillarScoringConfig;
  };
  maxTotalScore: number;
  version: string;
}

export interface ScoreResult {
  questionId: string;
  rawValue: any;
  normalizedValue: number;
  score: number;
  maxScore: number;
  pillar: string;
}

export interface PillarScore {
  pillar: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionScores: ScoreResult[];
}

export interface TotalScore {
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  pillarScores: PillarScore[];
  calculatedAt: Date;
  version: string;
}

export interface ScoringPreview {
  currentScore: TotalScore;
  potentialScore: number;
  progressPercentage: number;
  completedQuestions: number;
  totalQuestions: number;
  missingCriticalQuestions: string[];
}