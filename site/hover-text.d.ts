export type NumericTooltipValue = number | string;
export interface NumericTooltipOptions {
    defaultValue: NumericTooltipValue;
    min?: NumericTooltipValue;
    max?: NumericTooltipValue;
    interval?: NumericTooltipValue;
    impact: string;
}
export declare function buildNumericTooltip(options: NumericTooltipOptions): string;
export interface RoleActionOutcomeTooltipOptions {
    role: string;
    actions: string[];
    outcome: string;
}
export declare function buildRoleActionOutcomeTooltip(options: RoleActionOutcomeTooltipOptions): string;
export declare function buildSettingsKeyTooltip(params: {
    area: string;
    key: string;
    responsibility: string;
    role?: string;
    actions?: string[];
    outcome?: string;
}): string;
export declare function buildSettingsValueTooltip(params: {
    type: string;
    key: string;
    defaultValue: string | number | boolean | null;
    options?: string[];
    notes?: string;
    impact?: string;
    defaultValueOverride?: string | number | boolean | null;
    min?: string | number;
    max?: string | number;
    interval?: string | number;
    expansionNote?: string;
    contractionNote?: string;
}): string;
export declare function buildDefaultTooltip(params: {
    defaultValue: string | number | boolean | null;
    impact: string;
}): string;
export const HOVER_PARTS: Readonly<Record<'panel' | 'label' | 'text' | 'key' | 'value' | 'expanded', string>>
export const HOVER_BEHAVIOR: Readonly<{ scrollDelayMs: number; scrollIntervalMs: number; bridgeCloseDelayMs: number }>
export const HOVER_DISMISS_EVENT: string
export type TooltipPosition = { top: number; left: number }
export function computeTooltipPositionFromAnchor(anchor: Element, offsetPx: number): TooltipPosition
export function computeTooltipMaxWidthPx(anchor: Element, options: {
  maxWidthFromPrevSibling?: boolean; maxWidthPx?: number; defaultMaxWidthPx: number
}): number
export function constrainTooltipPosition(options: {
  pos: TooltipPosition; tooltipRect: Pick<DOMRect, 'width' | 'height'>; anchorRect: Pick<DOMRect, 'top'>
  viewportW: number; viewportH: number; paddingPx: number; offsetPx: number
}): TooltipPosition
export function getTooltipPortalTarget(anchor: Element | null): Element
export function isTooltipRelatedTarget(value: unknown): boolean
export function formatHoverValue(value: unknown): string
export function buildHoverKeyValueText(key: string, value: unknown): string
