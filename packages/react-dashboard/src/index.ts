import { createElement, type ReactNode, type ReactElement } from 'react'
import { createDashboardRenderer, type LayoutProps, type CardGridProps, type Card } from '../../../site/dashboard.mjs'
import 'agentic-design-system/profile.css'
import 'agentic-design-system/collection-layout.css'

export type { DashboardCardAccent } from '../../../site/dashboard.mjs'
export type DashboardCanvasLayoutProps = LayoutProps<ReactNode>
export type DashboardCard = Card<ReactNode>
export type DashboardCardGridProps = CardGridProps<ReactNode>
export const { DashboardCanvasLayout, DashboardCardGrid, DashboardPrimitive } =
  createDashboardRenderer<ReactNode, ReactElement>((tag, props, ...children) => createElement(tag, props, ...children))
