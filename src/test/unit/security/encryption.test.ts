// Security Encryption Unit Tests - Task 3.3: Testing Suite
// Comprehensive tests for PII data encryption and decryption

import { describe, test, expect, beforeEach } from 'vitest';
import { 
  PIIEncryption, 
  PIIDataManager,
  DatabaseEncryption,
  PII_FIELD_TYPES,
  createPIIManager,
} from '@/lib/security/encryption';

describe('PIIEncryption', () => {
  let encryption: PIIEncryption;
  const testPassword = 'test-master-password-32-characters-long';

  beforeEach(() => {
    encryption = new PIIEncryption(testPassword, 1);
  });

  describe('encrypt and decrypt', () => {
    test('encrypts and decrypts text correctly', () => {
      const plaintext = 'sensitive-data@example.com';
      const context = 'user_email';
      
      const encrypted = encryption.encrypt(plaintext, context);
      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.keyVersion).toBe(1);
      
      const decrypted = encryption.decrypt(encrypted, context);
      expect(decrypted).toBe(plaintext);
    });

    test('produces different encrypted output for same input', () => {
      const plaintext = 'test-data';
      const context = 'test';
      
      const encrypted1 = encryption.encrypt(plaintext, context);
      const encrypted2 = encryption.encrypt(plaintext, context);
      
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      
      // But both should decrypt to the same plaintext
      expect(encryption.decrypt(encrypted1, context)).toBe(plaintext);
      expect(encryption.decrypt(encrypted2, context)).toBe(plaintext);
    });

    test('different contexts produce different encrypted output', () => {
      const plaintext = 'test-data';
      
      const encrypted1 = encryption.encrypt(plaintext, 'context1');
      const encrypted2 = encryption.encrypt(plaintext, 'context2');
      
      expect(encrypted1.data).not.toBe(encrypted2.data);
      
      expect(encryption.decrypt(encrypted1, 'context1')).toBe(plaintext);
      expect(encryption.decrypt(encrypted2, 'context2')).toBe(plaintext);
    });

    test('fails to decrypt with wrong context', () => {
      const plaintext = 'test-data';
      const encrypted = encryption.encrypt(plaintext, 'correct-context');
      
      expect(() => {
        encryption.decrypt(encrypted, 'wrong-context');
      }).toThrow('Failed to decrypt data');
    });

    test('handles additional authenticated data', () => {
      const plaintext = 'test-data';
      const context = 'test';
      const additionalData = 'metadata';
      
      const encrypted = encryption.encrypt(plaintext, context, additionalData);
      const decrypted = encryption.decrypt(encrypted, context, additionalData);
      
      expect(decrypted).toBe(plaintext);
    });

    test('fails with wrong additional authenticated data', () => {
      const plaintext = 'test-data';
      const context = 'test';
      
      const encrypted = encryption.encrypt(plaintext, context, 'correct-metadata');
      
      expect(() => {
        encryption.decrypt(encrypted, context, 'wrong-metadata');
      }).toThrow('Failed to decrypt data');
    });

    test('rejects empty plaintext', () => {
      expect(() => {
        encryption.encrypt('', 'test');
      }).toThrow('Plaintext cannot be empty');
    });

    test('rejects empty encrypted data', () => {
      expect(() => {
        encryption.decrypt({ data: '', iv: 'test', algorithm: 'aes-256-gcm' }, 'test');
      }).toThrow('Encrypted data cannot be empty');
    });
  });

  describe('hash and verifyHash', () => {
    test('creates and verifies hash', () => {
      const data = 'test-data';
      const hash = encryption.hash(data);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      
      const isValid = encryption.verifyHash(data, hash);
      expect(isValid).toBe(true);
    });

    test('hash verification fails for wrong data', () => {
      const originalData = 'test-data';
      const wrongData = 'wrong-data';
      const hash = encryption.hash(originalData);
      
      const isValid = encryption.verifyHash(wrongData, hash);
      expect(isValid).toBe(false);
    });

    test('same data produces different hashes due to salt', () => {
      const data = 'test-data';
      const hash1 = encryption.hash(data);
      const hash2 = encryption.hash(data);
      
      expect(hash1).not.toBe(hash2);
      
      // But both should verify correctly
      expect(encryption.verifyHash(data, hash1)).toBe(true);
      expect(encryption.verifyHash(data, hash2)).toBe(true);
    });

    test('handles invalid hash format gracefully', () => {
      const data = 'test-data';
      const invalidHash = 'invalid-hash';
      
      const result = encryption.verifyHash(data, invalidHash);
      expect(result).toBe(false);
    });
  });

  describe('key rotation', () => {
    test('rotates encryption key', () => {
      const newPassword = 'new-master-password-32-characters-long';
      const newEncryption = encryption.rotateKey(newPassword);
      
      expect(newEncryption).toBeInstanceOf(PIIEncryption);
      expect(newEncryption.keyVersion).toBe(2);
      
      // Old and new encryption should produce different results
      const plaintext = 'test-data';
      const oldEncrypted = encryption.encrypt(plaintext, 'test');
      const newEncrypted = newEncryption.encrypt(plaintext, 'test');
      
      expect(oldEncrypted.data).not.toBe(newEncrypted.data);
      expect(oldEncrypted.keyVersion).toBe(1);
      expect(newEncrypted.keyVersion).toBe(2);
    });
  });
});

describe('PIIDataManager', () => {
  let piiManager: PIIDataManager;
  const testPassword = 'test-master-password-32-characters-long';

  beforeEach(() => {
    piiManager = new PIIDataManager(testPassword);
  });

  describe('field encryption configuration', () => {
    test('correctly identifies fields that should be encrypted', () => {
      expect(piiManager.shouldEncryptField(PII_FIELD_TYPES.EMAIL)).toBe(true);
      expect(piiManager.shouldEncryptField(PII_FIELD_TYPES.SSN)).toBe(true);
      expect(piiManager.shouldEncryptField(PII_FIELD_TYPES.PASSWORD)).toBe(true);
      expect(piiManager.shouldEncryptField(PII_FIELD_TYPES.NAME)).toBe(false); // Default setting
    });

    test('allows configuration of field encryption', () => {
      piiManager.setFieldEncryption(PII_FIELD_TYPES.NAME, true);
      expect(piiManager.shouldEncryptField(PII_FIELD_TYPES.NAME)).toBe(true);
      
      piiManager.setFieldEncryption(PII_FIELD_TYPES.EMAIL, false);
      expect(piiManager.shouldEncryptField(PII_FIELD_TYPES.EMAIL)).toBe(false);
    });
  });

  describe('encryptField and decryptField', () => {
    test('encrypts sensitive field types', () => {
      const email = 'test@example.com';
      const encrypted = piiManager.encryptField(email, PII_FIELD_TYPES.EMAIL);
      
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.value).not.toBe(email);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.keyVersion).toBe(1);
      
      const decrypted = piiManager.decryptField(encrypted, PII_FIELD_TYPES.EMAIL);
      expect(decrypted).toBe(email);
    });

    test('does not encrypt non-sensitive field types', () => {
      const name = 'John Doe';
      const result = piiManager.encryptField(name, PII_FIELD_TYPES.NAME);
      
      expect(result.encrypted).toBe(false);
      expect(result.value).toBe(name);
      
      const decrypted = piiManager.decryptField(result, PII_FIELD_TYPES.NAME);
      expect(decrypted).toBe(name);
    });

    test('handles encryption errors gracefully', () => {
      expect(() => {
        piiManager.encryptField('', PII_FIELD_TYPES.EMAIL);
      }).toThrow('Encryption failed for email field');
    });
  });

  describe('encryptPIIFields and decryptPIIFields', () => {
    test('encrypts multiple PII fields in object', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        publicInfo: 'Not sensitive',
      };

      const fieldMapping = {
        email: PII_FIELD_TYPES.EMAIL,
        phone: PII_FIELD_TYPES.PHONE,
      };

      const encrypted = piiManager.encryptPIIFields(userData, fieldMapping, 'user_context');
      
      expect(encrypted.name).toBe('John Doe'); // Not encrypted
      expect(encrypted.publicInfo).toBe('Not sensitive'); // Not in mapping
      expect(encrypted.email).not.toBe(userData.email); // Encrypted
      expect(encrypted.phone).not.toBe(userData.phone); // Encrypted
      
      const decrypted = piiManager.decryptPIIFields(encrypted, fieldMapping, 'user_context');
      expect(decrypted).toEqual(userData);
    });

    test('handles missing fields gracefully', () => {
      const partialData = {
        email: 'test@example.com',
        // phone field missing
      };

      const fieldMapping = {
        email: PII_FIELD_TYPES.EMAIL,
        phone: PII_FIELD_TYPES.PHONE,
      };

      const encrypted = piiManager.encryptPIIFields(partialData, fieldMapping);
      const decrypted = piiManager.decryptPIIFields(encrypted, fieldMapping);
      
      expect(decrypted.email).toBe('test@example.com');
      expect(decrypted.phone).toBeUndefined();
    });

    test('handles null and undefined values', () => {
      const dataWithNulls = {
        email: null,
        phone: undefined,
        name: '',
      };

      const fieldMapping = {
        email: PII_FIELD_TYPES.EMAIL,
        phone: PII_FIELD_TYPES.PHONE,
        name: PII_FIELD_TYPES.NAME,
      };

      const encrypted = piiManager.encryptPIIFields(dataWithNulls, fieldMapping);
      const decrypted = piiManager.decryptPIIFields(encrypted, fieldMapping);
      
      expect(decrypted.email).toBeNull();
      expect(decrypted.phone).toBeUndefined();
      expect(decrypted.name).toBe('');
    });
  });

  describe('searchable hashing', () => {
    test('creates and verifies searchable hash', () => {
      const email = 'test@EXAMPLE.com';
      const hash = piiManager.createSearchableHash(email, PII_FIELD_TYPES.EMAIL);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      
      // Should verify with normalized input
      const isValid = piiManager.verifySearchableHash('test@example.com', hash, PII_FIELD_TYPES.EMAIL);
      expect(isValid).toBe(true);
      
      // Should verify with original input (case insensitive)
      const isValidOriginal = piiManager.verifySearchableHash(email, hash, PII_FIELD_TYPES.EMAIL);
      expect(isValidOriginal).toBe(true);
      
      // Should not verify with wrong input
      const isInvalid = piiManager.verifySearchableHash('wrong@example.com', hash, PII_FIELD_TYPES.EMAIL);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('DatabaseEncryption', () => {
  let dbEncryption: DatabaseEncryption;
  const testPassword = 'test-master-password-32-characters-long';

  beforeEach(() => {
    const piiManager = new PIIDataManager(testPassword);
    // Configure to encrypt names for testing
    piiManager.setFieldEncryption(PII_FIELD_TYPES.NAME, true);
    dbEncryption = new DatabaseEncryption(piiManager);
  });

  describe('user data encryption', () => {
    test('encrypts and decrypts user data', () => {
      const userData = {
        email: 'test@example.com',
        name: 'John Doe',
        phone: '+1234567890',
        address: '123 Main St',
      };

      const encrypted = dbEncryption.encryptUserData(userData);
      
      // Check that sensitive fields are encrypted
      expect(encrypted.email).not.toBe(userData.email);
      expect(encrypted.name).not.toBe(userData.name);
      expect(encrypted.phone).not.toBe(userData.phone);
      
      const decrypted = dbEncryption.decryptUserData(encrypted);
      expect(decrypted).toEqual(userData);
    });

    test('handles partial user data', () => {
      const partialData = {
        email: 'test@example.com',
        // Other fields missing
      };

      const encrypted = dbEncryption.encryptUserData(partialData);
      const decrypted = dbEncryption.decryptUserData(encrypted);
      
      expect(decrypted.email).toBe('test@example.com');
      expect(decrypted.name).toBeUndefined();
    });
  });

  describe('audit data encryption', () => {
    test('encrypts and decrypts audit data', () => {
      const auditData = {
        companyName: 'Test Company',
        contactEmail: 'contact@testcompany.com',
        contactPhone: '+1234567890',
        notes: 'Sensitive audit notes',
      };

      const encrypted = dbEncryption.encryptAuditData(auditData);
      
      // Company name should not be encrypted (not in mapping)
      expect(encrypted.companyName).toBe(auditData.companyName);
      
      // Sensitive fields should be encrypted
      expect(encrypted.contactEmail).not.toBe(auditData.contactEmail);
      expect(encrypted.contactPhone).not.toBe(auditData.contactPhone);
      expect(encrypted.notes).not.toBe(auditData.notes);
      
      const decrypted = dbEncryption.decryptAuditData(encrypted);
      expect(decrypted).toEqual(auditData);
    });
  });
});

describe('createPIIManager', () => {
  test('creates manager for development environment', () => {
    const manager = createPIIManager('development');
    
    expect(manager).toBeInstanceOf(PIIDataManager);
    // In development, names should not be encrypted by default
    expect(manager.shouldEncryptField(PII_FIELD_TYPES.NAME)).toBe(false);
    expect(manager.shouldEncryptField(PII_FIELD_TYPES.EMAIL)).toBe(true);
  });

  test('creates manager for production environment', () => {
    // Mock environment variable for production
    const originalEnv = process.env.PII_ENCRYPTION_KEY;
    process.env.PII_ENCRYPTION_KEY = 'production-key-32-characters-long-minimum';
    
    try {
      const manager = createPIIManager('production');
      
      expect(manager).toBeInstanceOf(PIIDataManager);
      // In production, all PII fields should be encrypted
      expect(manager.shouldEncryptField(PII_FIELD_TYPES.NAME)).toBe(true);
      expect(manager.shouldEncryptField(PII_FIELD_TYPES.EMAIL)).toBe(true);
    } finally {
      // Restore original environment
      if (originalEnv) {
        process.env.PII_ENCRYPTION_KEY = originalEnv;
      } else {
        delete process.env.PII_ENCRYPTION_KEY;
      }
    }
  });

  test('throws error for production without encryption key', () => {
    // Temporarily remove encryption key
    const originalEnv = process.env.PII_ENCRYPTION_KEY;
    delete process.env.PII_ENCRYPTION_KEY;
    
    try {
      expect(() => {
        createPIIManager('production');
      }).toThrow('PII_ENCRYPTION_KEY environment variable is required in production');
    } finally {
      // Restore original environment
      if (originalEnv) {
        process.env.PII_ENCRYPTION_KEY = originalEnv;
      }
    }
  });
});

describe('Integration tests', () => {
  test('end-to-end encryption workflow', () => {
    const manager = createPIIManager('development');
    
    // Configure to encrypt names for this test
    manager.setFieldEncryption(PII_FIELD_TYPES.NAME, true);
    
    const originalData = {
      personalInfo: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        ssn: '123-45-6789',
      },
      preferences: {
        newsletter: true,
        theme: 'dark',
      },
    };

    // Encrypt personal info
    const fieldMapping = {
      name: PII_FIELD_TYPES.NAME,
      email: PII_FIELD_TYPES.EMAIL,
      ssn: PII_FIELD_TYPES.SSN,
    };

    const processedData = {
      personalInfo: manager.encryptPIIFields(
        originalData.personalInfo, 
        fieldMapping, 
        'user_profile'
      ),
      preferences: originalData.preferences, // Not encrypted
    };

    // Verify encryption
    expect(processedData.personalInfo.name).not.toBe(originalData.personalInfo.name);
    expect(processedData.personalInfo.email).not.toBe(originalData.personalInfo.email);
    expect(processedData.personalInfo.ssn).not.toBe(originalData.personalInfo.ssn);
    expect(processedData.preferences).toEqual(originalData.preferences);

    // Decrypt and verify
    const decryptedData = {
      personalInfo: manager.decryptPIIFields(
        processedData.personalInfo,
        fieldMapping,
        'user_profile'
      ),
      preferences: processedData.preferences,
    };

    expect(decryptedData).toEqual(originalData);
  });
});