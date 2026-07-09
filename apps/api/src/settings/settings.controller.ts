import { Body, Controller, Get, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { SettingsService, type UploadedAvatarFile } from './settings.service';
import { UpdateAnnouncementDto, UpdateSiteSettingsDto } from './settings.dto';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('site/settings')
  @ApiOperation({ summary: 'Get public site settings.' })
  @ApiOkResponse({ description: 'Public site settings.' })
  getSiteSettings() {
    return this.settingsService.getSiteSettings();
  }

  @Put('admin/settings')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update site settings.' })
  @ApiBody({ type: UpdateSiteSettingsDto })
  @ApiOkResponse({ description: 'Updated site settings.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  updateSiteSettings(@Body() dto: UpdateSiteSettingsDto, @Req() request: AuthenticatedRequest) {
    return this.settingsService.updateSiteSettings(dto, request.admin.id, getRequestIp(request));
  }

  @Post('admin/settings/avatar')
  @UseGuards(AdminAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Upload avatar and save avatar URL setting.' })
  @ApiOkResponse({ description: 'Updated site settings.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  uploadAvatar(@UploadedFile() file: UploadedAvatarFile | undefined, @Req() request: AuthenticatedRequest) {
    return this.settingsService.uploadAvatar(file, request.admin.id, getRequestIp(request));
  }

  @Get('site/announcement')
  @ApiOperation({ summary: 'Get enabled home announcement.' })
  @ApiOkResponse({ description: 'Enabled home announcement or null.' })
  getPublicAnnouncement() {
    return this.settingsService.getPublicAnnouncement();
  }

  @Get('admin/announcement')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Get home announcement for admin.' })
  @ApiOkResponse({ description: 'Home announcement detail.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  getAdminAnnouncement() {
    return this.settingsService.getAdminAnnouncement();
  }

  @Put('admin/announcement')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update home announcement.' })
  @ApiBody({ type: UpdateAnnouncementDto })
  @ApiOkResponse({ description: 'Updated announcement.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  updateAnnouncement(@Body() dto: UpdateAnnouncementDto, @Req() request: AuthenticatedRequest) {
    return this.settingsService.updateAnnouncement(dto, request.admin.id, getRequestIp(request));
  }
}
