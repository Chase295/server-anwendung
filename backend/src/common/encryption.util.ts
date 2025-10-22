import * as CryptoJS from 'crypto-js';

/**
 * Encryption Utility für Secret-Management
 * Verwendet AES-256 zur Verschlüsselung sensibler Daten in der Datenbank
 */
export class EncryptionUtil {
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-this-in-prod';

  /**
   * Verschlüsselt einen String
   */
  static encrypt(plainText: string): string {
    if (!plainText) return plainText;
    
    try {
      const encrypted = CryptoJS.AES.encrypt(plainText, this.ENCRYPTION_KEY);
      return encrypted.toString();
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Entschlüsselt einen String
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, this.ENCRYPTION_KEY);
      const plainText = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plainText) {
        throw new Error('Decryption resulted in empty string - wrong key?');
      }
      
      return plainText;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Verschlüsselt ein Objekt (konvertiert zu JSON)
   */
  static encryptObject(obj: any): string {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Entschlüsselt ein Objekt (parst JSON)
   */
  static decryptObject<T = any>(encryptedText: string): T {
    const json = this.decrypt(encryptedText);
    return JSON.parse(json) as T;
  }

  /**
   * Validiert, ob der Encryption-Key gesetzt ist
   */
  static validateKey(): boolean {
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'default-key-change-this-in-prod') {
      return false;
    }
    return process.env.ENCRYPTION_KEY.length >= 32;
  }

  /**
   * Gibt eine Warnung aus, wenn der Default-Key verwendet wird
   */
  static checkKeyWarning(): void {
    if (!this.validateKey()) {
      console.warn(
        '⚠️  WARNING: Using default or weak encryption key! ' +
        'Please set ENCRYPTION_KEY environment variable with at least 32 characters.'
      );
    }
  }
}

