// PII Data Encryption at Rest - Task 3.2: Security Hardening
// Comprehensive encryption for sensitive data storage and transmission

import { randomBytes, createCipher, createDecipher, createHash, pbkdf2Sync, scryptSync } from 'crypto';

export interface EncryptionConfig {
  algorithm?: string;
  keyLength?: number;
  ivLength?: number;
  saltLength?: number;
  iterations?: number;
  encoding?: BufferEncoding;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt?: string;
  algorithm: string;
  keyVersion?: number;
}

export interface PIIField {
  value: string;
  encrypted: boolean;
  algorithm?: string;
  keyVersion?: number;
}

/**
 * AES-256-GCM encryption service for PII data
 */
export class PIIEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 32; // 256 bits
  private readonly tagLength = 16; // 128 bits
  private readonly iterations = 100000; // PBKDF2 iterations
  
  private masterKey: Buffer;
  private keyVersion: number;

  constructor(masterPassword: string, keyVersion: number = 1) {
    // Derive master key from password
    this.masterKey = this.deriveKey(masterPassword, 'master_salt_v1');
    this.keyVersion = keyVersion;
  }

  /**
   * Derive encryption key from password and salt
   */
  private deriveKey(password: string, salt: string | Buffer): Buffer {
    const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'utf8') : salt;
    return scryptSync(password, saltBuffer, this.keyLength);
  }

  /**
   * Generate data encryption key (DEK) from master key
   */
  private generateDEK(context: string = 'default'): Buffer {
    const contextHash = createHash('sha256').update(context).digest();
    return createHash('sha256')
      .update(this.masterKey)
      .update(contextHash)
      .digest()
      .subarray(0, this.keyLength);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(
    plaintext: string, 
    context: string = 'default',
    additionalData?: string
  ): EncryptedData {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    try {
      // Generate unique IV for each encryption
      const iv = randomBytes(this.ivLength);
      
      // Generate data encryption key for this context
      const dek = this.generateDEK(context);
      
      // Create cipher
      const cipher = require('crypto').createCipher(this.algorithm, dek);
      cipher.setAAD(Buffer.from(additionalData || context, 'utf8'));
      
      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine encrypted data with tag
      const encryptedData = Buffer.concat([
        Buffer.from(encrypted, 'base64'),
        tag,
      ]).toString('base64');

      return {
        data: encryptedData,
        iv: iv.toString('base64'),
        algorithm: this.algorithm,
        keyVersion: this.keyVersion,
      };

    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(
    encryptedData: EncryptedData,
    context: string = 'default',
    additionalData?: string
  ): string {
    if (!encryptedData.data) {
      throw new Error('Encrypted data cannot be empty');
    }

    try {
      // Parse encrypted data and tag
      const encryptedBuffer = Buffer.from(encryptedData.data, 'base64');
      const encrypted = encryptedBuffer.subarray(0, -this.tagLength);
      const tag = encryptedBuffer.subarray(-this.tagLength);
      
      // Generate the same DEK used for encryption
      const dek = this.generateDEK(context);
      
      // Create decipher
      const decipher = require('crypto').createDecipher(encryptedData.algorithm || this.algorithm, dek);
      decipher.setAAD(Buffer.from(additionalData || context, 'utf8'));
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;

    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data for indexing/searching
   */
  hash(data: string, salt?: string): string {
    const saltBuffer = salt ? Buffer.from(salt, 'base64') : randomBytes(this.saltLength);
    const hash = pbkdf2Sync(data, saltBuffer, this.iterations, 32, 'sha256');
    
    return Buffer.concat([saltBuffer, hash]).toString('base64');
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    try {
      const combined = Buffer.from(hashedData, 'base64');
      const salt = combined.subarray(0, this.saltLength);
      const hash = combined.subarray(this.saltLength);
      
      const computedHash = pbkdf2Sync(data, salt, this.iterations, 32, 'sha256');
      
      return hash.equals(computedHash);
    } catch {
      return false;
    }
  }

  /**
   * Rotate encryption keys
   */
  rotateKey(newMasterPassword: string): PIIEncryption {
    return new PIIEncryption(newMasterPassword, this.keyVersion + 1);
  }
}

/**
 * PII field types that require encryption
 */
export const PII_FIELD_TYPES = {
  // Personal identifiers
  EMAIL: 'email',
  PHONE: 'phone',
  SSN: 'ssn',
  NAME: 'name',
  ADDRESS: 'address',
  
  // Financial information
  CREDIT_CARD: 'credit_card',
  BANK_ACCOUNT: 'bank_account',
  TAX_ID: 'tax_id',
  
  // Health information
  MEDICAL_ID: 'medical_id',
  HEALTH_DATA: 'health_data',
  
  // Sensitive business data
  API_KEY: 'api_key',
  PASSWORD: 'password',
  TOKEN: 'token',
  
  // Custom sensitive data
  CUSTOM: 'custom',
} as const;

export type PIIFieldType = typeof PII_FIELD_TYPES[keyof typeof PII_FIELD_TYPES];

/**
 * PII Data Manager - handles encryption of specific field types
 */
export class PIIDataManager {
  private encryption: PIIEncryption;
  private fieldEncryptionRules: Map<string, boolean>;

  constructor(masterPassword: string) {
    this.encryption = new PIIEncryption(masterPassword);
    this.fieldEncryptionRules = new Map();
    
    // Set default encryption rules
    this.setDefaultEncryptionRules();
  }

  /**
   * Set default field encryption rules
   */
  private setDefaultEncryptionRules(): void {
    // Always encrypt these field types
    const alwaysEncrypt = [
      PII_FIELD_TYPES.EMAIL,
      PII_FIELD_TYPES.PHONE,
      PII_FIELD_TYPES.SSN,
      PII_FIELD_TYPES.CREDIT_CARD,
      PII_FIELD_TYPES.BANK_ACCOUNT,
      PII_FIELD_TYPES.TAX_ID,
      PII_FIELD_TYPES.MEDICAL_ID,
      PII_FIELD_TYPES.HEALTH_DATA,
      PII_FIELD_TYPES.API_KEY,
      PII_FIELD_TYPES.PASSWORD,
      PII_FIELD_TYPES.TOKEN,
    ];

    alwaysEncrypt.forEach(fieldType => {
      this.fieldEncryptionRules.set(fieldType, true);
    });

    // Conditionally encrypt these (based on configuration)
    this.fieldEncryptionRules.set(PII_FIELD_TYPES.NAME, false);
    this.fieldEncryptionRules.set(PII_FIELD_TYPES.ADDRESS, false);
  }

  /**
   * Configure field encryption rules
   */
  setFieldEncryption(fieldType: PIIFieldType, shouldEncrypt: boolean): void {
    this.fieldEncryptionRules.set(fieldType, shouldEncrypt);
  }

  /**
   * Check if field type should be encrypted
   */
  shouldEncryptField(fieldType: PIIFieldType): boolean {
    return this.fieldEncryptionRules.get(fieldType) ?? false;
  }

  /**
   * Encrypt PII field
   */
  encryptField(
    value: string,
    fieldType: PIIFieldType,
    context?: string
  ): PIIField {
    if (!this.shouldEncryptField(fieldType)) {
      return {
        value,
        encrypted: false,
      };
    }

    try {
      const encryptedData = this.encryption.encrypt(
        value,
        context || fieldType,
        fieldType
      );

      return {
        value: JSON.stringify(encryptedData),
        encrypted: true,
        algorithm: encryptedData.algorithm,
        keyVersion: encryptedData.keyVersion,
      };
    } catch (error) {
      console.error(`Failed to encrypt ${fieldType} field:`, error);
      throw new Error(`Encryption failed for ${fieldType} field`);
    }
  }

  /**
   * Decrypt PII field
   */
  decryptField(
    field: PIIField,
    fieldType: PIIFieldType,
    context?: string
  ): string {
    if (!field.encrypted) {
      return field.value;
    }

    try {
      const encryptedData: EncryptedData = JSON.parse(field.value);
      return this.encryption.decrypt(
        encryptedData,
        context || fieldType,
        fieldType
      );
    } catch (error) {
      console.error(`Failed to decrypt ${fieldType} field:`, error);
      throw new Error(`Decryption failed for ${fieldType} field`);
    }
  }

  /**
   * Process object with PII fields
   */
  encryptPIIFields<T extends Record<string, any>>(
    data: T,
    fieldMapping: Record<keyof T, PIIFieldType>,
    context?: string
  ): T {
    const result = { ...data };

    Object.entries(fieldMapping).forEach(([fieldName, fieldType]) => {
      if (data[fieldName] && typeof data[fieldName] === 'string') {
        const encryptedField = this.encryptField(
          data[fieldName] as string,
          fieldType as PIIFieldType,
          context
        );
        
        // Store as encrypted field object or just the value based on encryption
        result[fieldName as keyof T] = encryptedField.encrypted 
          ? encryptedField as any
          : encryptedField.value as any;
      }
    });

    return result;
  }

  /**
   * Decrypt object with PII fields
   */
  decryptPIIFields<T extends Record<string, any>>(
    data: T,
    fieldMapping: Record<keyof T, PIIFieldType>,
    context?: string
  ): T {
    const result = { ...data };

    Object.entries(fieldMapping).forEach(([fieldName, fieldType]) => {
      const fieldValue = data[fieldName];
      
      if (fieldValue) {
        try {
          // Check if it's an encrypted field object
          let field: PIIField;
          if (typeof fieldValue === 'object' && 'encrypted' in fieldValue) {
            field = fieldValue as PIIField;
          } else if (typeof fieldValue === 'string') {
            // Try to parse as encrypted data or treat as plain text
            try {
              const parsed = JSON.parse(fieldValue);
              if (parsed.data && parsed.iv) {
                field = { value: fieldValue, encrypted: true };
              } else {
                field = { value: fieldValue, encrypted: false };
              }
            } catch {
              field = { value: fieldValue, encrypted: false };
            }
          } else {
            field = { value: String(fieldValue), encrypted: false };
          }

          result[fieldName as keyof T] = this.decryptField(
            field,
            fieldType as PIIFieldType,
            context
          ) as any;
        } catch (error) {
          console.error(`Failed to decrypt field ${fieldName}:`, error);
          // Keep original value on decryption failure
        }
      }
    });

    return result;
  }

  /**
   * Create searchable hash for encrypted field
   */
  createSearchableHash(
    value: string,
    fieldType: PIIFieldType
  ): string {
    return this.encryption.hash(value.toLowerCase().trim());
  }

  /**
   * Verify searchable hash
   */
  verifySearchableHash(
    value: string,
    hash: string,
    fieldType: PIIFieldType
  ): boolean {
    return this.encryption.verifyHash(value.toLowerCase().trim(), hash);
  }
}

/**
 * Environment-specific PII encryption configuration
 */
export function createPIIManager(env: 'development' | 'production' = 'production'): PIIDataManager {
  // In production, use a strong master password from environment
  // In development, use a default password (never use this in production!)
  const masterPassword = env === 'production' 
    ? process.env.PII_ENCRYPTION_KEY || (() => {
        throw new Error('PII_ENCRYPTION_KEY environment variable is required in production');
      })()
    : 'dev-master-key-change-in-production';

  const manager = new PIIDataManager(masterPassword);

  // Configure encryption rules based on environment
  if (env === 'development') {
    // In development, optionally encrypt fewer fields for easier debugging
    manager.setFieldEncryption(PII_FIELD_TYPES.NAME, false);
    manager.setFieldEncryption(PII_FIELD_TYPES.ADDRESS, false);
  } else {
    // In production, encrypt all PII fields
    manager.setFieldEncryption(PII_FIELD_TYPES.NAME, true);
    manager.setFieldEncryption(PII_FIELD_TYPES.ADDRESS, true);
  }

  return manager;
}

/**
 * Database encryption utilities
 */
export class DatabaseEncryption {
  private piiManager: PIIDataManager;

  constructor(piiManager: PIIDataManager) {
    this.piiManager = piiManager;
  }

  /**
   * Encrypt user data before storing in database
   */
  encryptUserData(userData: {
    email?: string;
    name?: string;
    phone?: string;
    address?: string;
  }): any {
    return this.piiManager.encryptPIIFields(userData, {
      email: PII_FIELD_TYPES.EMAIL,
      name: PII_FIELD_TYPES.NAME,
      phone: PII_FIELD_TYPES.PHONE,
      address: PII_FIELD_TYPES.ADDRESS,
    }, 'user_data');
  }

  /**
   * Decrypt user data after retrieving from database
   */
  decryptUserData(encryptedUserData: any): {
    email?: string;
    name?: string;
    phone?: string;
    address?: string;
  } {
    return this.piiManager.decryptPIIFields(encryptedUserData, {
      email: PII_FIELD_TYPES.EMAIL,
      name: PII_FIELD_TYPES.NAME,
      phone: PII_FIELD_TYPES.PHONE,
      address: PII_FIELD_TYPES.ADDRESS,
    }, 'user_data');
  }

  /**
   * Encrypt audit session data
   */
  encryptAuditData(auditData: {
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
  }): any {
    return this.piiManager.encryptPIIFields(auditData, {
      contactEmail: PII_FIELD_TYPES.EMAIL,
      contactPhone: PII_FIELD_TYPES.PHONE,
      notes: PII_FIELD_TYPES.CUSTOM,
    }, 'audit_data');
  }

  /**
   * Decrypt audit session data
   */
  decryptAuditData(encryptedAuditData: any): {
    companyName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
  } {
    return this.piiManager.decryptPIIFields(encryptedAuditData, {
      contactEmail: PII_FIELD_TYPES.EMAIL,
      contactPhone: PII_FIELD_TYPES.PHONE,
      notes: PII_FIELD_TYPES.CUSTOM,
    }, 'audit_data');
  }
}

// Export singleton instance for use across the application
let piiManagerInstance: PIIDataManager | null = null;

export function getPIIManager(): PIIDataManager {
  if (!piiManagerInstance) {
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    piiManagerInstance = createPIIManager(env);
  }
  return piiManagerInstance;
}

export function getDatabaseEncryption(): DatabaseEncryption {
  return new DatabaseEncryption(getPIIManager());
}

export {
  PIIEncryption,
  PIIDataManager,
  DatabaseEncryption,
};