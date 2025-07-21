// PDF Generation Modal Component for Task 2.3
// Allows users to customize and generate PDF reports

import React, { useState } from 'react';
import type { PDFCustomizations } from '../../types/pdf';

interface PDFGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onGenerate: (customizations: PDFCustomizations) => Promise<string>;
  className?: string;
}

export const PDFGenerationModal: React.FC<PDFGenerationModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  onGenerate,
  className = '',
}) => {
  const [customizations, setCustomizations] = useState<PDFCustomizations>({
    includeExecutiveSummary: true,
    includeDetailedScoring: true,
    includeRecommendations: true,
    includeActionPlan: true,
    includeBenchmarks: false,
    includeAppendix: true,
    template: 'standard',
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCustomizationChange = (key: keyof PDFCustomizations, value: any) => {
    setCustomizations(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      const jobId = await onGenerate(customizations);
      console.log('PDF generation started:', jobId);
      
      // Close modal after successful generation
      onClose();
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const templateOptions = [
    { value: 'standard', label: 'Standard Report', description: 'Comprehensive report with all sections' },
    { value: 'executive', label: 'Executive Summary', description: 'High-level overview for leadership' },
    { value: 'technical', label: 'Technical Deep Dive', description: 'Detailed technical analysis' },
    { value: 'minimal', label: 'Minimal Report', description: 'Essential information only' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Generate PDF Report</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isGenerating}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Template Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Report Template
            </label>
            <div className="grid grid-cols-1 gap-3">
              {templateOptions.map((template) => (
                <label
                  key={template.value}
                  className={`
                    flex items-center p-4 border rounded-lg cursor-pointer transition-colors
                    ${customizations.template === template.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.value}
                    checked={customizations.template === template.value}
                    onChange={(e) => handleCustomizationChange('template', e.target.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">{template.label}</div>
                    <div className="text-sm text-gray-500">{template.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Report Sections */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Include Sections
            </label>
            <div className="space-y-3">
              {[
                { key: 'includeExecutiveSummary', label: 'Executive Summary', description: 'High-level overview and key findings' },
                { key: 'includeDetailedScoring', label: 'Detailed Scoring', description: 'Comprehensive scoring breakdown by pillar' },
                { key: 'includeRecommendations', label: 'Recommendations', description: 'Actionable improvement suggestions' },
                { key: 'includeActionPlan', label: 'Action Plan', description: 'Prioritized implementation roadmap' },
                { key: 'includeBenchmarks', label: 'Industry Benchmarks', description: 'Comparison with industry averages' },
                { key: 'includeAppendix', label: 'Appendix', description: 'Methodology and additional details' },
              ].map((section) => (
                <label
                  key={section.key}
                  className="flex items-start p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={customizations[section.key as keyof PDFCustomizations] as boolean}
                    onChange={(e) => handleCustomizationChange(section.key as keyof PDFCustomizations, e.target.checked)}
                    className="h-4 w-4 mt-0.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">{section.label}</div>
                    <div className="text-sm text-gray-500">{section.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Customization Options */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Customization
            </label>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name (optional)
                </label>
                <input
                  type="text"
                  value={customizations.companyName || ''}
                  onChange={(e) => handleCustomizationChange('companyName', e.target.value)}
                  placeholder="Your Organization Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  value={customizations.logoUrl || ''}
                  onChange={(e) => handleCustomizationChange('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand Color (optional)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={customizations.brandColor || '#3B82F6'}
                    onChange={(e) => handleCustomizationChange('brandColor', e.target.value)}
                    className="h-10 w-20 border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    value={customizations.brandColor || '#3B82F6'}
                    onChange={(e) => handleCustomizationChange('brandColor', e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Generation Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">PDF Generation Information</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Generation typically takes 2-5 minutes</li>
                  <li>• You'll receive a download link when ready</li>
                  <li>• Download links expire after 7 days</li>
                  <li>• High-quality PDF with interactive charts</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Session: {sessionId.substring(0, 8)}...
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
            >
              {isGenerating ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};