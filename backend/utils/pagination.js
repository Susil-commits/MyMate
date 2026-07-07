export function buildPagination(total, page, limit) {
  return {
    page,
    pages: Math.max(Math.ceil(total / limit) || 1, 1),
    total,
  };
}
