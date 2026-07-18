// @ts-nocheck
export function buildPagination(total: number, page: number, limit: number) {
  return {
    page,
    pages: Math.max(Math.ceil(total / limit) || 1, 1),
    total,
  };
}
