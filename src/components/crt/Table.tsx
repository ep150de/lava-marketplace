"use client";

import React from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export default function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "NO DATA FOUND",
  className = "",
}: TableProps<T>) {
  const alignClass = (align?: string) => {
    switch (align) {
      case "center": return "text-center";
      case "right": return "text-right";
      default: return "text-left";
    }
  };

  return (
    <div className={`crt-table overflow-x-auto ${className}`}>
      <table className="w-full font-mono text-sm">
        <thead>
          <tr className="border-b-2 border-crt">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-1.5 text-crt-bright uppercase tracking-wider text-xs ${alignClass(col.align)}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-crt-dim"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={idx}
                className={`border-b border-crt-border/30 ${
                  onRowClick
                    ? "cursor-pointer hover:bg-crt/5 hover:text-crt-bright"
                    : ""
                }`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 text-crt ${alignClass(col.align)}`}
                  >
                    {col.render
                      ? col.render(item)
                      : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {/* Bottom border */}
      <div className="border-t border-crt h-0" />
    </div>
  );
}
