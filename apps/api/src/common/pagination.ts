import { BadRequestException } from '@nestjs/common';

export type PaginationQuery = {
  page?: string | number;
  pageSize?: string | number;
  search?: string;
};

export type Pagination = {
  page: number;
  pageSize: number;
  skip: number;
  search?: string;
};

export function parsePagination(query: PaginationQuery): Pagination {
  const page = parsePositiveInteger(query.page ?? 1, 'page');
  const pageSize = parsePositiveInteger(query.pageSize ?? 20, 'pageSize');

  if (pageSize > 100) {
    throw new BadRequestException('pageSize must be less than or equal to 100.');
  }

  const search = query.search?.trim() || undefined;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    search,
  };
}

function parsePositiveInteger(value: string | number, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return parsed;
}
