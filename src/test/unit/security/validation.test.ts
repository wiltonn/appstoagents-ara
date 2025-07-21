// Security Validation Unit Tests - Task 3.3: Testing Suite
// Comprehensive tests for input validation and sanitization

import { describe, test, expect, beforeEach } from 'vitest';
import { 
  InputSanitizer, 
  SecurityValidator, 
  ValidationSchemas,
  HTML_PATTERNS,
  createValidationMiddleware 
} from '@/lib/security/validation';

describe('InputSanitizer', () => {
  describe('sanitizeString', () => {
    test('removes script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const result = InputSanitizer.sanitizeString(maliciousInput);
      expect(result).toBe('Hello World');
      expect(result).not.toContain('<script>');
    });

    test('removes SQL injection patterns', () => {
      const sqlInput = "'; DROP TABLE users; --";
      const result = InputSanitizer.sanitizeString(sqlInput);
      expect(result).not.toContain('DROP TABLE');
      expect(result).not.toContain('--');
    });

    test('removes path traversal patterns', () => {
      const pathInput = '../../../etc/passwd';
      const result = InputSanitizer.sanitizeString(pathInput);
      expect(result).not.toContain('../');
    });

    test('handles unicode normalization', () => {
      const unicodeInput = 'café'; // Contains combining characters
      const result = InputSanitizer.sanitizeString(unicodeInput, { normalizeUnicode: true });
      expect(result).toBe('café');
    });

    test('enforces max length', () => {
      const longInput = 'a'.repeat(1000);
      const result = InputSanitizer.sanitizeString(longInput, { maxLength: 100 });
      expect(result.length).toBe(100);
    });

    test('preserves safe HTML when allowed', () => {
      const htmlInput = '<p>Hello <strong>World</strong></p>';
      const result = InputSanitizer.sanitizeString(htmlInput, { allowHtml: true });
      expect(result).toContain('<p>');
      expect(result).toContain('<strong>');
    });

    test('removes control characters', () => {
      const controlInput = 'Hello\x00\x01\x02World';
      const result = InputSanitizer.sanitizeString(controlInput);
      expect(result).toBe('HelloWorld');
    });
  });

  describe('sanitizeEmail', () => {
    test('sanitizes and lowercases email', () => {
      const email = 'TEST@EXAMPLE.COM<script>';
      const result = InputSanitizer.sanitizeEmail(email);
      expect(result).toBe('test@example.com');
      expect(result).not.toContain('<script>');
    });

    test('handles malformed emails', () => {
      const malformedEmail = 'not-an-email<script>alert(1)</script>';
      const result = InputSanitizer.sanitizeEmail(malformedEmail);
      expect(result).not.toContain('<script>');
    });
  });

  describe('sanitizeUrl', () => {
    test('allows safe HTTP/HTTPS URLs', () => {
      const url = 'https://example.com/path?param=value';
      const result = InputSanitizer.sanitizeUrl(url);
      expect(result).toBe(url);
    });

    test('blocks dangerous protocols', () => {
      const dangerousUrl = 'javascript:alert(1)';
      const result = InputSanitizer.sanitizeUrl(dangerousUrl);
      expect(result).toBe('');
    });

    test('allows mailto URLs', () => {
      const mailtoUrl = 'mailto:test@example.com';
      const result = InputSanitizer.sanitizeUrl(mailtoUrl);
      expect(result).toBe(mailtoUrl);
    });

    test('handles malformed URLs', () => {
      const malformedUrl = 'not-a-url<script>';
      const result = InputSanitizer.sanitizeUrl(malformedUrl);
      expect(result).toBe('');
    });
  });

  describe('sanitizeFilename', () => {
    test('removes illegal characters', () => {
      const filename = 'file<>:"/\\|?*.txt';
      const result = InputSanitizer.sanitizeFilename(filename);
      expect(result).toBe('file.txt');
    });

    test('removes leading and trailing dots', () => {
      const filename = '...hidden.file...';
      const result = InputSanitizer.sanitizeFilename(filename);
      expect(result).toBe('hidden.file');
    });

    test('enforces length limits', () => {
      const longFilename = 'a'.repeat(300) + '.txt';
      const result = InputSanitizer.sanitizeFilename(longFilename);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });

  describe('sanitizeJson', () => {
    test('parses and re-stringifies valid JSON', () => {
      const validJson = '{"name": "test", "value": 123}';
      const result = InputSanitizer.sanitizeJson(validJson);
      expect(result).toBe(validJson);
    });

    test('handles invalid JSON', () => {
      const invalidJson = '{name: "test", value:}';
      const result = InputSanitizer.sanitizeJson(invalidJson);
      expect(result).toBe('{}');
    });

    test('removes dangerous content', () => {
      const dangerousJson = '{"script": "<script>alert(1)</script>"}';
      const result = InputSanitizer.sanitizeJson(dangerousJson);
      const parsed = JSON.parse(result);
      expect(parsed.script).toBe('<script>alert(1)</script>');
    });
  });
});

describe('SecurityValidator', () => {
  describe('validate', () => {
    test('validates correct input with schema', async () => {
      const schema = ValidationSchemas.userInput;
      const validInput = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello world',
      };

      const result = await SecurityValidator.validate(schema, validInput);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    test('rejects invalid input', async () => {
      const schema = ValidationSchemas.userInput;
      const invalidInput = {
        name: '',
        email: 'not-an-email',
        message: '',
      };

      const result = await SecurityValidator.validate(schema, invalidInput);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    test('sanitizes input during validation', async () => {
      const schema = ValidationSchemas.userInput;
      const maliciousInput = {
        name: 'John<script>alert(1)</script>',
        email: 'JOHN@EXAMPLE.COM',
        message: 'Hello<script>world</script>',
      };

      const result = await SecurityValidator.validate(schema, maliciousInput);
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('John');
      expect(result.data!.email).toBe('john@example.com');
      expect(result.data!.message).toBe('Helloworld');
    });
  });

  describe('checkSecurityThreats', () => {
    test('detects script injection', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = SecurityValidator.checkSecurityThreats(maliciousInput);
      expect(result.hasThreat).toBe(true);
      expect(result.threats).toContain('Script injection detected');
    });

    test('detects SQL injection patterns', () => {
      const sqlInput = "SELECT * FROM users WHERE id = 1; DROP TABLE users; --";
      const result = SecurityValidator.checkSecurityThreats(sqlInput);
      expect(result.hasThreat).toBe(true);
      expect(result.threats).toContain('SQL injection pattern detected');
    });

    test('detects path traversal', () => {
      const pathInput = '../../../etc/passwd';
      const result = SecurityValidator.checkSecurityThreats(pathInput);
      expect(result.hasThreat).toBe(true);
      expect(result.threats).toContain('Path traversal attempt detected');
    });

    test('detects XSS patterns', () => {
      const xssInput = 'javascript:alert(1)';
      const result = SecurityValidator.checkSecurityThreats(xssInput);
      expect(result.hasThreat).toBe(true);
      expect(result.threats).toContain('XSS pattern detected');
    });

    test('allows safe input', () => {
      const safeInput = 'Hello world, this is a normal message.';
      const result = SecurityValidator.checkSecurityThreats(safeInput);
      expect(result.hasThreat).toBe(false);
      expect(result.threats).toHaveLength(0);
    });
  });

  describe('validateHeaders', () => {
    test('validates safe headers', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0...',
        'authorization': 'Bearer token',
      });

      const result = SecurityValidator.validateHeaders(headers);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('detects suspicious content type', () => {
      const headers = new Headers({
        'content-type': 'application/malicious',
      });

      const result = SecurityValidator.validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Suspicious content type');
    });

    test('detects oversized headers', () => {
      const largeValue = 'x'.repeat(10000);
      const headers = new Headers({
        'x-large-header': largeValue,
      });

      const result = SecurityValidator.validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Headers too large');
    });

    test('detects long user agent', () => {
      const longUserAgent = 'x'.repeat(1000);
      const headers = new Headers({
        'user-agent': longUserAgent,
      });

      const result = SecurityValidator.validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('User-Agent header too long');
    });
  });
});

describe('ValidationSchemas', () => {
  describe('userInput', () => {
    test('validates correct user input', async () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello world',
      };

      const result = await ValidationSchemas.userInput.parseAsync(input);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.message).toBe('Hello world');
    });

    test('sanitizes malicious input', async () => {
      const input = {
        name: 'John<script>alert(1)</script>',
        email: 'JOHN@EXAMPLE.COM',
        message: 'Hello<iframe>world</iframe>',
      };

      const result = await ValidationSchemas.userInput.parseAsync(input);
      expect(result.name).toBe('John');
      expect(result.email).toBe('john@example.com');
      expect(result.message).toBe('Helloworld');
    });
  });

  describe('wizardAnswer', () => {
    test('validates wizard answer with string value', async () => {
      const input = {
        questionId: '123e4567-e89b-12d3-a456-426614174000',
        answer: 'Test answer',
      };

      const result = await ValidationSchemas.wizardAnswer.parseAsync(input);
      expect(result.questionId).toBe(input.questionId);
      expect(result.answer).toBe('Test answer');
    });

    test('validates wizard answer with numeric value', async () => {
      const input = {
        questionId: '123e4567-e89b-12d3-a456-426614174000',
        answer: 85,
      };

      const result = await ValidationSchemas.wizardAnswer.parseAsync(input);
      expect(result.answer).toBe(85);
    });

    test('validates wizard answer with array value', async () => {
      const input = {
        questionId: '123e4567-e89b-12d3-a456-426614174000',
        answer: ['option1', 'option2<script>'],
      };

      const result = await ValidationSchemas.wizardAnswer.parseAsync(input);
      expect(result.answer).toEqual(['option1', 'option2']);
    });

    test('sanitizes metadata', async () => {
      const input = {
        questionId: '123e4567-e89b-12d3-a456-426614174000',
        answer: 'Test',
        metadata: {
          source: 'user<script>',
          confidence: 0.8,
        },
      };

      const result = await ValidationSchemas.wizardAnswer.parseAsync(input);
      expect(result.metadata!.source).toBe('user<script>'); // JSON sanitized
      expect(result.metadata!.confidence).toBe(0.8);
    });
  });

  describe('fileUpload', () => {
    test('validates safe file upload', async () => {
      const input = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024, // 1MB
      };

      const result = await ValidationSchemas.fileUpload.parseAsync(input);
      expect(result.filename).toBe('document.pdf');
      expect(result.contentType).toBe('application/pdf');
      expect(result.size).toBe(1024 * 1024);
    });

    test('sanitizes dangerous filename', async () => {
      const input = {
        filename: '../../../evil<script>.pdf',
        contentType: 'application/pdf',
        size: 1000,
      };

      const result = await ValidationSchemas.fileUpload.parseAsync(input);
      expect(result.filename).toBe('evil.pdf');
    });

    test('rejects oversized files', async () => {
      const input = {
        filename: 'large.pdf',
        contentType: 'application/pdf',
        size: 20 * 1024 * 1024, // 20MB (over 10MB limit)
      };

      await expect(ValidationSchemas.fileUpload.parseAsync(input))
        .rejects.toThrow();
    });
  });

  describe('searchQuery', () => {
    test('validates and sanitizes search query', async () => {
      const input = 'test search<script>alert(1)</script>';
      const result = await ValidationSchemas.searchQuery.parseAsync(input);
      expect(result).toBe('test search');
    });

    test('enforces length limits', async () => {
      const longQuery = 'a'.repeat(300);
      const result = await ValidationSchemas.searchQuery.parseAsync(longQuery);
      expect(result.length).toBe(200); // Max length enforced
    });
  });
});

describe('HTML_PATTERNS', () => {
  test('SCRIPT_TAGS pattern matches script tags', () => {
    const scriptInput = '<script>alert(1)</script>';
    expect(HTML_PATTERNS.SCRIPT_TAGS.test(scriptInput)).toBe(true);
    
    const safeInput = 'Hello world';
    expect(HTML_PATTERNS.SCRIPT_TAGS.test(safeInput)).toBe(false);
  });

  test('SQL_KEYWORDS pattern matches SQL injection', () => {
    const sqlInput = 'SELECT * FROM users';
    expect(HTML_PATTERNS.SQL_KEYWORDS.test(sqlInput)).toBe(true);
    
    const safeInput = 'Hello world';
    expect(HTML_PATTERNS.SQL_KEYWORDS.test(safeInput)).toBe(false);
  });

  test('PATH_TRAVERSAL pattern matches traversal attempts', () => {
    const pathInput = '../../../etc/passwd';
    expect(HTML_PATTERNS.PATH_TRAVERSAL.test(pathInput)).toBe(true);
    
    const safeInput = 'normal/path/file.txt';
    expect(HTML_PATTERNS.PATH_TRAVERSAL.test(safeInput)).toBe(false);
  });
});

describe('createValidationMiddleware', () => {
  test('creates middleware that validates requests', async () => {
    const middleware = createValidationMiddleware(ValidationSchemas.userInput);
    
    const mockRequest = {
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({
        name: 'John',
        email: 'john@example.com',
        message: 'Hello',
      }),
    } as any;

    const result = await middleware(mockRequest);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  test('rejects invalid requests', async () => {
    const middleware = createValidationMiddleware(ValidationSchemas.userInput);
    
    const mockRequest = {
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({
        name: '',
        email: 'invalid-email',
        message: '',
      }),
    } as any;

    const result = await middleware(mockRequest);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  test('detects security threats', async () => {
    const middleware = createValidationMiddleware(ValidationSchemas.userInput, {
      checkThreats: true,
    });
    
    const mockRequest = {
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({
        name: 'John<script>alert(1)</script>',
        email: 'john@example.com',
        message: 'Hello',
      }),
    } as any;

    const result = await middleware(mockRequest);
    expect(result.valid).toBe(false);
    expect(result.response).toBeDefined();
  });
});