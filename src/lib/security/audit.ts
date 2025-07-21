// Security Audit and Vulnerability Assessment - Task 3.2: Security Hardening
// Comprehensive security scanning and vulnerability assessment tools

import { z } from 'zod';

export interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'authentication' | 'authorization' | 'injection' | 'encryption' | 'configuration' | 'validation' | 'csrf' | 'xss' | 'misc';
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  cwe?: string; // Common Weakness Enumeration ID
  cvss?: number; // CVSS score
  references?: string[];
}

export interface SecurityAuditResult {
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
  score: number; // 0-100 security score
}

export interface VulnerabilityCheck {
  name: string;
  description: string;
  check: () => Promise<SecurityIssue[]>;
}

/**
 * Security Audit Engine
 */
export class SecurityAuditor {
  private checks: VulnerabilityCheck[] = [];

  constructor() {
    this.initializeChecks();
  }

  /**
   * Initialize security checks
   */
  private initializeChecks(): void {
    this.checks = [
      {
        name: 'Environment Variables Security',
        description: 'Check for exposed secrets in environment variables',
        check: this.checkEnvironmentSecurity.bind(this),
      },
      {
        name: 'Authentication Configuration',
        description: 'Verify authentication setup and security',
        check: this.checkAuthConfiguration.bind(this),
      },
      {
        name: 'Database Security',
        description: 'Check database configuration and access patterns',
        check: this.checkDatabaseSecurity.bind(this),
      },
      {
        name: 'API Security',
        description: 'Analyze API endpoints for security vulnerabilities',
        check: this.checkApiSecurity.bind(this),
      },
      {
        name: 'Client-Side Security',
        description: 'Check for client-side security issues',
        check: this.checkClientSecurity.bind(this),
      },
      {
        name: 'Dependencies Security',
        description: 'Scan dependencies for known vulnerabilities',
        check: this.checkDependencySecurity.bind(this),
      },
      {
        name: 'Configuration Security',
        description: 'Verify security configuration settings',
        check: this.checkConfigurationSecurity.bind(this),
      },
      {
        name: 'Input Validation',
        description: 'Check input validation implementation',
        check: this.checkInputValidation.bind(this),
      },
      {
        name: 'CSRF Protection',
        description: 'Verify CSRF protection implementation',
        check: this.checkCSRFProtection.bind(this),
      },
      {
        name: 'Rate Limiting',
        description: 'Check rate limiting implementation',
        check: this.checkRateLimiting.bind(this),
      },
    ];
  }

  /**
   * Run complete security audit
   */
  async runAudit(): Promise<SecurityAuditResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];

    console.log('🔍 Starting security audit...');

    for (const check of this.checks) {
      try {
        console.log(`  Running: ${check.name}`);
        const checkIssues = await check.check();
        issues.push(...checkIssues);
      } catch (error) {
        console.error(`Failed to run check ${check.name}:`, error);
        issues.push({
          id: `audit-error-${Date.now()}`,
          severity: 'medium',
          category: 'misc',
          title: `Audit Check Failed: ${check.name}`,
          description: `Security check failed to execute: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recommendation: 'Investigate why this security check failed to execute',
        });
      }
    }

    const summary = this.calculateSummary(issues);
    const score = this.calculateSecurityScore(summary);
    const recommendations = this.generateRecommendations(issues);

    const result: SecurityAuditResult = {
      timestamp: new Date().toISOString(),
      summary,
      issues,
      recommendations,
      score,
    };

    const duration = Date.now() - startTime;
    console.log(`✅ Security audit completed in ${duration}ms`);
    console.log(`📊 Security Score: ${score}/100`);
    console.log(`🚨 Issues found: ${summary.totalIssues} (${summary.critical} critical, ${summary.high} high)`);

    return result;
  }

  /**
   * Check environment variables security
   */
  private async checkEnvironmentSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for required security environment variables
    const requiredSecurityVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'PII_ENCRYPTION_KEY',
    ];

    requiredSecurityVars.forEach(varName => {
      if (!process.env[varName]) {
        issues.push({
          id: `env-missing-${varName.toLowerCase()}`,
          severity: 'high',
          category: 'configuration',
          title: `Missing Required Environment Variable: ${varName}`,
          description: `The ${varName} environment variable is not set, which could lead to security issues.`,
          recommendation: `Set the ${varName} environment variable with a secure value.`,
        });
      }
    });

    // Check for weak encryption keys
    const piiKey = process.env.PII_ENCRYPTION_KEY;
    if (piiKey && piiKey.length < 32) {
      issues.push({
        id: 'env-weak-pii-key',
        severity: 'critical',
        category: 'encryption',
        title: 'Weak PII Encryption Key',
        description: 'The PII encryption key is too short and may be vulnerable to brute force attacks.',
        recommendation: 'Use a PII encryption key of at least 32 characters with high entropy.',
        cwe: 'CWE-326',
      });
    }

    // Check for development settings in production
    if (process.env.NODE_ENV === 'production') {
      const dangerousDevSettings = [
        'ENABLE_DEBUG',
        'DISABLE_SECURITY',
        'SKIP_AUTH',
      ];

      dangerousDevSettings.forEach(setting => {
        if (process.env[setting]) {
          issues.push({
            id: `env-dev-setting-${setting.toLowerCase()}`,
            severity: 'critical',
            category: 'configuration',
            title: `Development Setting in Production: ${setting}`,
            description: `The ${setting} environment variable is set in production, which could create security vulnerabilities.`,
            recommendation: `Remove the ${setting} environment variable from production environment.`,
          });
        }
      });
    }

    return issues;
  }

  /**
   * Check authentication configuration
   */
  private async checkAuthConfiguration(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check if Clerk is properly configured
    const clerkPublishableKey = process.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;

    if (!clerkPublishableKey || !clerkSecretKey) {
      issues.push({
        id: 'auth-clerk-not-configured',
        severity: 'high',
        category: 'authentication',
        title: 'Clerk Authentication Not Properly Configured',
        description: 'Clerk authentication keys are missing, which may prevent proper authentication.',
        recommendation: 'Configure Clerk authentication with proper publishable and secret keys.',
      });
    }

    // Check for session security settings
    // This would typically check session configuration, token expiration, etc.
    // For now, we'll add a placeholder check

    return issues;
  }

  /**
   * Check database security
   */
  private async checkDatabaseSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Check for insecure database connections
      if (databaseUrl.startsWith('postgres://') && !databaseUrl.includes('sslmode=require')) {
        issues.push({
          id: 'db-insecure-connection',
          severity: 'high',
          category: 'configuration',
          title: 'Database Connection Not Using SSL',
          description: 'Database connection string does not enforce SSL, which may expose data in transit.',
          recommendation: 'Add sslmode=require to the database connection string.',
          cwe: 'CWE-319',
        });
      }

      // Check for database credentials in URL
      if (databaseUrl.includes('password') || databaseUrl.includes('user')) {
        // This is actually normal for connection strings, but we should warn about logging
        issues.push({
          id: 'db-credentials-in-url',
          severity: 'low',
          category: 'configuration',
          title: 'Database Credentials in Connection String',
          description: 'Database connection string contains credentials. Ensure this is not logged or exposed.',
          recommendation: 'Ensure database connection strings are never logged or exposed in error messages.',
        });
      }
    }

    return issues;
  }

  /**
   * Check API security
   */
  private async checkApiSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for CORS configuration
    // This would typically check actual CORS headers in a real audit
    
    // Check for rate limiting
    try {
      const { rateLimiter } = await import('./rateLimiter.js');
      // If we get here, rate limiting is implemented
    } catch {
      issues.push({
        id: 'api-no-rate-limiting',
        severity: 'high',
        category: 'configuration',
        title: 'Rate Limiting Not Implemented',
        description: 'API endpoints do not appear to have rate limiting implemented.',
        recommendation: 'Implement rate limiting to prevent abuse and DoS attacks.',
        cwe: 'CWE-770',
      });
    }

    return issues;
  }

  /**
   * Check client-side security
   */
  private async checkClientSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for security headers implementation
    try {
      const { SecurityHeaders } = await import('./headers.js');
      // If we get here, security headers are implemented
    } catch {
      issues.push({
        id: 'client-no-security-headers',
        severity: 'medium',
        category: 'configuration',
        title: 'Security Headers Not Implemented',
        description: 'Security headers (CSP, HSTS, etc.) do not appear to be implemented.',
        recommendation: 'Implement comprehensive security headers to protect against XSS and other attacks.',
        cwe: 'CWE-693',
      });
    }

    return issues;
  }

  /**
   * Check dependency security
   */
  private async checkDependencySecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for known vulnerable packages
    // This is a simplified check - in production, you'd use tools like npm audit
    const vulnerablePackages = [
      'lodash@4.17.20', // Example of vulnerable version
      'axios@0.21.0',   // Example of vulnerable version
    ];

    // In a real implementation, you would:
    // 1. Parse package.json and package-lock.json
    // 2. Check against vulnerability databases
    // 3. Use npm audit or similar tools

    // For now, we'll add a general recommendation
    issues.push({
      id: 'deps-audit-recommended',
      severity: 'info',
      category: 'misc',
      title: 'Dependency Security Audit Recommended',
      description: 'Regular dependency security audits should be performed.',
      recommendation: 'Run `npm audit` regularly and keep dependencies updated.',
    });

    return issues;
  }

  /**
   * Check configuration security
   */
  private async checkConfigurationSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      issues.push({
        id: 'config-old-node-version',
        severity: 'medium',
        category: 'configuration',
        title: 'Outdated Node.js Version',
        description: `Node.js version ${nodeVersion} may have security vulnerabilities.`,
        recommendation: 'Update to Node.js 18 or later for latest security fixes.',
      });
    }

    // Check for debug mode in production
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG) {
      issues.push({
        id: 'config-debug-in-production',
        severity: 'medium',
        category: 'configuration',
        title: 'Debug Mode Enabled in Production',
        description: 'Debug mode is enabled in production, which may expose sensitive information.',
        recommendation: 'Disable debug mode in production environments.',
      });
    }

    return issues;
  }

  /**
   * Check input validation
   */
  private async checkInputValidation(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      const { ValidationSchemas } = await import('./validation.js');
      // Input validation is implemented
    } catch {
      issues.push({
        id: 'validation-not-implemented',
        severity: 'high',
        category: 'validation',
        title: 'Input Validation Not Implemented',
        description: 'Comprehensive input validation does not appear to be implemented.',
        recommendation: 'Implement input validation for all user inputs to prevent injection attacks.',
        cwe: 'CWE-20',
      });
    }

    return issues;
  }

  /**
   * Check CSRF protection
   */
  private async checkCSRFProtection(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      const { CSRFProtection } = await import('./headers.js');
      // CSRF protection is implemented
    } catch {
      issues.push({
        id: 'csrf-not-implemented',
        severity: 'high',
        category: 'csrf',
        title: 'CSRF Protection Not Implemented',
        description: 'Cross-Site Request Forgery protection does not appear to be implemented.',
        recommendation: 'Implement CSRF protection for all state-changing operations.',
        cwe: 'CWE-352',
      });
    }

    return issues;
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimiting(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      const { rateLimiter } = await import('./rateLimiter.js');
      // Rate limiting is implemented
    } catch {
      issues.push({
        id: 'rate-limiting-not-implemented',
        severity: 'high',
        category: 'configuration',
        title: 'Rate Limiting Not Implemented',
        description: 'Rate limiting does not appear to be implemented.',
        recommendation: 'Implement rate limiting to prevent abuse and DoS attacks.',
        cwe: 'CWE-770',
      });
    }

    return issues;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(issues: SecurityIssue[]): SecurityAuditResult['summary'] {
    const summary = {
      totalIssues: issues.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    issues.forEach(issue => {
      summary[issue.severity]++;
    });

    return summary;
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(summary: SecurityAuditResult['summary']): number {
    // Simple scoring algorithm - can be made more sophisticated
    const weights = {
      critical: 25,
      high: 15,
      medium: 5,
      low: 2,
      info: 0,
    };

    const totalDeductions = 
      summary.critical * weights.critical +
      summary.high * weights.high +
      summary.medium * weights.medium +
      summary.low * weights.low +
      summary.info * weights.info;

    const score = Math.max(0, 100 - totalDeductions);
    return Math.round(score);
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = new Set<string>();

    // Add category-specific recommendations
    const categories = new Set(issues.map(i => i.category));

    if (categories.has('authentication')) {
      recommendations.add('Review and strengthen authentication mechanisms');
    }
    if (categories.has('encryption')) {
      recommendations.add('Implement strong encryption for sensitive data');
    }
    if (categories.has('validation')) {
      recommendations.add('Implement comprehensive input validation');
    }
    if (categories.has('csrf')) {
      recommendations.add('Implement CSRF protection for all forms');
    }
    if (categories.has('injection')) {
      recommendations.add('Use parameterized queries and input sanitization');
    }

    // Add severity-based recommendations
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    if (criticalIssues > 0) {
      recommendations.add('Address critical security issues immediately');
    }

    const highIssues = issues.filter(i => i.severity === 'high').length;
    if (highIssues > 0) {
      recommendations.add('Address high-severity issues within 24 hours');
    }

    // General recommendations
    recommendations.add('Conduct regular security audits');
    recommendations.add('Keep dependencies updated');
    recommendations.add('Implement security monitoring and alerting');
    recommendations.add('Follow OWASP security guidelines');

    return Array.from(recommendations);
  }
}

/**
 * Vulnerability scanner for specific attack patterns
 */
export class VulnerabilityScanner {
  /**
   * Scan for SQL injection vulnerabilities
   */
  static scanSQLInjection(query: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Basic SQL injection patterns
    const sqlPatterns = [
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /drop\s+table/i,
      /exec\s*\(/i,
      /insert\s+into/i,
      /delete\s+from/i,
    ];

    sqlPatterns.forEach((pattern, index) => {
      if (pattern.test(query)) {
        issues.push({
          id: `sql-injection-${index}`,
          severity: 'critical',
          category: 'injection',
          title: 'Potential SQL Injection',
          description: `Query contains patterns that may indicate SQL injection: ${query}`,
          recommendation: 'Use parameterized queries and input validation',
          cwe: 'CWE-89',
          cvss: 9.3,
        });
      }
    });

    return issues;
  }

  /**
   * Scan for XSS vulnerabilities
   */
  static scanXSS(input: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Basic XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /eval\s*\(/gi,
    ];

    xssPatterns.forEach((pattern, index) => {
      if (pattern.test(input)) {
        issues.push({
          id: `xss-${index}`,
          severity: 'high',
          category: 'xss',
          title: 'Potential XSS Vulnerability',
          description: `Input contains patterns that may indicate XSS: ${input.substring(0, 100)}...`,
          recommendation: 'Sanitize and validate all user inputs, implement CSP headers',
          cwe: 'CWE-79',
          cvss: 6.1,
        });
      }
    });

    return issues;
  }

  /**
   * Scan for path traversal vulnerabilities
   */
  static scanPathTraversal(path: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    const pathPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
    ];

    pathPatterns.forEach((pattern, index) => {
      if (pattern.test(path)) {
        issues.push({
          id: `path-traversal-${index}`,
          severity: 'high',
          category: 'misc',
          title: 'Potential Path Traversal',
          description: `Path contains traversal patterns: ${path}`,
          recommendation: 'Validate and sanitize file paths, use allow-lists',
          cwe: 'CWE-22',
          cvss: 7.5,
        });
      }
    });

    return issues;
  }
}

// Export singleton instance
export const securityAuditor = new SecurityAuditor();