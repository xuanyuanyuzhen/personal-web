import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { CreateMascotLineDto, MascotPublicQueryDto, UpdateMascotConfigDto, UpdateMascotLineDto } from './mascot.dto';
import { MascotService } from './mascot.service';

@ApiTags('mascot')
@Controller()
export class MascotController {
  constructor(private readonly mascotService: MascotService) {}

  @Get('mascot/public')
  @ApiOperation({ summary: 'Get public mascot config for a page.' })
  getPublicConfig(@Query() query: MascotPublicQueryDto) {
    return this.mascotService.getPublicConfig(query.pageKey);
  }

  @Get('admin/mascot/config')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Get mascot config for admin.' })
  getAdminConfig() {
    return this.mascotService.getAdminConfig();
  }

  @Put('admin/mascot/config')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update mascot config.' })
  @ApiBody({ type: UpdateMascotConfigDto })
  updateAdminConfig(@Body() dto: UpdateMascotConfigDto, @Req() request: AuthenticatedRequest) {
    return this.mascotService.updateAdminConfig(dto, request.admin.id, getRequestIp(request));
  }

  @Get('admin/mascot/lines')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List mascot page and random lines.' })
  listAdminLines() {
    return this.mascotService.listAdminLines();
  }

  @Post('admin/mascot/lines')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create a mascot line.' })
  @ApiBody({ type: CreateMascotLineDto })
  createAdminLine(@Body() dto: CreateMascotLineDto, @Req() request: AuthenticatedRequest) {
    return this.mascotService.createAdminLine(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/mascot/lines/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update a mascot line.' })
  @ApiBody({ type: UpdateMascotLineDto })
  updateAdminLine(@Param('id') id: string, @Body() dto: UpdateMascotLineDto, @Req() request: AuthenticatedRequest) {
    return this.mascotService.updateAdminLine(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/mascot/lines/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Delete a mascot line.' })
  deleteAdminLine(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.mascotService.deleteAdminLine(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return id;
}
