'use client';

import { useCallback, useState } from 'react';

export type UsePaginationOptions = {
  initialPage?: number;
  pageSize?: number;
  total?: number;
  /** Use cursor-based pagination (if API supports) */
  cursorBased?: boolean;
};

export type UsePaginationReturn = {
  page: number;
  pageSize: number;
  cursor: string | null;
  setPage: (p: number) => void;
  setCursor: (c: string | null) => void;
  next: () => void;
  prev: () => void;
  hasMore: boolean;
  hasPrev: boolean;
  offset: number;
};

/**
 * Offset-based and cursor-based pagination.
 * Replaces manual pagination in admin/users, audit, compliance/keys, inspection.
 */
export function usePagination(opts: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    pageSize: ps = 20,
    total = 0,
    cursorBased = false,
  } = opts;

  const [page, setPageState] = useState(initialPage);
  const [cursor, setCursor] = useState<string | null>(null);
  const pageSize = ps;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasMore = cursorBased ? true : page < totalPages;
  const hasPrev = page > 1;

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(1, p));
  }, []);

  const next = useCallback(() => {
    setPageState((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prev = useCallback(() => {
    setPageState((p) => Math.max(p - 1, 1));
  }, []);

  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    cursor,
    setPage,
    setCursor,
    next,
    prev,
    hasMore,
    hasPrev,
    offset,
  };
}
