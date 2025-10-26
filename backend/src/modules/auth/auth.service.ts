import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { Secret, SecretDocument } from './schemas/secret.schema';
import { User, UserDocument } from './schemas/user.schema';
import { EncryptionUtil } from '../../common/encryption.util';
import { AppLogger } from '../../common/logger';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new AppLogger('AuthService');
  private readonly jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret';

  constructor(
    @InjectModel(Secret.name) private secretModel: Model<SecretDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    EncryptionUtil.checkKeyWarning();
  }

  /**
   * NestJS Lifecycle Hook - wird NACH vollständiger Modulinitialisierung aufgerufen
   */
  async onModuleInit() {
    // User-Initialisierung erfolgt jetzt lazy beim ersten Login
    this.logger.info('AuthService initialized');
  }

  /**
   * Initialisiert Standard-Admin-User, falls noch keiner existiert
   * Wird lazy beim ersten Login-Versuch aufgerufen
   */
  private async ensureDefaultUser(): Promise<void> {
    try {
      // Warte kurz, falls die DB-Verbindung noch nicht bereit ist
      const maxRetries = 3;
      let retries = 0;
      
      while (retries < maxRetries) {
        try {
          const userCount = await this.userModel.countDocuments();
          
          if (userCount === 0) {
            const defaultPassword = process.env.ADMIN_PASSWORD || 'admin';
            const passwordHash = await bcrypt.hash(defaultPassword, 10);
            
            await this.userModel.create({
              username: 'admin',
              passwordHash,
              role: 'admin',
            });
            
            this.logger.info('Default admin user created', { username: 'admin' });
          }
          break; // Erfolgreich, beende Schleife
        } catch (dbError) {
          retries++;
          if (retries >= maxRetries) {
            throw dbError;
          }
          // Warte 500ms vor erneutem Versuch
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      this.logger.error('Failed to create default user after retries', error.message);
      throw error;
    }
  }

  /**
   * Admin-Login für Web-UI
   */
  async login(username: string, password: string): Promise<{ token: string; user: any }> {
    // Stelle sicher, dass der Default-User existiert (lazy initialization)
    await this.ensureDefaultUser();

    const user = await this.userModel.findOne({ username, active: true });
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      this.jwtSecret,
      { expiresIn: '24h' }
    );

    this.logger.info('User logged in', { username });

    return {
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
      },
    };
  }

  /**
   * Validiert JWT-Token
   */
  async validateToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Client-Secret-Authentifizierung für ESP32-Clients
   * Unterstützt jetzt:
   * 1. Globaler API_KEY aus .env (SIMPLE_API_KEY)
   * 2. Device-spezifische Secrets (client_secret_${clientId})
   */
  async validateClientSecret(clientId: string, secret: string): Promise<boolean> {
    try {
      // 1. Prüfe globalen API Key (für einfache Nutzung)
      const globalApiKey = process.env.SIMPLE_API_KEY;
      if (globalApiKey && secret === globalApiKey) {
        this.logger.info('Client authenticated with global API key', { clientId });
        return true;
      }
      
      // 2. Prüfe device-spezifisches Secret
      const secretKey = `client_secret_${clientId}`;
      const storedSecret = await this.getSecret(secretKey);
      
      if (!storedSecret) {
        this.logger.warn('Client secret not found', { clientId });
        return false;
      }

      const isValid = storedSecret === secret;
      
      if (isValid) {
        this.logger.info('Client authenticated successfully', { clientId });
      } else {
        this.logger.warn('Client authentication failed - invalid secret', { clientId });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Client authentication error', error.message, { clientId });
      return false;
    }
  }

  /**
   * Speichert ein Secret (verschlüsselt)
   */
  async saveSecret(key: string, value: string, type: string, description?: string): Promise<void> {
    try {
      const encryptedValue = EncryptionUtil.encrypt(value);
      
      await this.secretModel.findOneAndUpdate(
        { key },
        {
          key,
          encryptedValue,
          type,
          description,
          active: true,
        },
        { upsert: true, new: true }
      );

      this.logger.info('Secret saved', { key, type });
    } catch (error) {
      this.logger.error('Failed to save secret', error.message, { key });
      throw error;
    }
  }

  /**
   * Holt ein Secret (entschlüsselt)
   */
  async getSecret(key: string): Promise<string | null> {
    try {
      const secret = await this.secretModel.findOne({ key, active: true });
      
      if (!secret) {
        return null;
      }

      return EncryptionUtil.decrypt(secret.encryptedValue);
    } catch (error) {
      this.logger.error('Failed to get secret', error.message, { key });
      throw error;
    }
  }

  /**
   * Löscht ein Secret
   */
  async deleteSecret(key: string): Promise<void> {
    try {
      await this.secretModel.deleteOne({ key });
      this.logger.info('Secret deleted', { key });
    } catch (error) {
      this.logger.error('Failed to delete secret', error.message, { key });
      throw error;
    }
  }

  /**
   * Listet alle Secrets (ohne Werte)
   */
  async listSecrets(): Promise<Array<{ key: string; type: string; description?: string }>> {
    const secrets = await this.secretModel.find({ active: true }).select('key type description');
    return secrets.map(s => ({
      key: s.key,
      type: s.type,
      description: s.description,
    }));
  }

  /**
   * Ändert die Admin-Credentials (Benutzername und/oder Passwort)
   */
  async changeAdminCredentials(
    currentUsername: string,
    currentPassword: string,
    newUsername?: string,
    newPassword?: string
  ): Promise<void> {
    // Validiere zuerst die aktuellen Credentials
    const user = await this.userModel.findOne({ username: currentUsername, active: true });
    
    if (!user) {
      throw new UnauthorizedException('Invalid current credentials');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid current credentials');
    }

    // Mindestens ein neuer Wert muss angegeben sein
    if (!newUsername && !newPassword) {
      throw new Error('At least username or password must be provided');
    }

    // Update Username (falls angegeben)
    if (newUsername && newUsername !== currentUsername) {
      // Prüfe ob der neue Username bereits existiert
      const existingUser = await this.userModel.findOne({ username: newUsername });
      if (existingUser) {
        throw new Error('Username already exists');
      }
      user.username = newUsername;
      this.logger.info('Admin username changed', { oldUsername: currentUsername, newUsername });
    }

    // Update Password (falls angegeben)
    if (newPassword) {
      // Validiere Passwort-Stärke (mindestens 4 Zeichen)
      if (newPassword.length < 4) {
        throw new Error('Password must be at least 4 characters long');
      }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
      this.logger.info('Admin password changed', { username: user.username });
    }

    await user.save();
    this.logger.info('Admin credentials updated successfully', { username: user.username });
  }
}

