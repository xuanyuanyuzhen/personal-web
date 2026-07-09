import { BadRequestException, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { OperationLogService } from '../operation-log/operation-log.service';
import { OperationLogQueryDto, RecycleBinQueryDto } from './recycle-bin.dto';
import { RecycleBinService } from './recycle-bin.service';

@ApiTags('recycle-bin')
@Controller('admin')
@UseGuards(AdminAuthGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
export class RecycleBinController {
  constructor(
    private readonly recycleBinService: RecycleBinService,
    private readonly operationLogService: OperationLogService,
  ) {}

  @Get('recycle-bin')
  @ApiOperation({ summary: 'List active recycle-bin items.' })
  listRecycleBin(@Query() query: RecycleBinQueryDto) {
    return this.recycleBinService.list(query);
  }

  @Post('recycle-bin/:id/restore')
  @ApiOperation({ summary: 'Restore a recycle-bin item.' })
  restore(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.recycleBinService.restore(parseId(id), request.admin.id, getRequestIp(request));
  }

  @Delete('recycle-bin/:id/purge')
  @ApiOperation({ summary: 'Permanently delete a recycle-bin item.' })
  purge(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.recycleBinService.purge(parseId(id), request.admin.id, getRequestIp(request));
  }

  @Get('operation-logs')
  @ApiOperation({ summary: 'List operation logs.' })
  listOperationLogs(@Query() query: OperationLogQueryDto) {
    return this.operationLogService.list(query);
  }
}

function parseId(id: string): number {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
