import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import {
  CreateEssayCategoryDto,
  CreateEssayDto,
  EssayQueryDto,
  UpdateEssayCategoryDto,
  UpdateEssayDto,
} from './essay.dto';
import { EssayService } from './essay.service';

@ApiTags('essays')
@Controller()
export class EssayController {
  constructor(private readonly essayService: EssayService) {}

  @Get('essays/categories/public')
  @ApiOperation({ summary: 'List public essay categories.' })
  @ApiOkResponse({ description: 'Public essay categories.' })
  listPublicCategories() {
    return this.essayService.listPublicCategories();
  }

  @Get('essays/public')
  @ApiOperation({ summary: 'List published public essays.' })
  @ApiOkResponse({ description: 'Paginated public essays.' })
  listPublic(@Query() query: EssayQueryDto, @Headers('x-visitor-id') visitorId?: string) {
    return this.essayService.listPublic(query, visitorId);
  }

  @Get('essays/public/:idOrSlug')
  @ApiOperation({ summary: 'Get a published public essay detail.' })
  @ApiOkResponse({ description: 'Public essay detail.' })
  getPublicDetail(@Param('idOrSlug') idOrSlug: string, @Headers('x-visitor-id') visitorId?: string) {
    return this.essayService.getPublicDetail(idOrSlug, visitorId);
  }

  @Post('essays/public/:id/like')
  @ApiOperation({ summary: 'Toggle a public essay like.' })
  @ApiOkResponse({ description: 'Updated like state.' })
  togglePublicLike(@Param('id') id: string, @Headers('x-visitor-id') visitorId?: string) {
    return this.essayService.togglePublicLike(parseId(id), visitorId);
  }

  @Get('admin/essay-categories')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List essay categories for admin.' })
  listAdminCategories() {
    return this.essayService.listAdminCategories();
  }

  @Post('admin/essay-categories')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create an essay category.' })
  @ApiBody({ type: CreateEssayCategoryDto })
  createCategory(@Body() dto: CreateEssayCategoryDto, @Req() request: AuthenticatedRequest) {
    return this.essayService.createCategoryAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/essay-categories/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update an essay category.' })
  @ApiBody({ type: UpdateEssayCategoryDto })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateEssayCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.essayService.updateCategoryAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/essay-categories/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Disable an essay category.' })
  disableCategory(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.essayService.disableCategoryAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }

  @Get('admin/essays')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List essays for admin.' })
  listAdmin(@Query() query: EssayQueryDto) {
    return this.essayService.listAdmin(query);
  }

  @Post('admin/essays')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create an essay.' })
  @ApiBody({ type: CreateEssayDto })
  createAdmin(@Body() dto: CreateEssayDto, @Req() request: AuthenticatedRequest) {
    return this.essayService.createAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/essays/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update an essay.' })
  @ApiBody({ type: UpdateEssayDto })
  updateAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateEssayDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.essayService.updateAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/essays/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Move an essay to recycle bin.' })
  deleteAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.essayService.deleteAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
