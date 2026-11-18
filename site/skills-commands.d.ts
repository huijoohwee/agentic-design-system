export const skillsCommandsTab: Readonly<{ key: 'skills-commands'; label: 'Skills & Commands'; icon: 'SquareTerminal' }>;
export interface CatalogFilters {
  prefix: 'all' | 'slash' | 'hash' | 'at';
  groupBy: 'subject' | 'verb' | 'object';
  query: string;
}
export const initialCatalogFilters: Readonly<CatalogFilters>;
export interface CatalogHeader {
  setDisclosure(hasGroups: boolean, collapsed: boolean, toggle: () => void): void;
  destroy(): void;
}
export function mountSkillsCommandsHeader(host: HTMLElement, onChange: (state: CatalogFilters) => void): CatalogHeader;
export function mountSkillsCommandsReference(host: HTMLElement, entries: ReadonlyArray<{
  token: string; summary: string; subject: string; verb: string; object: string;
}>, sourceLabel: string): { destroy(): void };
