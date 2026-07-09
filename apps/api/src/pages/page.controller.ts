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
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { isAuthenticatedAdminPreview } from '../auth/admin-preview';
import { AdminPreviewGuard } from '../auth/admin-preview.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest, MaybeAuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { CreatePageDto, PageQueryDto, UpdatePageDto } from './page.dto';
import { PageService } from './page.service';

@ApiTags('pages')
@Controller()
export class PageController {
  constructor(private readonly pageService: PageService) {}

  @Get('pages/public/:slug')
  @UseGuards(AdminPreviewGuard)
  @ApiOperation({ summary: 'Get a published public custom page by slug.' })
  @ApiOkResponse({ description: 'Public page detail.' })
  getPublicBySlug(@Param('slug') slug: string, @Req() request: MaybeAuthenticatedRequest) {
    return this.pageService.getPublicBySlug(slug, isAuthenticatedAdminPreview(request));
  }

  @Get('admin/pages')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List custom pages for admin.' })
  @ApiOkResponse({ description: 'Paginated page list.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  listAdmin(@Query() query: PageQueryDto) {
    return this.pageService.listAdmin(query);
  }

  @Post('admin/pages')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create a custom page.' })
  @ApiBody({ type: CreatePageDto })
  createAdmin(@Body() dto: CreatePageDto, @Req() request: AuthenticatedRequest) {
    return this.pageService.createAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/pages/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update a custom page.' })
  @ApiBody({ type: UpdatePageDto })
  updateAdmin(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.pageService.updateAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/pages/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Move a custom page to recycle bin.' })
  deleteAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.pageService.deleteAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
