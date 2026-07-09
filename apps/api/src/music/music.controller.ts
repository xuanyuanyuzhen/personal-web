import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { CreateMusicDto, MusicQueryDto, UpdateMusicDto } from './music.dto';
import { MusicService } from './music.service';

@ApiTags('music')
@Controller()
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Get('music/public')
  @ApiOperation({ summary: 'List enabled public music tracks.' })
  listPublic() {
    return this.musicService.listPublic();
  }

  @Get('admin/music')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List music tracks for admin.' })
  listAdmin(@Query() query: MusicQueryDto) {
    return this.musicService.listAdmin(query);
  }

  @Post('admin/music')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create a music track.' })
  @ApiBody({ type: CreateMusicDto })
  createAdmin(@Body() dto: CreateMusicDto, @Req() request: AuthenticatedRequest) {
    return this.musicService.createAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/music/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update a music track.' })
  @ApiBody({ type: UpdateMusicDto })
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateMusicDto, @Req() request: AuthenticatedRequest) {
    return this.musicService.updateAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/music/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Delete a music track into recycle bin.' })
  deleteAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.musicService.deleteAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
