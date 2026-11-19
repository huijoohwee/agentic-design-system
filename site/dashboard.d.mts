export type DashboardCardAccent = 'primary' | 'secondary' | 'success' | 'warning' | 'neutral';
type DataAttributes = { [attribute: `data-${string}`]: string | undefined };
export type LayoutProps<T> = DataAttributes & {
  ariaLabel?: string; beforeHeader?: T; title: T; description?: T; hero?: T; observation?: T;
  overview?: T; insights?: T; metrics?: T; sections?: T; children?: T;
  metricsAttributes?: DataAttributes; sectionsAttributes?: DataAttributes; className?: string;
};
export type Card<T> = {
  id: string; accent?: DashboardCardAccent; eyebrow?: T; title: T; description?: T; content?: T; actions?: T;
};
export type CardGridProps<T> = {
  ariaLabel: string; cards: readonly Card<T>[]; columns?: 2 | 3 | 4; headingLevel?: 2 | 3 | 4;
  className?: string; cardClassName?: string; eyebrowClassName?: string; titleClassName?: string;
  descriptionClassName?: string; accentClassNameByRole?: Partial<Record<DashboardCardAccent, string>>;
};
export type PrimitiveProps<T> = { kind: 'heading'; level?: 1 | 2 | 3 | 4; children: T }
  | { kind: 'text'; children: T } | { kind: 'divider' } | { kind: 'container'; columns: 2 | 3 | 4; children: T };
type DashboardRenderer<T, R> = {
  DashboardCanvasLayout(props: LayoutProps<T>): R;
  DashboardCardGrid(props: CardGridProps<T>): R;
  DashboardPrimitive(props: PrimitiveProps<T>): R;
};
export function createDashboardRenderer<T, R extends T>(
  element: (tag: string, attributes: Record<string, unknown>, ...children: T[]) => R,
): DashboardRenderer<T, R>;
export function createNativeDashboard(document: Document): DashboardRenderer<Node | string | number | boolean | null | undefined, HTMLElement>;
