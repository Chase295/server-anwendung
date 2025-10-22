import { Controller, Post, Get, Delete, Body, Param, UseGuards, Put, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AppLogger } from '../../common/logger';

/**
 * Auth-Controller für Admin-Login und Secret-Management
 */
@Controller('auth')
export class AuthController {
  private readonly logger = new AppLogger('AuthController');

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }, @Req() req: any) {
    const ip = req.ip || req.connection.remoteAddress;
    
    this.logger.info('🔐 Login attempt', { 
      username: body.username,
      ip: ip
    });
    
    try {
      const result = await this.authService.login(body.username, body.password);
      
      this.logger.info('✅ Login successful', { 
        username: body.username,
        ip: ip,
        role: result.user.role
      });
      
      return result;
    } catch (error) {
      this.logger.warn('❌ Login failed', { 
        username: body.username,
        ip: ip,
        error: error.message
      });
      throw error;
    }
  }

  @Put('admin/credentials')
  async changeAdminCredentials(
    @Body() body: {
      currentUsername: string;
      currentPassword: string;
      newUsername?: string;
      newPassword?: string;
    },
    @Req() req: any
  ) {
    const ip = req.ip || req.connection.remoteAddress;
    
    this.logger.warn('🔑 Admin credentials change attempt', { 
      currentUsername: body.currentUsername,
      newUsername: body.newUsername || '(unchanged)',
      passwordChange: !!body.newPassword,
      ip: ip
    });
    
    try {
      await this.authService.changeAdminCredentials(
        body.currentUsername,
        body.currentPassword,
        body.newUsername,
        body.newPassword
      );
      
      this.logger.warn('✅ Admin credentials changed successfully', { 
        oldUsername: body.currentUsername,
        newUsername: body.newUsername || body.currentUsername,
        passwordChanged: !!body.newPassword,
        ip: ip
      });
      
      return { success: true, message: 'Credentials updated successfully' };
    } catch (error) {
      this.logger.error('❌ Failed to change admin credentials', error.message, { 
        currentUsername: body.currentUsername,
        ip: ip
      });
      return { success: false, message: error.message };
    }
  }

  // TODO: Add AuthGuard für geschützte Routen
  @Get('secrets')
  async listSecrets() {
    this.logger.info('📋 Listing all secrets');
    return this.authService.listSecrets();
  }

  @Post('secrets')
  async saveSecret(
    @Body() body: { key: string; value: string; type: string; description?: string }
  ) {
    this.logger.info('🔐 Saving secret', { 
      key: body.key, 
      type: body.type,
      description: body.description
    });
    
    await this.authService.saveSecret(body.key, body.value, body.type, body.description);
    
    this.logger.info('✅ Secret saved successfully', { key: body.key });
    
    return { success: true };
  }

  @Delete('secrets/:key')
  async deleteSecret(@Param('key') key: string) {
    this.logger.warn('🗑️  Deleting secret', { key });
    
    await this.authService.deleteSecret(key);
    
    this.logger.info('✅ Secret deleted successfully', { key });
    
    return { success: true };
  }
}

