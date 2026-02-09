'use client';

import type { ReactNode } from 'react';

export type DataTableColumn<T extends Record<string, unknown>> = {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
};

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
};

export type DataTableProps<T extends Record<string, unknown>> = {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  pagination?: DataTablePagination;
  onRowClick?: (row: T) => void;
  /** Key for row identity (default: id) */
  rowKey?: keyof T;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Нет данных',
  pagination,
  onRowClick,
  rowKey = 'id' as keyof T,
}: DataTableProps<T>) {
  const key = rowKey as string;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={String(col.key)}>
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-slate-500 dark:text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={String(row[key])}
              className={onRowClick ? 'cursor-pointer' : ''}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => {
                const value = row[col.key];
                return (
                  <td key={String(col.key)}>
                    {col.render ? col.render(value, row) : String(value ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Строк {pagination.total}, страница {pagination.page} из {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onChange(pagination.page - 1)}
            >
              Назад
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onChange(pagination.page + 1)}
            >
              Далее
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
