// Security Audit Dashboard - Task 3.2: Security Hardening
// Administrative dashboard for security monitoring and vulnerability assessment

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  cwe?: string;
  cvss?: number;
}

interface SecurityAuditResult {
  timestamp: string;
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  issues: SecurityIssue[];
  recommendations: string[];
  score: number;
}

export function SecurityAuditDashboard() {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch security audit results
  const { data: auditResult, isLoading, error, refetch } = useQuery<SecurityAuditResult>({
    queryKey: ['admin', 'security-audit'],
    queryFn: async () => {
      const adminKey = localStorage.getItem('admin_api_key');
      if (!adminKey) {
        throw new Error('Admin API key required');
      }

      const response = await fetch('/api/admin/security-audit', {
        headers: {
          'Authorization': `Bearer ${adminKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch security audit results');
      }

      return response.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false, // Manual refresh only
  });

  // Run security audit mutation
  const runAuditMutation = useMutation({
    mutationFn: async (scanType: 'quick_scan' | 'full_audit') => {
      const adminKey = localStorage.getItem('admin_api_key');
      if (!adminKey) {
        throw new Error('Admin API key required');
      }

      const response = await fetch('/api/admin/security-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ action: scanType }),
      });

      if (!response.ok) {
        throw new Error('Failed to run security audit');
      }

      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (format: 'json' | 'markdown') => {
      const adminKey = localStorage.getItem('admin_api_key');
      if (!adminKey) {
        throw new Error('Admin API key required');
      }

      const response = await fetch('/api/admin/security-audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`,
        },
        body: JSON.stringify({ 
          action: 'generate_report',
          format 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate security report');
      }

      if (format === 'markdown') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-audit-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return { downloaded: true };
      }

      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-4">Loading security audit...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Failed to load security audit: {error instanceof Error ? error.message : 'Unknown error'}</span>
        <button className="btn btn-sm" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!auditResult) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-4">Security Audit</h2>
        <p className="mb-6">Run a security audit to identify vulnerabilities and security issues.</p>
        <div className="space-x-4">
          <button 
            className="btn btn-primary"
            onClick={() => runAuditMutation.mutate('quick_scan')}
            disabled={runAuditMutation.isPending}
          >
            {runAuditMutation.isPending ? 'Running...' : 'Quick Scan'}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => runAuditMutation.mutate('full_audit')}
            disabled={runAuditMutation.isPending}
          >
            {runAuditMutation.isPending ? 'Running...' : 'Full Audit'}
          </button>
        </div>
      </div>
    );
  }


  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return 'badge-error';
      case 'high': return 'badge-warning';
      case 'medium': return 'badge-info';
      case 'low': return 'badge-success';
      case 'info': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-error';
  };

  // Filter issues
  const filteredIssues = auditResult.issues.filter(issue => {
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    return severityMatch && categoryMatch;
  });

  // Get unique categories
  const categories = Array.from(new Set(auditResult.issues.map(issue => issue.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Audit Dashboard</h1>
          <p className="text-base-content/70">
            Last audit: {new Date(auditResult.timestamp).toLocaleString()}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => runAuditMutation.mutate('quick_scan')}
            disabled={runAuditMutation.isPending}
          >
            {runAuditMutation.isPending ? 'Scanning...' : 'Quick Scan'}
          </button>
          
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => runAuditMutation.mutate('full_audit')}
            disabled={runAuditMutation.isPending}
          >
            {runAuditMutation.isPending ? 'Auditing...' : 'Full Audit'}
          </button>

          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-outline btn-sm">
              Export Report
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <button onClick={() => generateReportMutation.mutate('json')}>
                  JSON Report
                </button>
              </li>
              <li>
                <button onClick={() => generateReportMutation.mutate('markdown')}>
                  Markdown Report
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Security Score */}
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="card-title">Security Score</h2>
              <div className={`text-6xl font-bold ${getScoreColor(auditResult.score)}`}>
                {auditResult.score}
                <span className="text-2xl">/100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="stat">
                <div className="stat-title">Total Issues</div>
                <div className="stat-value text-2xl">{auditResult.summary.totalIssues}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Critical</div>
          <div className="stat-value text-error">{auditResult.summary.critical}</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">High</div>
          <div className="stat-value text-warning">{auditResult.summary.high}</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Medium</div>
          <div className="stat-value text-info">{auditResult.summary.medium}</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Low</div>
          <div className="stat-value text-success">{auditResult.summary.low}</div>
        </div>
        
        <div className="stat bg-base-200 rounded-lg">
          <div className="stat-title">Info</div>
          <div className="stat-value text-base-content">{auditResult.summary.info}</div>
        </div>
      </div>

      {/* Alerts for Critical Issues */}
      {auditResult.summary.critical > 0 && (
        <div className="alert alert-error">
          <span>🚨 {auditResult.summary.critical} critical security issues require immediate attention!</span>
        </div>
      )}

      {auditResult.summary.high > 0 && (
        <div className="alert alert-warning">
          <span>⚠️ {auditResult.summary.high} high-severity issues should be addressed within 24 hours.</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Filter by Severity</span>
          </label>
          <select 
            className="select select-bordered"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text">Filter by Category</span>
          </label>
          <select 
            className="select select-bordered"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">
          Security Issues ({filteredIssues.length})
        </h2>
        
        {filteredIssues.length === 0 ? (
          <div className="text-center p-8 bg-base-200 rounded-lg">
            <p className="text-lg">No issues found matching the selected filters.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="card-title text-lg">{issue.title}</h3>
                      <div className={`badge ${getSeverityBadge(issue.severity)}`}>
                        {issue.severity.toUpperCase()}
                      </div>
                      <div className="badge badge-outline">
                        {issue.category}
                      </div>
                    </div>
                    
                    <p className="text-base-content/80 mb-3">{issue.description}</p>
                    
                    {issue.location && (
                      <p className="text-sm text-base-content/60 mb-2">
                        <strong>Location:</strong> {issue.location}
                      </p>
                    )}
                    
                    <div className="bg-base-300 p-3 rounded-lg mb-3">
                      <p className="text-sm">
                        <strong>Recommendation:</strong> {issue.recommendation}
                      </p>
                    </div>
                    
                    {(issue.cwe || issue.cvss) && (
                      <div className="flex items-center gap-4 text-sm text-base-content/60">
                        {issue.cwe && <span><strong>CWE:</strong> {issue.cwe}</span>}
                        {issue.cvss && <span><strong>CVSS:</strong> {issue.cvss}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recommendations */}
      {auditResult.recommendations.length > 0 && (
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Security Recommendations</h2>
            <ul className="list-disc list-inside space-y-2">
              {auditResult.recommendations.map((recommendation, index) => (
                <li key={index} className="text-base-content/80">
                  {recommendation}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}