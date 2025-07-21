// Security Headers and CSRF Protection - Task 3.2: Security Hardening
// Comprehensive security headers and CSRF protection implementation

import { randomBytes, createHmac } from 'crypto';

export interface SecurityHeadersConfig {
  csp?: {
    defaultSrc?: string[];
    scriptSrc?: string[];
    styleSrc?: string[];
    imgSrc?: string[];
    connectSrc?: string[];
    fontSrc?: string[];
    frameSrc?: string[];
    objectSrc?: string[];
    upgradeInsecureRequests?: boolean;
  };
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  referrerPolicy?: string;
  crossOriginEmbedderPolicy?: string;
  crossOriginOpenerPolicy?: string;
  crossOriginResourcePolicy?: string;
  permissionsPolicy?: string[];
}

export interface CSRFConfig {
  secret: string;
  tokenName?: string;
  headerName?: string;
  cookieName?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
}

/**
 * Security Headers Manager
 */
export class SecurityHeaders {
  private static defaultConfig: SecurityHeadersConfig = {
    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Astro/React
        "'unsafe-eval'", // Required for development
        "https://js.clerk.dev",
        "https://clerk.appstoagents.com",
        "https://vercel.live",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for CSS-in-JS
        "https://fonts.googleapis.com",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://images.clerk.dev",
        "https://img.clerk.com",
        "https://www.gravatar.com",
        "https://vercel.live",
      ],
      connectSrc: [
        "'self'",
        "https://api.clerk.dev",
        "https://clerk.appstoagents.com",
        "https://api.openai.com",
        "https://vercel.live",
        "wss://vercel.live",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
      ],
      frameSrc: [
        "'self'",
        "https://challenges.cloudflare.com",
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: true,
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    permissionsPolicy: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
    ],
  };

  /**
   * Generate Content Security Policy header value
   */
  static generateCSP(csp: SecurityHeadersConfig['csp'] = {}): string {
    const finalCSP = { ...this.defaultConfig.csp, ...csp };
    const directives: string[] = [];

    if (finalCSP.defaultSrc) {
      directives.push(`default-src ${finalCSP.defaultSrc.join(' ')}`);
    }
    if (finalCSP.scriptSrc) {
      directives.push(`script-src ${finalCSP.scriptSrc.join(' ')}`);
    }
    if (finalCSP.styleSrc) {
      directives.push(`style-src ${finalCSP.styleSrc.join(' ')}`);
    }
    if (finalCSP.imgSrc) {
      directives.push(`img-src ${finalCSP.imgSrc.join(' ')}`);
    }
    if (finalCSP.connectSrc) {
      directives.push(`connect-src ${finalCSP.connectSrc.join(' ')}`);
    }
    if (finalCSP.fontSrc) {
      directives.push(`font-src ${finalCSP.fontSrc.join(' ')}`);
    }
    if (finalCSP.frameSrc) {
      directives.push(`frame-src ${finalCSP.frameSrc.join(' ')}`);
    }
    if (finalCSP.objectSrc) {
      directives.push(`object-src ${finalCSP.objectSrc.join(' ')}`);
    }
    if (finalCSP.upgradeInsecureRequests) {
      directives.push('upgrade-insecure-requests');
    }

    return directives.join('; ');
  }

  /**
   * Generate all security headers
   */
  static generateHeaders(config: SecurityHeadersConfig = {}): Record<string, string> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (finalConfig.csp) {
      headers['Content-Security-Policy'] = this.generateCSP(finalConfig.csp);
    }

    // HTTP Strict Transport Security
    if (finalConfig.hsts) {
      const hsts = finalConfig.hsts;
      let hstsValue = `max-age=${hsts.maxAge || 31536000}`;
      if (hsts.includeSubDomains) hstsValue += '; includeSubDomains';
      if (hsts.preload) hstsValue += '; preload';
      headers['Strict-Transport-Security'] = hstsValue;
    }

    // X-Frame-Options (legacy fallback for CSP frame-ancestors)
    headers['X-Frame-Options'] = 'DENY';

    // X-Content-Type-Options
    headers['X-Content-Type-Options'] = 'nosniff';

    // X-XSS-Protection (legacy browsers)
    headers['X-XSS-Protection'] = '1; mode=block';

    // Referrer Policy
    if (finalConfig.referrerPolicy) {
      headers['Referrer-Policy'] = finalConfig.referrerPolicy;
    }

    // Cross-Origin Embedder Policy
    if (finalConfig.crossOriginEmbedderPolicy) {
      headers['Cross-Origin-Embedder-Policy'] = finalConfig.crossOriginEmbedderPolicy;
    }

    // Cross-Origin Opener Policy
    if (finalConfig.crossOriginOpenerPolicy) {
      headers['Cross-Origin-Opener-Policy'] = finalConfig.crossOriginOpenerPolicy;
    }

    // Cross-Origin Resource Policy
    if (finalConfig.crossOriginResourcePolicy) {
      headers['Cross-Origin-Resource-Policy'] = finalConfig.crossOriginResourcePolicy;
    }

    // Permissions Policy
    if (finalConfig.permissionsPolicy) {
      headers['Permissions-Policy'] = finalConfig.permissionsPolicy.join(', ');
    }

    return headers;
  }

  /**
   * Apply security headers to response
   */
  static applyToResponse(
    response: Response,
    config: SecurityHeadersConfig = {}
  ): Response {
    const headers = this.generateHeaders(config);
    
    // Create new response with security headers
    const newHeaders = new Headers(response.headers);
    Object.entries(headers).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  /**
   * Create security headers middleware
   */
  static createMiddleware(config: SecurityHeadersConfig = {}) {
    return (request: Request): Response | null => {
      // Apply headers to all responses (this will be handled by the response wrapper)
      // Return null to continue to next middleware
      return null;
    };
  }
}

/**
 * CSRF Protection Implementation
 */
export class CSRFProtection {
  private config: Required<CSRFConfig>;

  constructor(config: CSRFConfig) {
    this.config = {
      secret: config.secret,
      tokenName: config.tokenName || 'csrf_token',
      headerName: config.headerName || 'X-CSRF-Token',
      cookieName: config.cookieName || 'csrf_token',
      sameSite: config.sameSite || 'strict',
      secure: config.secure ?? true,
      httpOnly: config.httpOnly ?? false, // False so client can read it
      maxAge: config.maxAge || 3600, // 1 hour
    };
  }

  /**
   * Generate CSRF token
   */
  generateToken(sessionId?: string): string {
    const timestamp = Date.now().toString();
    const nonce = randomBytes(16).toString('hex');
    const payload = `${timestamp}:${nonce}:${sessionId || 'anonymous'}`;
    
    const signature = createHmac('sha256', this.config.secret)
      .update(payload)
      .digest('hex');
    
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
  }

  /**
   * Validate CSRF token
   */
  validateToken(token: string, sessionId?: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [timestamp, nonce, tokenSessionId, signature] = decoded.split(':');
      
      if (!timestamp || !nonce || !tokenSessionId || !signature) {
        return false;
      }

      // Check if token is expired (1 hour)
      const tokenTime = parseInt(timestamp);
      const now = Date.now();
      if (now - tokenTime > this.config.maxAge * 1000) {
        return false;
      }

      // Verify session ID matches
      const expectedSessionId = sessionId || 'anonymous';
      if (tokenSessionId !== expectedSessionId) {
        return false;
      }

      // Verify signature
      const payload = `${timestamp}:${nonce}:${tokenSessionId}`;
      const expectedSignature = createHmac('sha256', this.config.secret)
        .update(payload)
        .digest('hex');
      
      return signature === expectedSignature;

    } catch (error) {
      console.error('CSRF token validation error:', error);
      return false;
    }
  }

  /**
   * Extract token from request
   */
  extractToken(request: Request): string | null {
    // Try header first
    const headerToken = request.headers.get(this.config.headerName);
    if (headerToken) {
      return headerToken;
    }

    // Try cookie
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);
      const cookieToken = cookies[this.config.cookieName];
      if (cookieToken) {
        return cookieToken;
      }
    }

    return null;
  }

  /**
   * Create cookie header for CSRF token
   */
  createCookie(token: string): string {
    const attributes = [
      `${this.config.cookieName}=${token}`,
      `Max-Age=${this.config.maxAge}`,
      `SameSite=${this.config.sameSite}`,
      'Path=/',
    ];

    if (this.config.secure) {
      attributes.push('Secure');
    }

    if (this.config.httpOnly) {
      attributes.push('HttpOnly');
    }

    return attributes.join('; ');
  }

  /**
   * Parse cookies from header
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    return cookieHeader
      .split(';')
      .reduce((cookies, cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
        return cookies;
      }, {} as Record<string, string>);
  }

  /**
   * Create CSRF protection middleware
   */
  createMiddleware(options: {
    exemptMethods?: string[];
    exemptPaths?: string[];
    getSessionId?: (request: Request) => string | Promise<string | null>;
  } = {}) {
    const {
      exemptMethods = ['GET', 'HEAD', 'OPTIONS'],
      exemptPaths = [],
      getSessionId,
    } = options;

    return async (request: Request): Promise<Response | null> => {
      const method = request.method.toUpperCase();
      const url = new URL(request.url);
      
      // Skip CSRF check for exempt methods
      if (exemptMethods.includes(method)) {
        return null;
      }

      // Skip CSRF check for exempt paths
      if (exemptPaths.some(path => url.pathname.startsWith(path))) {
        return null;
      }

      // Get session ID if available
      const sessionId = getSessionId ? await getSessionId(request) : null;

      // Extract and validate CSRF token
      const token = this.extractToken(request);
      
      if (!token || !this.validateToken(token, sessionId || undefined)) {
        console.warn('CSRF token validation failed:', {
          method,
          path: url.pathname,
          hasToken: !!token,
          sessionId: sessionId || 'anonymous',
        });

        return new Response(JSON.stringify({
          error: 'CSRF token validation failed',
          message: 'Invalid or missing CSRF token',
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      return null; // Continue to next middleware
    };
  }

  /**
   * Add CSRF token to response
   */
  addTokenToResponse(
    response: Response,
    sessionId?: string
  ): Response {
    const token = this.generateToken(sessionId);
    const cookie = this.createCookie(token);
    
    const newHeaders = new Headers(response.headers);
    newHeaders.append('Set-Cookie', cookie);
    newHeaders.set(this.config.headerName, token);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
}

/**
 * Security middleware factory
 */
export function createSecurityMiddleware(options: {
  headers?: SecurityHeadersConfig;
  csrf?: CSRFConfig;
  exemptPaths?: string[];
  getSessionId?: (request: Request) => string | Promise<string | null>;
} = {}) {
  const {
    headers: headersConfig,
    csrf: csrfConfig,
    exemptPaths = ['/api/health', '/api/metrics'],
    getSessionId,
  } = options;

  const csrfProtection = csrfConfig ? new CSRFProtection(csrfConfig) : null;

  return async (request: Request, next: () => Promise<Response>): Promise<Response> => {
    const url = new URL(request.url);
    
    // Skip security checks for exempt paths
    const isExempt = exemptPaths.some(path => url.pathname.startsWith(path));
    
    if (!isExempt) {
      // CSRF protection
      if (csrfProtection) {
        const csrfResult = await csrfProtection.createMiddleware({
          getSessionId,
        })(request);
        
        if (csrfResult) {
          return csrfResult; // CSRF validation failed
        }
      }
    }

    // Process request
    let response = await next();

    // Apply security headers
    if (headersConfig !== false) {
      response = SecurityHeaders.applyToResponse(response, headersConfig);
    }

    // Add CSRF token to response
    if (!isExempt && csrfProtection) {
      const sessionId = getSessionId ? await getSessionId(request) : null;
      response = csrfProtection.addTokenToResponse(response, sessionId || undefined);
    }

    return response;
  };
}

// Environment-specific configurations
export const SECURITY_CONFIGS = {
  development: {
    headers: {
      csp: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Allow eval in development
          "https://js.clerk.dev",
          "http://localhost:*",
          "ws://localhost:*",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "https://api.clerk.dev",
          "https://api.openai.com",
          "http://localhost:*",
          "ws://localhost:*",
        ],
        upgradeInsecureRequests: false,
      },
    },
  },
  production: {
    headers: SecurityHeaders.defaultConfig,
  },
} as const;

// Utility function to get environment-specific config
export function getSecurityConfig(env: 'development' | 'production' = 'production') {
  return SECURITY_CONFIGS[env];
}

export { SecurityHeaders, CSRFProtection };