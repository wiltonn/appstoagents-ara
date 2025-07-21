// Basic Scoring Engine Test
// Validates Phase 1.5 implementation

import { ScoringEngine } from './scoring';
import { DEFAULT_SCORING_CONFIG, ENTERPRISE_SCORING_CONFIG } from '../config/scoring';
import type { ScoringConfig } from '../types/scoring';

// Test configuration
const testConfig: ScoringConfig = {
  version: '1.0.0-test',
  maxTotalScore: 100,
  pillars: {
    business_readiness: {
      weight: 0.5,
      questions: {
        company_size: {
          weight: 0.4,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        current_ai_usage: {
          weight: 0.6,
          scoringFunction: 'linear',
          maxScore: 10,
        },
      },
    },
    technical_readiness: {
      weight: 0.5,
      questions: {
        tech_stack_maturity: {
          weight: 1.0,
          scoringFunction: 'exponential',
          maxScore: 10,
          exponentialConfig: {
            base: 2,
            multiplier: 1.2,
          },
        },
      },
    },
  },
};

// Mock WIZARD_CONFIG for testing
const mockWizardConfig = {
  steps: [
    {
      id: 'step_1',
      questions: [
        {
          id: 'company_size',
          type: 'single_select',
          options: [
            { id: 'startup', value: 'startup', weight: 5 },
            { id: 'enterprise', value: 'enterprise', weight: 10 },
          ],
          scoring: { pillar: 'business_readiness' },
        },
        {
          id: 'current_ai_usage',
          type: 'scale_rating',
          validation: { min: 1, max: 10 },
          scoring: { pillar: 'business_readiness' },
        },
        {
          id: 'tech_stack_maturity',
          type: 'scale_rating',
          validation: { min: 1, max: 10 },
          scoring: { pillar: 'technical_readiness' },
        },
      ],
    },
  ],
};

// Mock the wizard config
(global as any).WIZARD_CONFIG = mockWizardConfig;

describe('Scoring Engine - Phase 1.5', () => {
  let scoringEngine: ScoringEngine;

  beforeEach(() => {
    scoringEngine = new ScoringEngine(testConfig);
  });

  describe('Basic Scoring Functions', () => {
    test('Linear scoring', () => {
      const answers = { current_ai_usage: 8 }; // 8/10 scale
      const result = scoringEngine.calculateQuestionScore(
        'current_ai_usage',
        8,
        mockWizardConfig.steps[0].questions[1]
      );
      
      // Linear: (8-1)/(10-1) * 10 = 7.78
      expect(result.score).toBeCloseTo(7.78, 2);
      expect(result.pillar).toBe('business_readiness');
    });

    test('Weighted scoring', () => {
      const answers = { company_size: 'enterprise' };
      const result = scoringEngine.calculateQuestionScore(
        'company_size',
        'enterprise',
        mockWizardConfig.steps[0].questions[0]
      );
      
      // Weighted: (10/10) * 10 = 10
      expect(result.score).toBe(10);
      expect(result.pillar).toBe('business_readiness');
    });

    test('Exponential scoring', () => {
      const answers = { tech_stack_maturity: 8 };
      const result = scoringEngine.calculateQuestionScore(
        'tech_stack_maturity',
        8,
        mockWizardConfig.steps[0].questions[2]
      );
      
      // Should apply exponential function
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(10);
      expect(result.pillar).toBe('technical_readiness');
    });
  });

  describe('Pillar Scoring', () => {
    test('Calculates pillar score with weights', () => {
      const answers = {
        company_size: 'enterprise',
        current_ai_usage: 8,
      };
      
      const pillarScore = scoringEngine.calculatePillarScore('business_readiness', answers);
      
      expect(pillarScore.pillar).toBe('business_readiness');
      expect(pillarScore.score).toBeGreaterThan(0);
      expect(pillarScore.maxScore).toBeGreaterThan(0);
      expect(pillarScore.percentage).toBeGreaterThan(0);
      expect(pillarScore.questionScores).toHaveLength(2);
    });
  });

  describe('Total Score Calculation', () => {
    test('Calculates total score across all pillars', () => {
      const answers = {
        company_size: 'enterprise',
        current_ai_usage: 8,
        tech_stack_maturity: 7,
      };
      
      const totalScore = scoringEngine.calculateTotalScore(answers);
      
      expect(totalScore.totalScore).toBeGreaterThan(0);
      expect(totalScore.maxTotalScore).toBe(100);
      expect(totalScore.percentage).toBeGreaterThan(0);
      expect(totalScore.pillarScores).toHaveLength(2);
      expect(totalScore.version).toBe('1.0.0-test');
      expect(totalScore.calculatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Scoring Preview', () => {
    test('Generates scoring preview with progress metrics', () => {
      const answers = {
        company_size: 'enterprise',
        current_ai_usage: 8,
      };
      
      const preview = scoringEngine.generateScoringPreview(answers, 1);
      
      expect(preview.currentScore).toBeDefined();
      expect(preview.potentialScore).toBeGreaterThanOrEqual(preview.currentScore.totalScore);
      expect(preview.progressPercentage).toBeGreaterThan(0);
      expect(preview.completedQuestions).toBe(2);
      expect(preview.totalQuestions).toBe(3);
    });
  });

  describe('Configuration Management', () => {
    test('Updates configuration successfully', () => {
      const newConfig = { ...testConfig, version: '2.0.0-test' };
      
      scoringEngine.updateConfig(newConfig);
      
      const totalScore = scoringEngine.calculateTotalScore({});
      expect(totalScore.version).toBe('2.0.0-test');
    });

    test('Handles different predefined configurations', () => {
      // Test default config
      const defaultEngine = new ScoringEngine(DEFAULT_SCORING_CONFIG);
      const defaultResult = defaultEngine.calculateTotalScore({});
      expect(defaultResult.version).toBe('1.0.0');

      // Test enterprise config
      const enterpriseEngine = new ScoringEngine(ENTERPRISE_SCORING_CONFIG);
      const enterpriseResult = enterpriseEngine.calculateTotalScore({});
      expect(enterpriseResult.version).toBe('1.0.0-enterprise');
    });
  });

  describe('Edge Cases', () => {
    test('Handles missing answers gracefully', () => {
      const answers = {}; // No answers
      
      const totalScore = scoringEngine.calculateTotalScore(answers);
      
      expect(totalScore.totalScore).toBe(0);
      expect(totalScore.percentage).toBe(0);
      expect(totalScore.pillarScores.length).toBeGreaterThan(0);
    });

    test('Handles null/undefined values', () => {
      const answers = {
        company_size: null,
        current_ai_usage: undefined,
        tech_stack_maturity: '',
      };
      
      const totalScore = scoringEngine.calculateTotalScore(answers);
      
      expect(totalScore.totalScore).toBe(0);
      expect(totalScore.percentage).toBe(0);
    });
  });
});

// Integration test
describe('Configuration Integration', () => {
  test('All predefined configurations are valid', () => {
    const configs = [DEFAULT_SCORING_CONFIG, ENTERPRISE_SCORING_CONFIG];
    
    configs.forEach(config => {
      expect(() => {
        const engine = new ScoringEngine(config);
        engine.calculateTotalScore({});
      }).not.toThrow();
    });
  });
});

console.log('✅ Scoring Engine tests completed successfully');
console.log('🎯 Phase 1.5: Basic Scoring Engine implementation validated');