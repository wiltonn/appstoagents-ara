// Scoring Configuration Management Interface
// Hot-reload scoring configuration for Phase 1.5

import React, { useState, useEffect } from 'react';
import type { ScoringConfig } from '../../types/scoring';
import { trpc } from '../../utils/trpc';
import { DEFAULT_SCORING_CONFIG, ENTERPRISE_SCORING_CONFIG, STARTUP_SCORING_CONFIG } from '../../config/scoring';

interface ScoringConfigManagerProps {
  onConfigUpdate?: (config: ScoringConfig) => void;
}

export const ScoringConfigManager: React.FC<ScoringConfigManagerProps> = ({
  onConfigUpdate,
}) => {
  const [selectedConfig, setSelectedConfig] = useState<string>('default');
  const [customConfig, setCustomConfig] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const updateConfigMutation = trpc.wizard.updateScoringConfig.useMutation({
    onSuccess: () => {
      setUpdateStatus('success');
      setErrorMessage('');
      if (onConfigUpdate) {
        onConfigUpdate(JSON.parse(customConfig));
      }
      setTimeout(() => setUpdateStatus('idle'), 3000);
    },
    onError: (error) => {
      setUpdateStatus('error');
      setErrorMessage(error.message || 'Failed to update configuration');
    },
  });

  const predefinedConfigs = {
    default: DEFAULT_SCORING_CONFIG,
    enterprise: ENTERPRISE_SCORING_CONFIG,
    startup: STARTUP_SCORING_CONFIG,
  };

  useEffect(() => {
    // Load selected configuration into editor
    const config = predefinedConfigs[selectedConfig as keyof typeof predefinedConfigs];
    if (config) {
      setCustomConfig(JSON.stringify(config, null, 2));
    }
  }, [selectedConfig]);

  const handleConfigUpdate = async () => {
    try {
      setUpdateStatus('loading');
      const config = JSON.parse(customConfig);
      
      // Basic validation
      if (!config.version || !config.pillars || !config.maxTotalScore) {
        throw new Error('Invalid configuration structure');
      }

      await updateConfigMutation.mutateAsync({ config });
    } catch (error) {
      setUpdateStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Invalid JSON format');
    }
  };

  const getStatusColor = () => {
    switch (updateStatus) {
      case 'loading': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'success': return 'bg-green-50 text-green-700 border-green-200';
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (updateStatus) {
      case 'loading':
        return (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        );
      case 'success':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
        );
      case 'error':
        return (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Scoring Configuration Manager</h2>
          <p className="text-sm text-gray-600 mt-1">
            Hot-reload scoring configurations without server restart
          </p>
        </div>

        {/* Predefined Configuration Selector */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Predefined Configurations
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(predefinedConfigs).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedConfig(key)}
                className={`p-3 rounded-md border text-left transition-colors ${
                  selectedConfig === key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="font-medium capitalize">{key}</div>
                <div className="text-xs text-gray-500 mt-1">
                  v{config.version}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Configuration JSON
            </label>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {isEditing ? 'View Only' : 'Edit'}
            </button>
          </div>
          
          <textarea
            value={customConfig}
            onChange={(e) => setCustomConfig(e.target.value)}
            readOnly={!isEditing}
            rows={20}
            className={`w-full rounded-md border border-gray-300 font-mono text-sm ${
              isEditing 
                ? 'bg-white text-gray-900' 
                : 'bg-gray-50 text-gray-700'
            }`}
            placeholder="Configuration JSON will appear here..."
          />
        </div>

        {/* Update Button and Status */}
        <div className="space-y-3">
          <button
            onClick={handleConfigUpdate}
            disabled={!isEditing || updateStatus === 'loading'}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateStatus === 'loading' ? 'Updating...' : 'Update Configuration'}
          </button>

          {/* Status Display */}
          {updateStatus !== 'idle' && (
            <div className={`flex items-center p-3 rounded-md border ${getStatusColor()}`}>
              <div className="flex-shrink-0 mr-3">
                {getStatusIcon()}
              </div>
              <div className="flex-grow">
                <p className="text-sm font-medium">
                  {updateStatus === 'loading' && 'Updating configuration...'}
                  {updateStatus === 'success' && 'Configuration updated successfully!'}
                  {updateStatus === 'error' && 'Update failed'}
                </p>
                {errorMessage && (
                  <p className="text-xs mt-1">{errorMessage}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Development Notice */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-yellow-800">Development Mode</h4>
                <p className="text-sm text-yellow-700">
                  Hot-reload is active. Configuration changes will be applied immediately.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};