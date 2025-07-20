import React from 'react';
import type { TotalScore, ScoringPreview } from '../../types/scoring';

interface ScorePreviewProps {
  score?: TotalScore;
  preview?: ScoringPreview;
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}

export const ScorePreview: React.FC<ScorePreviewProps> = ({
  score,
  preview,
  isVisible,
  onToggle,
  className = '',
}) => {
  if (!preview) {
    return null;
  }

  const { currentScore, potentialScore, progressPercentage, missingCriticalQuestions } = preview;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50';
    if (percentage >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreLabel = (percentage: number) => {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className={`score-preview bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Agent Readiness Score</h3>
        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label={isVisible ? 'Hide score preview' : 'Show score preview'}
        >
          <svg
            className={`w-5 h-5 transform transition-transform ${isVisible ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isVisible && (
        <div className="p-4 space-y-4">
          {/* Overall Score */}
          <div className="text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${getScoreColor(currentScore.percentage)}`}>
              <span className="text-2xl font-bold mr-2">{Math.round(currentScore.percentage)}%</span>
              <span>{getScoreLabel(currentScore.percentage)}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Current Score: {currentScore.totalScore.toFixed(1)} / {currentScore.maxTotalScore}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Assessment Progress</span>
              <span>{progressPercentage}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {preview.completedQuestions} of {preview.totalQuestions} questions answered
            </p>
          </div>

          {/* Potential Score */}
          {potentialScore > currentScore.totalScore && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">Potential for Improvement</h4>
                  <p className="text-sm text-blue-700">
                    You could reach <strong>{Math.round((potentialScore / currentScore.maxTotalScore) * 100)}%</strong> by completing remaining questions
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pillar Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Readiness Pillars</h4>
            {currentScore.pillarScores.map((pillar) => (
              <div key={pillar.pillar} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize text-gray-700">
                    {pillar.pillar.replace(/_/g, ' ')}
                  </span>
                  <span className="font-medium text-gray-900">
                    {Math.round(pillar.percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      pillar.percentage >= 80 ? 'bg-green-500' :
                      pillar.percentage >= 60 ? 'bg-yellow-500' :
                      pillar.percentage >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pillar.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Critical Missing Questions */}
          {missingCriticalQuestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-amber-800">High-Impact Questions Remaining</h4>
                  <p className="text-sm text-amber-700">
                    {missingCriticalQuestions.length} critical question{missingCriticalQuestions.length > 1 ? 's' : ''} could significantly improve your score
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-500 text-center border-t border-gray-100 pt-3">
            Last updated: {currentScore.calculatedAt.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};