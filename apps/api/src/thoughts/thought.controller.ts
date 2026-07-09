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
import { CreateThoughtDto, ThoughtQueryDto, UpdateThoughtDto } from './thought.dto';
import { ThoughtService } from './thought.service';

@ApiTags('thoughts')
@Controller()
export class ThoughtController {
  constructor(private readonly thoughtService: ThoughtService) {}

  @Get('thoughts/public')
  @ApiOperation({ summary: 'List published public thoughts.' })
  @ApiOkResponse({ description: 'Paginated public thoughts.' })
  listPublic(@Query() query: ThoughtQueryDto, @Headers('x-visitor-id') visitorId?: string) {
    return this.thoughtService.listPublic(query, visitorId);
  }

  @Get('thoughts/tags/public')
  @ApiOperation({ summary: 'List public thought tags.' })
  @ApiOkResponse({ description: 'Public thought tags.' })
  listPublicTags() {
    return this.thoughtService.listPublicTags();
  }

  @Post('thoughts/public/:id/like')
  @ApiOperation({ summary: 'Toggle a public thought like.' })
  @ApiOkResponse({ description: 'Updated like state.' })
  togglePublicLike(@Param('id') id: string, @Headers('x-visitor-id') visitorId?: string) {
    return this.thoughtService.togglePublicLike(parseId(id), visitorId);
  }

  @Get('admin/thoughts')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List thoughts for admin.' })
  @ApiOkResponse({ description: 'Paginated admin thoughts.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  listAdmin(@Query() query: ThoughtQueryDto) {
    return this.thoughtService.listAdmin(query);
  }

  @Post('admin/thoughts')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Create a thought.' })
  @ApiBody({ type: CreateThoughtDto })
  createAdmin(@Body() dto: CreateThoughtDto, @Req() request: AuthenticatedRequest) {
    return this.thoughtService.createAdmin(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/thoughts/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Update a thought.' })
  @ApiBody({ type: UpdateThoughtDto })
  updateAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateThoughtDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.thoughtService.updateAdmin(parseId(id), dto, request.admin.id, getRequestIp(request));
  }

  @Delete('admin/thoughts/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Move a thought to recycle bin.' })
  deleteAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.thoughtService.deleteAdmin(parseId(id), request.admin.id, getRequestIp(request));
  }
}

function parseId(id: string): number {
  const parsed = Number(id);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
