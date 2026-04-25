// @ts-nocheck
import { useState } from 'react';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyText = 'Нет данных',
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = String(a[sortKey] ?? '');
        const bv = String(b[sortKey] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : rows;

  return (
    <div className={`bg-surface rounded-sm overflow-hidden border border-border ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 border-b border-border">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-2.5 text-left text-[10px] font-semibold text-text-subtle uppercase tracking-wide font-brand whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-text select-none' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                >
                  {col.label}
                  {col.sortable && sortKey === String(col.key) && (
                    <span className="ml-1 text-accent">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-text-subtle text-sm">
                  {emptyText}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={i} className="border-t border-border hover:bg-surface-2 transition">
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-4 py-2.5 text-text">
                      {col.render
                        ? col.render(row[col.key as keyof T], row)
                        : String(row[col.key as keyof T] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
