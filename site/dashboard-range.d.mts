export type DashboardRangePoint = {
  label: string;
  tickLabel?: string;
  open: number;
  high: number;
  low: number;
  close: number;
};
export function createDashboardRange<T extends DashboardRangePoint>(document: Document, options: {
  label: string;
  points: readonly T[];
  formatValue?: (value: number) => string;
  onSelect?: (point: T, index: number) => void;
}): HTMLDivElement;
