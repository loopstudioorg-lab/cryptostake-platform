import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private key: Buffer;

  constructor(private configService: ConfigService) {
    const masterKey = this.configService.get<string>('encryption.masterKey');
    if (!masterKey) {
      throw new Error('MASTER_KEY environment variable is required');
    }
    // Derive a proper key from the master key using scrypt
    this.key = scryptSync(masterKey, 'crypto-stake-salt', this.keyLength);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Generate a secure random token
  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  // Hash a value (one-way)
  hash(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}
