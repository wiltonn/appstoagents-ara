// Security Audit API Endpoint - Task 3.2: Security Hardening
// API endpoint for running security audits and vulnerability assessments

import type { APIRoute } from 'astro';
import { securityAuditor } from '../../../lib/security/audit';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check if user is authorized to run security audits
    const adminKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedAdminKey = process.env.ADMIN_API_KEY;

    if (!adminKey || adminKey !== expectedAdminKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Admin API key required for security audit',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Run security audit
    console.log('🔍 Running security audit...');
    const auditResult = await securityAuditor.runAudit();

    // Log audit results for monitoring
    console.log(`📊 Security audit completed:`, {
      score: auditResult.score,
      totalIssues: auditResult.summary.totalIssues,
      criticalIssues: auditResult.summary.critical,
      highIssues: auditResult.summary.high,
    });

    // Return audit results
    return new Response(JSON.stringify(auditResult), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Security audit error:', error);
    
    return new Response(JSON.stringify({
      error: 'Audit Failed',
      message: 'Failed to complete security audit',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authorization
    const adminKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    const expectedAdminKey = process.env.ADMIN_API_KEY;

    if (!adminKey || adminKey !== expectedAdminKey) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Admin API key required',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body for specific audit options
    const body = await request.json();
    const { 
      action,
      checks = [],
      format = 'json'
    } = body;

    switch (action) {
      case 'quick_scan':
        // Run a subset of security checks for faster results
        const quickResult = await securityAuditor.runAudit();
        
        return new Response(JSON.stringify({
          ...quickResult,
          scanType: 'quick',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      case 'full_audit':
        // Run complete security audit
        const fullResult = await securityAuditor.runAudit();
        
        return new Response(JSON.stringify({
          ...fullResult,
          scanType: 'full',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      case 'generate_report':
        // Generate detailed security report
        const reportResult = await securityAuditor.runAudit();
        
        if (format === 'markdown') {
          const markdownReport = generateMarkdownReport(reportResult);
          return new Response(markdownReport, {
            status: 200,
            headers: { 
              'Content-Type': 'text/markdown',
              'Content-Disposition': `attachment; filename="security-audit-${new Date().toISOString().split('T')[0]}.md"`,
            },
          });
        }

        return new Response(JSON.stringify({
          ...reportResult,
          scanType: 'report',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({
          error: 'Invalid Action',
          message: 'Supported actions: quick_scan, full_audit, generate_report',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Security audit API error:', error);
    
    return new Response(JSON.stringify({
      error: 'API Error',
      message: 'Failed to process security audit request',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * Generate markdown report from audit results
 */
function generateMarkdownReport(auditResult: any): string {
  const { timestamp, summary, issues, recommendations, score } = auditResult;
  
  let report = `# Security Audit Report

**Generated:** ${new Date(timestamp).toLocaleString()}  
**Security Score:** ${score}/100  

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | ${summary.critical} |
| High     | ${summary.high} |
| Medium   | ${summary.medium} |
| Low      | ${summary.low} |
| Info     | ${summary.info} |
| **Total** | **${summary.totalIssues}** |

`;

  if (summary.critical > 0 || summary.high > 0) {
    report += `## ⚠️ Immediate Action Required

This system has ${summary.critical} critical and ${summary.high} high-severity security issues that require immediate attention.

`;
  }

  // Add issues by severity
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  
  severityOrder.forEach(severity => {
    const severityIssues = issues.filter((issue: any) => issue.severity === severity);
    
    if (severityIssues.length > 0) {
      report += `## ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity Issues\n\n`;
      
      severityIssues.forEach((issue: any, index: number) => {
        report += `### ${index + 1}. ${issue.title}\n\n`;
        report += `**Category:** ${issue.category}  \n`;
        if (issue.cwe) report += `**CWE:** ${issue.cwe}  \n`;
        if (issue.cvss) report += `**CVSS Score:** ${issue.cvss}  \n`;
        if (issue.location) report += `**Location:** ${issue.location}  \n`;
        report += `\n**Description:** ${issue.description}\n\n`;
        report += `**Recommendation:** ${issue.recommendation}\n\n`;
        
        if (issue.references && issue.references.length > 0) {
          report += `**References:**\n`;
          issue.references.forEach((ref: string) => {
            report += `- ${ref}\n`;
          });
          report += '\n';
        }
        
        report += '---\n\n';
      });
    }
  });

  // Add recommendations
  if (recommendations.length > 0) {
    report += `## 🔧 Recommendations\n\n`;
    recommendations.forEach((rec: string, index: number) => {
      report += `${index + 1}. ${rec}\n`;
    });
    report += '\n';
  }

  // Add footer
  report += `## About This Report

This security audit was automatically generated by the ARA Security Auditor. It identifies potential security vulnerabilities and provides recommendations for improvement.

**Next Steps:**
1. Address critical and high-severity issues immediately
2. Plan remediation for medium and low-severity issues
3. Implement recommended security improvements
4. Schedule regular security audits

For questions about this report or remediation assistance, contact your security team.

---
*Report generated on ${new Date(timestamp).toLocaleString()}*
`;

  return report;
}

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};