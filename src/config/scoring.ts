// Scoring Configuration
// Hot-reloadable scoring rules for the ARA system

import type { ScoringConfig } from '../types/scoring';
import { SCORING_PILLARS } from '../types/wizard';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  version: '1.0.0',
  maxTotalScore: 100,
  pillars: {
    [SCORING_PILLARS.BUSINESS_READINESS]: {
      weight: 0.25,
      questions: {
        company_size: {
          weight: 0.2,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        industry: {
          weight: 0.15,
          scoringFunction: 'weighted', 
          maxScore: 10,
        },
        current_ai_usage: {
          weight: 0.3,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
      },
    },
    [SCORING_PILLARS.TECHNICAL_READINESS]: {
      weight: 0.35,
      questions: {
        tech_stack_maturity: {
          weight: 0.3,
          scoringFunction: 'linear',
          maxScore: 10,
        },
        api_architecture: {
          weight: 0.25,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        cloud_infrastructure: {
          weight: 0.2,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        data_infrastructure: {
          weight: 0.25,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        version_control: {
          weight: 0.2,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        testing_practices: {
          weight: 0.15,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        code_quality: {
          weight: 0.15,
          scoringFunction: 'linear',
          maxScore: 10,
        },
      },
    },
    [SCORING_PILLARS.SECURITY_READINESS]: {
      weight: 0.2,
      questions: {
        security_practices: {
          weight: 0.4,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        compliance_requirements: {
          weight: 0.3,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        data_sensitivity: {
          weight: 0.3,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
      },
    },
    [SCORING_PILLARS.OPERATIONAL_READINESS]: {
      weight: 0.2,
      questions: {
        monitoring_capabilities: {
          weight: 0.4,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        deployment_automation: {
          weight: 0.3,
          scoringFunction: 'weighted',
          maxScore: 10,
        },
        incident_response: {
          weight: 0.3,
          scoringFunction: 'linear',
          maxScore: 10,
        },
      },
    },
  },
};

// Advanced scoring configurations for different scenarios
export const ENTERPRISE_SCORING_CONFIG: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  version: '1.0.0-enterprise',
  pillars: {
    ...DEFAULT_SCORING_CONFIG.pillars,
    [SCORING_PILLARS.SECURITY_READINESS]: {
      weight: 0.3, // Higher emphasis on security for enterprise
      questions: {
        ...DEFAULT_SCORING_CONFIG.pillars[SCORING_PILLARS.SECURITY_READINESS].questions,
        compliance_requirements: {
          weight: 0.5, // Much higher weight for enterprise compliance
          scoringFunction: 'threshold',
          maxScore: 10,
          thresholdConfig: {
            thresholds: [
              { min: 0, max: 0, score: 2 }, // No compliance = low score
              { min: 1, max: 2, score: 6 }, // Some compliance
              { min: 3, max: 10, score: 10 }, // Full compliance suite
            ],
          },
        },
      },
    },
  },
};

export const STARTUP_SCORING_CONFIG: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  version: '1.0.0-startup',
  pillars: {
    ...DEFAULT_SCORING_CONFIG.pillars,
    [SCORING_PILLARS.BUSINESS_READINESS]: {
      weight: 0.35, // Higher emphasis on business readiness for startups
      questions: {
        ...DEFAULT_SCORING_CONFIG.pillars[SCORING_PILLARS.BUSINESS_READINESS].questions,
        current_ai_usage: {
          weight: 0.5, // Much higher weight for AI adoption readiness
          scoringFunction: 'exponential',
          maxScore: 10,
          exponentialConfig: {
            base: 2,
            multiplier: 1.5,
          },
        },
      },
    },
    [SCORING_PILLARS.SECURITY_READINESS]: {
      weight: 0.15, // Lower emphasis on complex security for startups
      questions: DEFAULT_SCORING_CONFIG.pillars[SCORING_PILLARS.SECURITY_READINESS].questions,
    },
  },
};

// Configuration selector based on organization characteristics
export function getScoringConfig(answers: Record<string, any>): ScoringConfig {
  const companySize = answers.company_size;
  const industry = answers.industry;
  
  // Select configuration based on context
  if (companySize === 'enterprise' || industry === 'finance' || industry === 'healthcare') {
    return ENTERPRISE_SCORING_CONFIG;
  }
  
  if (companySize === 'startup') {
    return STARTUP_SCORING_CONFIG;
  }
  
  return DEFAULT_SCORING_CONFIG;
}

// Hot-reload capability - this would be enhanced with file watching in production
let currentConfig = DEFAULT_SCORING_CONFIG;

export function getCurrentScoringConfig(): ScoringConfig {
  return currentConfig;
}

export function updateScoringConfig(newConfig: ScoringConfig): void {
  currentConfig = newConfig;
  // In production, this would trigger recalculation for active sessions
  console.log(`Scoring configuration updated to version ${newConfig.version}`);
}

export function resetScoringConfig(): void {
  currentConfig = DEFAULT_SCORING_CONFIG;
}