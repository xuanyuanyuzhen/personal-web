import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { CreateTagDto, PublicTagQueryDto, TagQueryDto, UpdateTagDto } from './tag.dto';
import { TagService } from './tag.service';

@ApiTags('tags')
@Controller()
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get('tags/public')
  @ApiOperation({ summary: 'List public enabled tags.' })
  @ApiOkResponse({ description: 'Public tags.' })
  listPublic(@Query() query: PublicTagQueryDto) {
    return this.tagService.listPublic(query.scope);
  }

  @Get('admin/tags')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List tags for admin.' })
  listAdmin(@Query() query: TagQueryDto) {
    return this.tagService.listAdmin(query);
  }

  @Post('admin/tags')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create a tag.' })
  @ApiBody({ type: CreateTagDto })
  createAdmin(@Body() dto: CreateTagDto, @Req() request: AuthenticatedRequest) {
    return this.tagService.createAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/tags/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update a tag.' })
  @ApiBody({ type: UpdateTagDto })
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateTagDto, @Req() request: AuthenticatedRequest) {
    return this.tagService.updateAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/tags/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Disable a tag and add recycle-bin record.' })
  deleteAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.tagService.deleteAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
