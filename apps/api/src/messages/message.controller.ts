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
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { AUTH_COOKIE_NAME } from '../auth/auth.constants';
import { AuthenticatedRequest } from '../auth/auth.types';
import { getRequestIp } from '../auth/request-ip';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import {
  AuditMessageDto,
  CreateCommentDto,
  CreateBlacklistItemDto,
  CreateForbiddenWordDto,
  CreateMessageDto,
  ListCommentDto,
  ListMessageDto,
  ListModerationDto,
  ReplyCommentDto,
  UpdateCommentDto,
  UpdateBlacklistItemDto,
  UpdateForbiddenWordDto,
} from './message.dto';
import { MessageService } from './message.service';

@ApiTags('messages')
@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('messages')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 10 * 60 * 1000 })
  @ApiOperation({ summary: 'Submit a visitor message.' })
  @ApiTooManyRequestsResponse({ description: 'Too many submissions from this address.' })
  @ApiBody({ type: CreateMessageDto })
  submitMessage(
    @Body() dto: CreateMessageDto,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    return this.messageService.submitMessage(dto, visitorId, getRequestIp(request), userAgent);
  }

  @Get('messages/public')
  @ApiOperation({ summary: 'List approved public messages.' })
  listPublicMessages(@Query() query: ListMessageDto) {
    return this.messageService.listPublicMessages(query);
  }

  @Post('comments')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 10 * 60 * 1000 })
  @ApiOperation({ summary: 'Submit a visitor essay comment.' })
  @ApiTooManyRequestsResponse({ description: 'Too many submissions from this address.' })
  @ApiBody({ type: CreateCommentDto })
  submitComment(
    @Body() dto: CreateCommentDto,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() request: Request,
  ) {
    return this.messageService.submitComment(dto, visitorId, getRequestIp(request), userAgent);
  }

  @Get('comments/public')
  @ApiOperation({ summary: 'List approved public comments for an essay.' })
  listPublicComments(@Query() query: ListCommentDto) {
    return this.messageService.listPublicComments(query);
  }

  @Get('admin/messages')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List messages for admin audit.' })
  listAdminMessages(@Query() query: ListMessageDto) {
    return this.messageService.listAdminMessages(query);
  }

  @Put('admin/messages/:id/audit')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Approve or reject a message.' })
  @ApiBody({ type: AuditMessageDto })
  auditMessage(
    @Param('id') id: string,
    @Body() dto: AuditMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messageService.auditMessage(
      parseId(id),
      dto,
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Delete('admin/messages/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Move a message to recycle bin.' })
  deleteMessage(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.messageService.deleteMessageAdmin(
      parseId(id),
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Get('admin/comments')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'List comments for admin moderation.' })
  listAdminComments(@Query() query: ListCommentDto) {
    return this.messageService.listAdminComments(query);
  }

  @Put('admin/comments/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: UpdateCommentDto })
  updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messageService.updateCommentAdmin(
      parseId(id),
      dto,
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Put('admin/comments/:id/audit')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Approve or reject a comment.' })
  @ApiBody({ type: AuditMessageDto })
  auditComment(
    @Param('id') id: string,
    @Body() dto: AuditMessageDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messageService.auditComment(
      parseId(id),
      dto,
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Post('admin/comments/:id/reply')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: ReplyCommentDto })
  replyComment(
    @Param('id') id: string,
    @Body() dto: ReplyCommentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messageService.replyCommentAdmin(
      parseId(id),
      dto,
      request.admin,
      getRequestIp(request),
    );
  }

  @Delete('admin/comments/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  deleteComment(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.messageService.deleteCommentAdmin(
      parseId(id),
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Get('admin/forbidden-words')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  listForbiddenWords(@Query() query: ListModerationDto) {
    return this.messageService.listForbiddenWords(query);
  }

  @Post('admin/forbidden-words')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: CreateForbiddenWordDto })
  createForbiddenWord(@Body() dto: CreateForbiddenWordDto, @Req() request: AuthenticatedRequest) {
    return this.messageService.createForbiddenWord(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/forbidden-words/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: UpdateForbiddenWordDto })
  updateForbiddenWord(
    @Param('id') id: string,
    @Body() dto: UpdateForbiddenWordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messageService.updateForbiddenWord(
      parseId(id),
      dto,
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Delete('admin/forbidden-words/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  deleteForbiddenWord(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.messageService.deleteForbiddenWord(
      parseId(id),
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Get('admin/blacklist')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  listBlacklistItems(@Query() query: ListModerationDto) {
    return this.messageService.listBlacklistItems(query);
  }

  @Post('admin/blacklist')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: CreateBlacklistItemDto })
  createBlacklistItem(@Body() dto: CreateBlacklistItemDto, @Req() request: AuthenticatedRequest) {
    return this.messageService.createBlacklistItem(dto, request.admin.id, getRequestIp(request));
  }

  @Put('admin/blacklist/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBody({ type: UpdateBlacklistItemDto })
  updateBlacklistItem(
    @Param('id') id: string,
    @Body() dto: UpdateBlacklistItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.messageService.updateBlacklistItem(
      parseId(id),
      dto,
      request.admin.id,
      getRequestIp(request),
    );
  }

  @Delete('admin/blacklist/:id')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  deleteBlacklistItem(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.messageService.deleteBlacklistItem(
      parseId(id),
      request.admin.id,
      getRequestIp(request),
    );
  }
}

function parseId(id: string): number {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Invalid id.');
  }

  return parsed;
}
