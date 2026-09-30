export function parsePaginationParams(query) {
  const limit = query.limit ? parseInt(query.limit, 10) : 100;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  return { limit, offset };
}

export function validatePaginationParams(limit, offset) {
  if (Number.isNaN(limit) || limit < 1) {
    return { error: 'Invalid limit parameter. Must be a positive integer.' };
  }

  if (limit > 500) {
    return { error: 'Invalid limit parameter. Must not exceed 500.' };
  }

  if (Number.isNaN(offset) || offset < 0) {
    return { error: 'Invalid offset parameter. Must be a non-negative integer.' };
  }

  return null;
}
