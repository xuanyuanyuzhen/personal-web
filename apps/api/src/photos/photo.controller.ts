import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { CreateAlbumDto, CreatePhotoDto, PhotoQueryDto, SortPhotosDto, UpdateAlbumDto, UpdatePhotoDto } from './photo.dto';
import { PhotoService } from './photo.service';

@ApiTags('photos')
@Controller()
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Get('albums/public')
  @ApiOperation({ summary: 'List public albums.' })
  @ApiOkResponse({ description: 'Public albums.' })
  listPublicAlbums() {
    return this.photoService.listPublicAlbums();
  }

  @Get('photos/public')
  @ApiOperation({ summary: 'List public photos.' })
  listPublicPhotos(@Query() query: PhotoQueryDto, @Headers('x-visitor-id') visitorId?: string) {
    return this.photoService.listPublicPhotos(query, visitorId);
  }

  @Post('photos/public/:id/like')
  @ApiOperation({ summary: 'Toggle public photo like.' })
  togglePublicLike(@Param('id') id: string, @Headers('x-visitor-id') visitorId?: string) {
    return this.photoService.togglePublicLike(parseId(id), visitorId);
  }

  @Get('admin/albums')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  listAdminAlbums(@Query() query: PhotoQueryDto) {
    return this.photoService.listAdminAlbums(query);
  }

  @Post('admin/albums')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: CreateAlbumDto })
  createAlbum(@Body() dto: CreateAlbumDto, @Req() request: AuthenticatedRequest) {
    return this.photoService.createAlbumAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/albums/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: UpdateAlbumDto })
  updateAlbum(@Param('id') id: string, @Body() dto: UpdateAlbumDto, @Req() request: AuthenticatedRequest) {
    return this.photoService.updateAlbumAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/albums/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  disableAlbum(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.photoService.disableAlbumAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }

  @Get('admin/photos')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  listAdminPhotos(@Query() query: PhotoQueryDto) {
    return this.photoService.listAdminPhotos(query);
  }

  @Post('admin/photos')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: CreatePhotoDto })
  createPhoto(@Body() dto: CreatePhotoDto, @Req() request: AuthenticatedRequest) {
    return this.photoService.createPhotoAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/photos/sort')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: SortPhotosDto })
  sortPhotos(@Body() dto: SortPhotosDto, @Req() request: AuthenticatedRequest) {
    return this.photoService.sortPhotosAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/photos/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: UpdatePhotoDto })
  updatePhoto(@Param('id') id: string, @Body() dto: UpdatePhotoDto, @Req() request: AuthenticatedRequest) {
    return this.photoService.updatePhotoAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/photos/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  deletePhoto(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.photoService.deletePhotoAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
