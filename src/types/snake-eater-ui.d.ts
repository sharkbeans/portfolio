/**
 * Local type declarations for snake-eater-ui@0.0.13.
 *
 * The package ships a `types` entry (dist/index.d.ts) that re-exports from
 * `./Accordion/Accordion`, `./Alert/Alert`, and so on — none of which exist in
 * the published tarball, which contains only the four dist bundles. Pointing
 * TypeScript at it makes `npm run check` fail on every import, so tsconfig.json
 * maps the module to this file instead.
 *
 * Only the components used by src/pages/lab.astro are declared, and the props
 * are transcribed from the component sources in the upstream repo (stories/*),
 * not from its README or llms.txt — both of those disagree with the real
 * signatures in places (llms.txt gives Alert a required `children` when it
 * actually takes `title`/`description`, and Heading a `level` prop that is
 * really `as`). Re-check against source when bumping the version.
 */
declare module "snake-eater-ui" {
  import type * as React from "react";

  type Size = "small" | "medium" | "large";
  type StatusVariant = "default" | "success" | "warning" | "danger" | "info";

  export interface AlertProps {
    title?: string;
    description?: React.ReactNode;
    variant?: StatusVariant;
    size?: Size;
    showIcon?: boolean;
    icon?: React.ReactNode;
    closable?: boolean;
    onClose?: () => void;
    actions?: React.ReactNode;
    borderPosition?: "left" | "top" | "all";
    className?: string;
    children?: React.ReactNode;
  }
  export const Alert: React.FC<AlertProps>;

  export interface BadgeProps {
    children: React.ReactNode;
    variant?: StatusVariant | "ghost";
    size?: Size;
    style?: "solid" | "outline" | "dot";
    icon?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }
  export const Badge: React.FC<BadgeProps>;

  export interface CardProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    size?: Size;
    interactive?: boolean;
    onClick?: () => void;
    variant?: "default" | "grid" | "transparent";
  }
  export const Card: React.FC<CardProps>;

  export interface SubCardProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    size?: Size;
    interactive?: boolean;
    onClick?: () => void;
    variant?: StatusVariant | "inactive";
    cornerColor?: string;
  }
  export const SubCard: React.FC<SubCardProps>;

  export interface DividerProps {
    orientation?: "horizontal" | "vertical";
    variant?: "solid" | "dashed" | "dotted" | "double" | "accent";
    thickness?: "thin" | "medium" | "thick";
    color?: "default" | "muted" | "primary" | "secondary";
    children?: React.ReactNode;
    spacing?: Size;
    className?: string;
    style?: React.CSSProperties;
  }
  export const Divider: React.FC<DividerProps>;

  export interface HeadingProps {
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    size?: "2xl" | "xl" | "lg" | "md" | "sm" | "xs";
    align?: "left" | "center" | "right";
    variant?: "default" | "primary" | "secondary" | "muted";
    weight?: "normal" | "medium" | "bold";
    decorated?: boolean;
    decorationPosition?: "left" | "bottom" | "both";
    transform?: "none" | "uppercase" | "lowercase" | "capitalize";
    truncate?: boolean;
    className?: string;
    children: React.ReactNode;
  }
  export const Heading: React.FC<HeadingProps>;

  export interface TextProps {
    as?: "p" | "span" | "div" | "blockquote" | "figcaption" | "small" | "strong" | "em" | "mark";
    size?: "2xl" | "xl" | "lg" | "md" | "sm" | "xs";
    variant?: "default" | "primary" | "secondary" | "muted" | "success" | "warning" | "danger" | "info";
    weight?: "normal" | "medium" | "bold";
    align?: "left" | "center" | "right" | "justify";
    transform?: "none" | "uppercase" | "lowercase" | "capitalize";
    italic?: boolean;
    mono?: boolean;
    truncate?: boolean;
    clamp?: number;
    leading?: "tight" | "normal" | "relaxed" | "loose";
    tracking?: "tight" | "normal" | "wide";
    className?: string;
    children: React.ReactNode;
  }
  export const Text: React.FC<TextProps>;

  export interface KeyboardKeyProps {
    children: React.ReactNode;
    size?: Size;
    variant?: "default" | "modifier" | "action" | "danger" | "space";
    pressed?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    width?: number;
    icon?: React.ReactNode;
    iconPosition?: "left" | "right" | "top" | "bottom";
  }
  export const KeyboardKey: React.FC<KeyboardKeyProps>;

  export interface StatProps {
    label: string;
    value: string | number;
    info?: string;
    change?: { value: string | number; type: "increase" | "decrease" | "neutral" };
    icon?: React.ReactNode;
    size?: Size;
    variant?: "default" | "centered" | "horizontal";
    color?: StatusVariant;
    loading?: boolean;
    className?: string;
  }
  export const Stat: React.FC<StatProps>;

  export interface ProgressProps {
    value?: number;
    max?: number;
    size?: Size;
    variant?: StatusVariant | "primary" | "cyber";
    showLabel?: boolean;
    labelPosition?: "outside" | "top" | "bottom";
    type?: "linear" | "striped" | "animated" | "segmented";
    segments?: number;
    label?: string;
    formatValue?: (value: number, max: number) => string;
    indeterminate?: boolean;
    className?: string;
    ariaLabel?: string;
  }
  export const Progress: React.FC<ProgressProps>;

  export interface StepperStep {
    label: string;
    description?: string;
    icon?: React.ReactNode;
    error?: boolean;
  }
  export interface StepperProps {
    steps: StepperStep[];
    activeStep: number;
    orientation?: "horizontal" | "vertical";
    size?: Size;
    showNumbers?: boolean;
    clickable?: boolean;
    onStepClick?: (index: number) => void;
    className?: string;
    showConnectors?: boolean;
    variant?: "default" | "compact" | "pills";
  }
  export const Stepper: React.FC<StepperProps>;

  export interface GraphDataPoint {
    label: string;
    value: number;
    color?: string;
  }

  export interface SpiderGraphProps {
    data: GraphDataPoint[];
    width?: number | string;
    height?: number | string;
    levels?: number;
    showValues?: boolean;
    showLabels?: boolean;
    showGrid?: boolean;
    showAxes?: boolean;
    animate?: boolean;
    fillOpacity?: number;
    strokeWidth?: number;
    gridColor?: string;
    fillColor?: string;
    strokeColor?: string;
    showDots?: boolean;
    variant?: "default" | "minimal" | "detailed" | "cyber";
    className?: string;
  }
  export const SpiderGraph: React.FC<SpiderGraphProps>;

  export interface BarGraphProps {
    data: GraphDataPoint[];
    maxValue?: number;
    height?: number | string;
    width?: number | string;
    barWidth?: number;
    gap?: number;
    showValues?: boolean;
    showGrid?: boolean;
    gridLines?: number;
    showLabels?: boolean;
    showScale?: boolean;
    orientation?: "vertical" | "horizontal";
    animate?: boolean;
    barColor?: string;
    gridColor?: string;
    variant?: "default" | "minimal" | "detailed" | "interactive";
    formatValue?: (value: number) => string;
    className?: string;
  }
  export const BarGraph: React.FC<BarGraphProps>;

  export interface TableColumn<T> {
    key: keyof T | string;
    header: React.ReactNode;
    render?: (value: never, row: T, index: number) => React.ReactNode;
    width?: string;
    align?: "left" | "center" | "right";
    sortable?: boolean;
  }
  export interface TableProps<T> {
    data: T[];
    columns: TableColumn<T>[];
    size?: Size;
    variant?: "default" | "striped" | "bordered";
    stickyHeader?: boolean;
    loading?: boolean;
    emptyMessage?: string;
    className?: string;
  }
  export function Table<T>(props: TableProps<T>): React.ReactElement;

  export interface ListItem {
    content: React.ReactNode;
    subitems?: ListItem[];
  }
  export interface ListProps {
    /** Bare strings render as empty markers; each item needs a `content` field. */
    items: ListItem[];
    startNumber?: number;
    numberPadding?: number;
    showNumbers?: boolean;
    type?: "ordered" | "unordered";
    size?: Size;
    uppercase?: boolean;
    interactive?: boolean;
    className?: string;
  }
  export const List: React.FC<ListProps>;

  export interface LoadingProps {
    type?: "dots" | "bars" | "pulse" | "grid";
    size?: Size;
    variant?: StatusVariant | "primary";
    text?: string;
    fullscreen?: boolean;
    backdrop?: boolean;
    className?: string;
  }
  export const Loading: React.FC<LoadingProps>;

  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "cyber" | "clipped";
    size?: Size;
    loading?: boolean;
    fullWidth?: boolean;
    children: React.ReactNode;
  }
  export const Button: React.FC<ButtonProps>;
}
