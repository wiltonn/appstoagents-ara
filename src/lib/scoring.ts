// Scoring Engine Implementation
// Core scoring calculation logic with multiple scoring functions

import type { 
  ScoringConfig, 
  QuestionScoringConfig, 
  ScoreResult, 
  PillarScore, 
  TotalScore,
  ScoringPreview,
  ScoringFunction 
} from '../types/scoring';
import type { Question } from '../types/wizard';
import { getCurrentScoringConfig } from '../config/scoring';
import { WIZARD_CONFIG } from '../config/wizard';

export class ScoringEngine {
  private config: ScoringConfig;

  constructor(config?: ScoringConfig) {
    this.config = config || getCurrentScoringConfig();
  }

  /**
   * Calculate score for a single question
   */
  public calculateQuestionScore(
    questionId: string,
    value: any,
    question: Question
  ): ScoreResult {
    const pillar = question.scoring?.pillar;
    if (!pillar || !this.config.pillars[pillar]) {
      throw new Error(`Invalid pillar for question ${questionId}`);
    }

    const questionConfig = this.config.pillars[pillar].questions[questionId];
    if (!questionConfig) {
      throw new Error(`No scoring config found for question ${questionId}`);
    }

    const normalizedValue = this.normalizeValue(value, question);
    const score = this.applyScoring(normalizedValue, questionConfig, question, value);

    return {
      questionId,
      rawValue: value,
      normalizedValue,
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      maxScore: questionConfig.maxScore,
      pillar,
    };
  }

  /**
   * Calculate scores for all questions in a pillar
   */
  public calculatePillarScore(
    pillarName: string,
    answers: Record<string, any>
  ): PillarScore {
    const pillarConfig = this.config.pillars[pillarName];
    if (!pillarConfig) {
      throw new Error(`Invalid pillar: ${pillarName}`);
    }

    const questionScores: ScoreResult[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const [questionId, questionConfig] of Object.entries(pillarConfig.questions)) {
      const question = this.findQuestion(questionId);
      if (!question) {
        console.warn(`Question ${questionId} not found in wizard config`);
        continue;
      }

      const answer = answers[questionId];
      if (answer !== undefined && answer !== null && answer !== '') {
        const questionScore = this.calculateQuestionScore(questionId, answer, question);
        questionScores.push(questionScore);
        
        // Apply question weight within pillar
        totalScore += questionScore.score * questionConfig.weight;
        maxScore += questionConfig.maxScore * questionConfig.weight;
      } else {
        // Missing answer - add zero score
        questionScores.push({
          questionId,
          rawValue: null,
          normalizedValue: 0,
          score: 0,
          maxScore: questionConfig.maxScore,
          pillar: pillarName,
        });
        maxScore += questionConfig.maxScore * questionConfig.weight;
      }
    }

    return {
      pillar: pillarName,
      score: Math.round(totalScore * 100) / 100,
      maxScore: Math.round(maxScore * 100) / 100,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0,
      questionScores,
    };
  }

  /**
   * Calculate total score across all pillars
   */
  public calculateTotalScore(answers: Record<string, any>): TotalScore {
    const pillarScores: PillarScore[] = [];
    let totalScore = 0;
    let maxTotalScore = 0;

    for (const [pillarName, pillarConfig] of Object.entries(this.config.pillars)) {
      const pillarScore = this.calculatePillarScore(pillarName, answers);
      pillarScores.push(pillarScore);
      
      // Apply pillar weight to total score
      totalScore += pillarScore.score * pillarConfig.weight;
      maxTotalScore += pillarScore.maxScore * pillarConfig.weight;
    }

    return {
      totalScore: Math.round(totalScore * 100) / 100,
      maxTotalScore: Math.round(maxTotalScore * 100) / 100,
      percentage: maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100 * 100) / 100 : 0,
      pillarScores,
      calculatedAt: new Date(),
      version: this.config.version,
    };
  }

  /**
   * Generate real-time scoring preview
   */
  public generateScoringPreview(
    answers: Record<string, any>,
    currentStep?: number
  ): ScoringPreview {
    const currentScore = this.calculateTotalScore(answers);
    
    // Calculate completion metrics
    const allQuestions = this.getAllQuestions();
    const completedQuestions = Object.keys(answers).length;
    const totalQuestions = allQuestions.length;
    
    // Estimate potential score if all remaining questions are answered optimally
    const potentialScore = this.estimatePotentialScore(answers);
    
    // Find missing critical questions (required questions with high weights)
    const missingCriticalQuestions = this.findMissingCriticalQuestions(answers);

    return {
      currentScore,
      potentialScore,
      progressPercentage: Math.round((completedQuestions / totalQuestions) * 100),
      completedQuestions,
      totalQuestions,
      missingCriticalQuestions,
    };
  }

  /**
   * Apply different scoring functions
   */
  private applyScoring(
    normalizedValue: number,
    config: QuestionScoringConfig,
    question: Question,
    rawValue?: any
  ): number {
    switch (config.scoringFunction) {
      case 'linear':
        return this.linearScoring(normalizedValue, config);
      
      case 'exponential':
        return this.exponentialScoring(normalizedValue, config);
      
      case 'threshold':
        return this.thresholdScoring(normalizedValue, config);
      
      case 'weighted':
        return this.weightedScoring(rawValue || normalizedValue, question, config);
      
      default:
        throw new Error(`Unknown scoring function: ${config.scoringFunction}`);
    }
  }

  /**
   * Linear scoring: direct proportional mapping
   */
  private linearScoring(normalizedValue: number, config: QuestionScoringConfig): number {
    return normalizedValue * config.maxScore;
  }

  /**
   * Exponential scoring: rewards higher values disproportionately
   */
  private exponentialScoring(normalizedValue: number, config: QuestionScoringConfig): number {
    if (!config.exponentialConfig) {
      throw new Error('Exponential config required for exponential scoring');
    }
    
    const { base, multiplier, offset = 0 } = config.exponentialConfig;
    const exponentialValue = Math.pow(normalizedValue * base, multiplier) + offset;
    
    // Normalize to max score
    const maxExponential = Math.pow(base, multiplier) + offset;
    return Math.min((exponentialValue / maxExponential) * config.maxScore, config.maxScore);
  }

  /**
   * Threshold scoring: discrete scoring based on value ranges
   */
  private thresholdScoring(normalizedValue: number, config: QuestionScoringConfig): number {
    if (!config.thresholdConfig?.thresholds) {
      throw new Error('Threshold config required for threshold scoring');
    }

    const thresholds = config.thresholdConfig.thresholds.sort((a, b) => a.min - b.min);
    const scaledValue = normalizedValue * 10; // Scale to 0-10 range
    
    for (const threshold of thresholds) {
      if (scaledValue >= threshold.min && scaledValue <= threshold.max) {
        return threshold.score;
      }
    }
    
    // Default to 0 if no threshold matches
    return 0;
  }

  /**
   * Weighted scoring: uses predefined weights from question options
   */
  private weightedScoring(
    rawValue: any,
    question: Question,
    config: QuestionScoringConfig
  ): number {
    if (question.type === 'multi_select' && Array.isArray(rawValue)) {
      // For multi-select, sum weights of selected options
      const selectedOptions = rawValue as string[];
      const totalWeight = selectedOptions.reduce((sum, optionId) => {
        const option = question.options?.find(opt => opt.id === optionId);
        return sum + (option?.weight || 0);
      }, 0);
      
      // Normalize against maximum possible weight
      const maxWeight = question.options?.reduce((max, opt) => max + (opt.weight || 0), 0) || 1;
      return (totalWeight / maxWeight) * config.maxScore;
    } else {
      // For single select, use the option's weight directly
      const option = question.options?.find(opt => 
        String(opt.value) === String(rawValue) || opt.id === String(rawValue)
      );
      const weight = option?.weight || 0;
      
      // Normalize against maximum weight in options
      const maxWeight = Math.max(...(question.options?.map(opt => opt.weight || 0) || [1]));
      return (weight / maxWeight) * config.maxScore;
    }
  }

  /**
   * Normalize answer values to 0-1 range
   */
  private normalizeValue(value: any, question: Question): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    switch (question.type) {
      case 'scale_rating':
        const min = question.validation?.min || 1;
        const max = question.validation?.max || 10;
        return (Number(value) - min) / (max - min);
      
      case 'single_select':
        return value; // Will be processed by weighted scoring
      
      case 'multi_select':
        return value; // Will be processed by weighted scoring
      
      case 'yes_no':
        return value === 'yes' || value === true ? 1 : 0;
      
      case 'percentage':
        return Number(value) / 100;
      
      case 'number_input':
        // Normalize based on validation range if available
        if (question.validation?.min !== undefined && question.validation?.max !== undefined) {
          const normalized = (Number(value) - question.validation.min) / 
                           (question.validation.max - question.validation.min);
          return Math.max(0, Math.min(1, normalized));
        }
        return Math.max(0, Math.min(1, Number(value) / 100)); // Default 0-100 range
      
      default:
        return 0;
    }
  }

  /**
   * Find question by ID in wizard configuration
   */
  private findQuestion(questionId: string): Question | undefined {
    for (const step of WIZARD_CONFIG.steps) {
      const question = step.questions.find(q => q.id === questionId);
      if (question) return question;
    }
    return undefined;
  }

  /**
   * Get all questions from wizard configuration
   */
  private getAllQuestions(): Question[] {
    return WIZARD_CONFIG.steps.flatMap(step => step.questions);
  }

  /**
   * Estimate potential score if remaining questions answered optimally
   */
  private estimatePotentialScore(answers: Record<string, any>): number {
    const allQuestions = this.getAllQuestions();
    const optimisticAnswers = { ...answers };
    
    // Fill in missing answers with optimal values
    for (const question of allQuestions) {
      if (!(question.id in optimisticAnswers)) {
        optimisticAnswers[question.id] = this.getOptimalAnswer(question);
      }
    }
    
    const optimisticScore = this.calculateTotalScore(optimisticAnswers);
    return optimisticScore.totalScore;
  }

  /**
   * Get optimal answer for a question (for potential score calculation)
   */
  private getOptimalAnswer(question: Question): any {
    switch (question.type) {
      case 'scale_rating':
        return question.validation?.max || 10;
      
      case 'single_select':
        // Find option with highest weight
        const maxWeightOption = question.options?.reduce((max, opt) => 
          (opt.weight || 0) > (max?.weight || 0) ? opt : max
        );
        return maxWeightOption?.value || maxWeightOption?.id;
      
      case 'multi_select':
        // Select all options for maximum score
        return question.options?.map(opt => opt.id) || [];
      
      case 'yes_no':
        return 'yes';
      
      case 'percentage':
        return 100;
      
      default:
        return '';
    }
  }

  /**
   * Find missing questions that are critical for scoring
   */
  private findMissingCriticalQuestions(answers: Record<string, any>): string[] {
    const critical: string[] = [];
    
    for (const [pillarName, pillarConfig] of Object.entries(this.config.pillars)) {
      for (const [questionId, questionConfig] of Object.entries(pillarConfig.questions)) {
        // Consider question critical if it has high weight (>0.3) and is required
        if (questionConfig.weight > 0.3 && !(questionId in answers)) {
          const question = this.findQuestion(questionId);
          if (question?.required) {
            critical.push(questionId);
          }
        }
      }
    }
    
    return critical;
  }

  /**
   * Update scoring configuration (for hot-reload)
   */
  public updateConfig(newConfig: ScoringConfig): void {
    this.config = newConfig;
  }
}

// Export singleton instance
export const scoringEngine = new ScoringEngine();

// Utility functions for easy access
export function calculateScore(answers: Record<string, any>): TotalScore {
  return scoringEngine.calculateTotalScore(answers);
}

export function generatePreview(
  answers: Record<string, any>, 
  currentStep?: number
): ScoringPreview {
  return scoringEngine.generateScoringPreview(answers, currentStep);
}

export function updateScoringEngine(config: ScoringConfig): void {
  scoringEngine.updateConfig(config);
}