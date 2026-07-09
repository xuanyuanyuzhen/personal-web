import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { LikeStatusQueryDto, ToggleLikeDto } from './like.dto';
import { LikeService } from './like.service';

@ApiTags('likes')
@Controller()
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @Post('likes/toggle')
  @ApiOperation({ summary: 'Toggle a public like.' })
  @ApiBody({ type: ToggleLikeDto })
  togglePublicLike(@Body() dto: ToggleLikeDto, @Headers('x-visitor-id') visitorId?: string) {
    return this.likeService.togglePublicLike(dto.targetType, dto.targetId, visitorId);
  }

  @Get('likes/status')
  @ApiOperation({ summary: 'Get public like status for a visitor.' })
  getPublicStatus(@Query() query: LikeStatusQueryDto, @Headers('x-visitor-id') visitorId?: string) {
    return this.likeService.getPublicStatus(query.targetType, query.targetId, visitorId);
  }

  @Get('admin/likes/summary')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Get admin like totals and recent trend.' })
  getAdminSummary() {
    return this.likeService.getAdminSummary();
  }
}
