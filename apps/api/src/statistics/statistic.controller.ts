import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { getRequestIp } from '../auth/request-ip';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { RecordVisitDto } from './statistic.dto';
import { StatisticService } from './statistic.service';

@ApiTags('statistics')
@Controller()
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Post('statistics/visit')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowMs: 60 * 1000 })
  @ApiOperation({ summary: 'Record a public page visit.' })
  @ApiTooManyRequestsResponse({ description: 'Too many visit records from this address.' })
  @ApiBody({ type: RecordVisitDto })
  recordVisit(
    @Body() dto: RecordVisitDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    return this.statisticService.recordVisit(dto, getRequestIp(request), userAgent);
  }

  @Get('admin/statistics')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Get admin dashboard visit and like statistics.' })
  getDashboardStatistics() {
    return this.statisticService.getDashboardStatistics();
  }
}
