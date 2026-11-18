export type CollectionLayout = 'list' | 'card' | 'grid';

export const collectionLayouts: readonly Readonly<{
  layout: CollectionLayout;
  label: string;
  icon: string;
}>[];

export function mountCollectionLayoutPicker(host: HTMLElement, options: {
  layout: CollectionLayout;
  label: string;
  labelPrefix?: string;
  onChange: (layout: CollectionLayout) => void;
}): { setLayout(layout: CollectionLayout): void; destroy(): void };
