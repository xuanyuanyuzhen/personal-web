import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { getRequestIp } from '../auth/request-ip';
import { RecordVisitDto } from './statistic.dto';
import { StatisticService } from './statistic.service';

@ApiTags('statistics')
@Controller()
export class StatisticController {
  constructor(private readonly statisticService: StatisticService) {}

  @Post('statistics/visit')
  @ApiOperation({ summary: 'Record a public page visit.' })
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
