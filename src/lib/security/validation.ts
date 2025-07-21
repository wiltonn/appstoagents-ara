// Input Validation and Sanitization - Task 3.2: Security Hardening
// Comprehensive security validation to prevent injection attacks and ensure data integrity

import { z } from 'zod';

export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
  removeNullBytes?: boolean;
  normalizeUnicode?: boolean;
}

/**
 * HTML sanitization patterns and functions
 */
export const HTML_PATTERNS = {
  // Script injection patterns
  SCRIPT_TAGS: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  JAVASCRIPT_URLS: /javascript:/gi,
  ON_EVENT_HANDLERS: /\bon\w+\s*=/gi,
  
  // XSS patterns
  IFRAME_TAGS: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  OBJECT_EMBED: /<(object|embed|applet|link|meta|form)\b[^>]*>/gi,
  
  // Data URIs that could contain scripts
  DATA_URLS: /data:\s*[^;,]+;[^,]*,/gi,
  
  // SQL injection patterns
  SQL_KEYWORDS: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
  SQL_COMMENTS: /(--|\*\/|\*|#)/g,
  
  // Path traversal patterns
  PATH_TRAVERSAL: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/gi,
  
  // Control characters
  CONTROL_CHARS: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
} as const;

/**
 * Comprehensive input sanitization
 */
export class InputSanitizer {
  /**
   * Sanitize string input
   */
  static sanitizeString(
    input: string, 
    options: SanitizationOptions = {}
  ): string {
    if (typeof input !== 'string') {
      return '';
    }

    const {
      allowHtml = false,
      maxLength = 10000,
      trimWhitespace = true,
      removeNullBytes = true,
      normalizeUnicode = true,
    } = options;

    let sanitized = input;

    // Remove null bytes and control characters
    if (removeNullBytes) {
      sanitized = sanitized.replace(HTML_PATTERNS.CONTROL_CHARS, '');
    }

    // Normalize unicode
    if (normalizeUnicode) {
      sanitized = sanitized.normalize('NFKC');
    }

    // Trim whitespace
    if (trimWhitespace) {
      sanitized = sanitized.trim();
    }

    // Remove potentially dangerous HTML/script content
    if (!allowHtml) {
      sanitized = this.removeHtmlTags(sanitized);
    } else {
      sanitized = this.sanitizeHtml(sanitized);
    }

    // Remove SQL injection patterns
    sanitized = this.removeSqlInjection(sanitized);

    // Remove path traversal patterns
    sanitized = sanitized.replace(HTML_PATTERNS.PATH_TRAVERSAL, '');

    // Enforce max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Remove all HTML tags
   */
  private static removeHtmlTags(input: string): string {
    return input
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&[#\w]+;/g, '') // Remove HTML entities
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/data:/gi, ''); // Remove data: URLs
  }

  /**
   * Sanitize HTML while preserving safe tags
   */
  private static sanitizeHtml(input: string): string {
    return input
      .replace(HTML_PATTERNS.SCRIPT_TAGS, '')
      .replace(HTML_PATTERNS.JAVASCRIPT_URLS, '')
      .replace(HTML_PATTERNS.ON_EVENT_HANDLERS, '')
      .replace(HTML_PATTERNS.IFRAME_TAGS, '')
      .replace(HTML_PATTERNS.OBJECT_EMBED, '')
      .replace(HTML_PATTERNS.DATA_URLS, '');
  }

  /**
   * Remove SQL injection patterns
   */
  private static removeSqlInjection(input: string): string {
    return input
      .replace(HTML_PATTERNS.SQL_COMMENTS, '')
      .replace(/['";]/g, '') // Remove dangerous SQL characters
      .replace(/\|\|/g, '') // Remove SQL concatenation
      .replace(/\band\b|\bor\b/gi, ''); // Remove common SQL operators in suspicious contexts
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    const sanitized = this.sanitizeString(email, { maxLength: 254 });
    return sanitized.toLowerCase();
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(url: string): string {
    const sanitized = this.sanitizeString(url, { maxLength: 2048 });
    
    // Only allow safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    try {
      const urlObj = new URL(sanitized);
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return '';
      }
      return urlObj.toString();
    } catch {
      return '';
    }
  }

  /**
   * Sanitize filename
   */
  static sanitizeFilename(filename: string): string {
    return this.sanitizeString(filename, { maxLength: 255 })
      .replace(/[<>:"/\\|?*]/g, '') // Remove illegal filename characters
      .replace(/^\.+/, '') // Remove leading dots
      .replace(/\.+$/, ''); // Remove trailing dots
  }

  /**
   * Sanitize JSON input
   */
  static sanitizeJson(input: string): string {
    try {
      // Parse and re-stringify to remove any malicious content
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed);
    } catch {
      return '{}';
    }
  }
}

/**
 * Common validation schemas using Zod
 */
export const ValidationSchemas = {
  // User input validation
  userInput: z.object({
    name: z.string()
      .min(1, 'Name is required')
      .max(100, 'Name too long')
      .refine(val => !HTML_PATTERNS.SCRIPT_TAGS.test(val), 'Invalid characters'),
    
    email: z.string()
      .email('Invalid email format')
      .max(254, 'Email too long')
      .transform(val => InputSanitizer.sanitizeEmail(val)),
    
    message: z.string()
      .min(1, 'Message is required')
      .max(5000, 'Message too long')
      .transform(val => InputSanitizer.sanitizeString(val)),
  }),

  // Wizard answer validation
  wizardAnswer: z.object({
    questionId: z.string()
      .uuid('Invalid question ID format'),
    
    answer: z.union([
      z.string().transform(val => InputSanitizer.sanitizeString(val, { maxLength: 1000 })),
      z.number().min(-1000000).max(1000000),
      z.boolean(),
      z.array(z.string().transform(val => InputSanitizer.sanitizeString(val)))
    ]),
    
    metadata: z.record(z.any()).optional()
      .transform(val => val ? JSON.parse(InputSanitizer.sanitizeJson(JSON.stringify(val))) : undefined),
  }),

  // Session validation
  sessionData: z.object({
    sessionId: z.string()
      .uuid('Invalid session ID format'),
    
    userId: z.string()
      .min(1, 'User ID required')
      .max(50, 'User ID too long')
      .optional(),
    
    guestId: z.string()
      .min(1, 'Guest ID required')
      .max(50, 'Guest ID too long')
      .optional(),
  }),

  // File upload validation
  fileUpload: z.object({
    filename: z.string()
      .min(1, 'Filename required')
      .max(255, 'Filename too long')
      .transform(val => InputSanitizer.sanitizeFilename(val)),
    
    contentType: z.string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/, 'Invalid content type'),
    
    size: z.number()
      .min(1, 'File cannot be empty')
      .max(10 * 1024 * 1024, 'File too large (max 10MB)'),
  }),

  // URL validation
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .transform(val => InputSanitizer.sanitizeUrl(val)),

  // Search query validation
  searchQuery: z.string()
    .min(1, 'Search query required')
    .max(200, 'Search query too long')
    .transform(val => InputSanitizer.sanitizeString(val, { maxLength: 200 })),

  // Admin operations
  adminAction: z.object({
    action: z.enum(['reset_cache', 'clear_sessions', 'export_data', 'system_health']),
    target: z.string().optional()
      .transform(val => val ? InputSanitizer.sanitizeString(val) : undefined),
    confirmationToken: z.string()
      .min(32, 'Invalid confirmation token')
      .max(64, 'Invalid confirmation token'),
  }),
} as const;

/**
 * Enhanced validator with comprehensive security checks
 */
export class SecurityValidator {
  /**
   * Validate and sanitize input using schema
   */
  static async validate<T>(
    schema: z.ZodSchema<T>,
    input: unknown
  ): Promise<ValidationResult<T>> {
    try {
      const result = await schema.parseAsync(input);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        };
      }
      
      return {
        success: false,
        errors: ['Invalid input format'],
      };
    }
  }

  /**
   * Check for potential security threats
   */
  static checkSecurityThreats(input: string): {
    hasThreat: boolean;
    threats: string[];
  } {
    const threats: string[] = [];

    // Check for script injection
    if (HTML_PATTERNS.SCRIPT_TAGS.test(input)) {
      threats.push('Script injection detected');
    }

    // Check for SQL injection
    if (HTML_PATTERNS.SQL_KEYWORDS.test(input) && HTML_PATTERNS.SQL_COMMENTS.test(input)) {
      threats.push('SQL injection pattern detected');
    }

    // Check for path traversal
    if (HTML_PATTERNS.PATH_TRAVERSAL.test(input)) {
      threats.push('Path traversal attempt detected');
    }

    // Check for XSS patterns
    if (HTML_PATTERNS.JAVASCRIPT_URLS.test(input) || HTML_PATTERNS.ON_EVENT_HANDLERS.test(input)) {
      threats.push('XSS pattern detected');
    }

    // Check for dangerous data URLs
    if (HTML_PATTERNS.DATA_URLS.test(input)) {
      threats.push('Potentially dangerous data URL detected');
    }

    return {
      hasThreat: threats.length > 0,
      threats,
    };
  }

  /**
   * Rate limit aware validation
   */
  static async validateWithRateLimit<T>(
    schema: z.ZodSchema<T>,
    input: unknown,
    identifier: string,
    rateLimitType: string
  ): Promise<ValidationResult<T> & { rateLimited?: boolean }> {
    // Import rate limiter here to avoid circular dependencies
    const { rateLimiter } = await import('./rateLimiter.js');
    
    // Check rate limit first
    const rateLimitResult = await rateLimiter.checkRateLimit(identifier, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 validation requests per minute
    });

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        errors: ['Rate limit exceeded for validation requests'],
        rateLimited: true,
      };
    }

    return this.validate(schema, input);
  }

  /**
   * Validate request headers for security
   */
  static validateHeaders(headers: Headers): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check Content-Type for POST requests
    const contentType = headers.get('content-type');
    if (contentType && !contentType.match(/^(application\/json|application\/x-www-form-urlencoded|multipart\/form-data)/)) {
      issues.push('Suspicious content type');
    }

    // Check for oversized headers
    const headerSize = Array.from(headers.entries())
      .reduce((size, [key, value]) => size + key.length + value.length, 0);
    
    if (headerSize > 8192) { // 8KB limit
      issues.push('Headers too large');
    }

    // Check User-Agent
    const userAgent = headers.get('user-agent');
    if (userAgent && userAgent.length > 512) {
      issues.push('User-Agent header too long');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Middleware factory for request validation
 */
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  options: {
    validateHeaders?: boolean;
    checkThreats?: boolean;
    rateLimitKey?: string;
  } = {}
) {
  return async (request: Request): Promise<{
    valid: boolean;
    data?: T;
    errors?: string[];
    response?: Response;
  }> => {
    const {
      validateHeaders = true,
      checkThreats = true,
      rateLimitKey,
    } = options;

    try {
      // Validate headers if requested
      if (validateHeaders) {
        const headerValidation = SecurityValidator.validateHeaders(request.headers);
        if (!headerValidation.valid) {
          return {
            valid: false,
            errors: headerValidation.issues,
            response: new Response(JSON.stringify({
              error: 'Invalid request headers',
              issues: headerValidation.issues,
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }),
          };
        }
      }

      // Parse request body
      const contentType = request.headers.get('content-type');
      let body: unknown;

      if (contentType?.includes('application/json')) {
        const text = await request.text();
        
        // Check for security threats in raw input
        if (checkThreats) {
          const threatCheck = SecurityValidator.checkSecurityThreats(text);
          if (threatCheck.hasThreat) {
            console.warn('Security threat detected:', threatCheck.threats);
            return {
              valid: false,
              errors: ['Security threat detected in request'],
              response: new Response(JSON.stringify({
                error: 'Request contains potentially malicious content',
              }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }),
            };
          }
        }

        body = JSON.parse(text);
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries());
      } else {
        body = await request.text();
      }

      // Validate with rate limiting if key provided
      const validation = rateLimitKey
        ? await SecurityValidator.validateWithRateLimit(schema, body, rateLimitKey, 'validation')
        : await SecurityValidator.validate(schema, body);

      if (!validation.success) {
        return {
          valid: false,
          errors: validation.errors,
          response: new Response(JSON.stringify({
            error: 'Validation failed',
            details: validation.errors,
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
        };
      }

      return {
        valid: true,
        data: validation.data,
      };

    } catch (error) {
      console.error('Validation middleware error:', error);
      return {
        valid: false,
        errors: ['Request processing failed'],
        response: new Response(JSON.stringify({
          error: 'Request processing failed',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      };
    }
  };
}

// Export utility functions
export {
  InputSanitizer,
  SecurityValidator,
  HTML_PATTERNS,
};