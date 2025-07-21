// PDF Status Tracker Component for Task 2.3
// Tracks PDF generation progress and provides download link

import React, { useState, useEffect } from 'react';

interface PDFJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  metadata?: {
    reportTitle?: string;
    generationTime?: number;
    fileSize?: number;
    pageCount?: number;
  };
}

interface PDFResult {
  downloadUrl?: string;
  expiresAt?: Date;
  filename?: string;
  size?: number;
  pageCount?: number;
}

interface PDFStatusTrackerProps {
  jobId: string;
  onStatusChange?: (status: string) => void;
  onComplete?: (result: PDFResult) => void;
  onError?: (error: string) => void;
  className?: string;
  pollInterval?: number;
}

export const PDFStatusTracker: React.FC<PDFStatusTrackerProps> = ({
  jobId,
  onStatusChange,
  onComplete,
  onError,
  className = '',
  pollInterval = 3000,
}) => {
  const [job, setJob] = useState<PDFJob | null>(null);
  const [result, setResult] = useState<PDFResult | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [progress, setProgress] = useState(0);

  // Fetch job status
  const fetchJobStatus = async () => {
    try {
      // TODO: Replace with actual tRPC call
      const response = await fetch(`/api/trpc/reports.getJobStatus?input=${encodeURIComponent(JSON.stringify({ jobId }))}`);
      const data = await response.json();
      
      if (data.result?.data) {
        const jobData = data.result.data;
        setJob(jobData);
        
        if (onStatusChange) {
          onStatusChange(jobData.status);
        }

        // Update progress based on status
        switch (jobData.status) {
          case 'pending':
            setProgress(10);
            break;
          case 'processing':
            setProgress(50);
            break;
          case 'completed':
            setProgress(100);
            setIsPolling(false);
            await fetchResult();
            break;
          case 'failed':
            setProgress(0);
            setIsPolling(false);
            if (onError && jobData.error) {
              onError(jobData.error);
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error fetching job status:', error);
      if (onError) {
        onError('Failed to fetch job status');
      }
    }
  };

  // Fetch download result
  const fetchResult = async () => {
    try {
      // TODO: Replace with actual tRPC call
      const response = await fetch(`/api/trpc/reports.getDownloadUrl?input=${encodeURIComponent(JSON.stringify({ jobId }))}`);
      const data = await response.json();
      
      if (data.result?.data) {
        const resultData = data.result.data;
        setResult(resultData);
        
        if (onComplete) {
          onComplete(resultData);
        }
      }
    } catch (error) {
      console.error('Error fetching result:', error);
      if (onError) {
        onError('Failed to fetch download URL');
      }
    }
  };

  // Polling effect
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(fetchJobStatus, pollInterval);
    
    // Initial fetch
    fetchJobStatus();

    return () => clearInterval(interval);
  }, [jobId, isPolling, pollInterval]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format generation time
  const formatGenerationTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'processing':
        return (
          <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  if (!job) {
    return (
      <div className={`pdf-status-tracker ${className}`}>
        <div className="flex items-center justify-center p-4">
          <svg className="w-6 h-6 text-gray-400 animate-spin mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-gray-600">Loading job status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`pdf-status-tracker bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">PDF Report Generation</h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon(job.status)}
          <span className={`text-sm font-medium ${getStatusColor(job.status)}`}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              job.status === 'completed' ? 'bg-green-500' :
              job.status === 'failed' ? 'bg-red-500' :
              job.status === 'processing' ? 'bg-blue-500' : 'bg-gray-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Job ID:</span>
          <div className="font-mono text-xs text-gray-700">{jobId}</div>
        </div>
        <div>
          <span className="text-gray-500">Created:</span>
          <div className="text-gray-700">{job.createdAt.toLocaleString()}</div>
        </div>
        {job.startedAt && (
          <div>
            <span className="text-gray-500">Started:</span>
            <div className="text-gray-700">{job.startedAt.toLocaleString()}</div>
          </div>
        )}
        {job.completedAt && (
          <div>
            <span className="text-gray-500">Completed:</span>
            <div className="text-gray-700">{job.completedAt.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Generation Details */}
      {job.metadata && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Report Details</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {job.metadata.reportTitle && (
              <div>
                <span className="text-gray-500">Title:</span>
                <div className="text-gray-700">{job.metadata.reportTitle}</div>
              </div>
            )}
            {job.metadata.pageCount && (
              <div>
                <span className="text-gray-500">Pages:</span>
                <div className="text-gray-700">{job.metadata.pageCount}</div>
              </div>
            )}
            {job.metadata.fileSize && (
              <div>
                <span className="text-gray-500">File Size:</span>
                <div className="text-gray-700">{formatFileSize(job.metadata.fileSize)}</div>
              </div>
            )}
            {job.metadata.generationTime && (
              <div>
                <span className="text-gray-500">Generation Time:</span>
                <div className="text-gray-700">{formatGenerationTime(job.metadata.generationTime)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {job.status === 'failed' && job.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800 text-sm font-medium">Generation Failed</span>
          </div>
          <p className="text-red-700 text-sm mt-1">{job.error}</p>
        </div>
      )}

      {/* Download Section */}
      {job.status === 'completed' && result && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Download Ready</h4>
              {result.expiresAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Link expires: {result.expiresAt.toLocaleString()}
                </p>
              )}
            </div>
            <a
              href={result.downloadUrl}
              download={result.filename}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {job.status === 'pending' && (
        <div className="text-center text-sm text-gray-600">
          <p>Your PDF generation job is queued. It will start processing shortly.</p>
        </div>
      )}
      
      {job.status === 'processing' && (
        <div className="text-center text-sm text-gray-600">
          <p>Generating your PDF report... This usually takes 2-5 minutes.</p>
        </div>
      )}
    </div>
  );
};