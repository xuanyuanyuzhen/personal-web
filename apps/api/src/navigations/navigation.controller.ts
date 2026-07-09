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
import { CreateNavigationDto, NavigationQueryDto, UpdateNavigationDto } from './navigation.dto';
import { NavigationService } from './navigation.service';

@ApiTags('navigations')
@Controller()
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('navigations/public')
  @UseGuards(AdminPreviewGuard)
  @ApiOperation({ summary: 'Get public navigation tree.' })
  @ApiOkResponse({ description: 'Public navigation tree.' })
  listPublic(@Req() request: MaybeAuthenticatedRequest) {
    return this.navigationService.listPublic(isAuthenticatedAdminPreview(request));
  }

  @Get('admin/navigations')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List navigations for admin.' })
  @ApiOkResponse({ description: 'Paginated navigation list.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  listAdmin(@Query() query: NavigationQueryDto) {
    return this.navigationService.listAdmin(query);
  }

  @Post('admin/navigations')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create a navigation item.' })
  @ApiBody({ type: CreateNavigationDto })
  createAdmin(@Body() dto: CreateNavigationDto, @Req() request: AuthenticatedRequest) {
    return this.navigationService.createAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/navigations/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update a navigation item.' })
  @ApiBody({ type: UpdateNavigationDto })
  updateAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateNavigationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.navigationService.updateAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/navigations/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Move a navigation item to recycle bin.' })
  deleteAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.navigationService.deleteAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
