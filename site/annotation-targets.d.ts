export type ResponsiveTarget = Readonly<{
  screen: Readonly<{ width: number; height: number }>
  viewport: Readonly<{ width: number; height: number }>
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
}>
export declare const supportedResponsiveTargets: Readonly<Record<'macbook-pro-16' | 'iphone-13', ResponsiveTarget>>

export interface AnnotationTargetAuditOptions {
  /** Minimum count of named selection targets required in the audited document. */
  minTargets?: number
  /** Scroll each target into view before testing its geometry and pointer hit target. */
  scrollIntoView?: boolean
}

export interface AnnotationTargetAuditRow {
  name: string
  tag: string
  accessibleName: string
  ok: boolean
  issues: string[]
}

export interface AnnotationTargetAuditReport {
  schema: 'agentic-design-system/annotation-target-audit/v1'
  targetCount: number
  ok: boolean
  targets: AnnotationTargetAuditRow[]
  issues: string[]
}

export const SELECTION_TARGET_ATTRIBUTE: 'data-selection-target'
export const SELECTION_TARGET_SELECTOR: '[data-selection-target]'

/** Audit the current document, or pass an explicit DOM root from a test. */
export function assertAnnotationTargets(options?: AnnotationTargetAuditOptions): AnnotationTargetAuditReport
export function assertAnnotationTargets(root: ParentNode, options?: AnnotationTargetAuditOptions): AnnotationTargetAuditReport
