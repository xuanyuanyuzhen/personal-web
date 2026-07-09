import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isAuthenticatedAdminPreview } from '../auth/admin-preview';
import { AdminPreviewGuard } from '../auth/admin-preview.guard';
import { MaybeAuthenticatedRequest } from '../auth/auth.types';
import { PublicSearchQueryDto } from './search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search/public')
  @UseGuards(AdminPreviewGuard)
  @ApiOperation({ summary: 'Search published public content by section.' })
  @ApiOkResponse({ description: 'Sectioned public search results.' })
  searchPublic(@Query() query: PublicSearchQueryDto, @Req() request: MaybeAuthenticatedRequest) {
    return this.searchService.searchPublic(query, isAuthenticatedAdminPreview(request));
  }
}
