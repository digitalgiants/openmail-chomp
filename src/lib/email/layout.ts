import type { EmailComponent } from "./types";

// A section's children are a flat list of "column" nodes. Columns whose
// width adds up to (roughly) 100% form one row; once the running total
// would exceed 100%, a new row starts. This lets "Add row" work by simply
// appending another 100%-width column — no separate row node needed in the
// data model, and every document that predates row support (a single row
// of columns already fully described this way) keeps working unchanged.
export function groupColumnsIntoRows(children: EmailComponent[]): EmailComponent[][] {
  const rows: EmailComponent[][] = [];
  let current: EmailComponent[] = [];
  let sum = 0;
  for (const child of children) {
    const width = parseFloat(String(child.props?.width ?? "100")) || 100;
    if (current.length > 0 && sum + width > 100.5) {
      rows.push(current);
      current = [];
      sum = 0;
    }
    current.push(child);
    sum += width;
  }
  if (current.length) rows.push(current);
  return rows;
}
