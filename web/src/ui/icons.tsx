import React from 'react';

/**
 * 图标。照着苹果 SF Symbols 的样子画：线条 1.6、圆头圆角，跟着文字颜色走。
 * 只画界面里用到的这些，不引第三方图标库。
 */

type P = { size?: number; className?: string };

function Svg({ size = 16, className, children, fill = false }: P & { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  film: (p: P) => (
    <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" /></Svg>
  ),
  templates: (p: P) => (
    <Svg {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></Svg>
  ),
  works: (p: P) => (
    <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" /></Svg>
  ),
  folder: (p: P) => (
    <Svg {...p}><path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></Svg>
  ),
  plus: (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  minus: (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>,
  check: (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>,
  checkCircle: (p: P) => (
    <Svg {...p} fill><path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm4.3 6.9-5.1 6.1a.9.9 0 0 1-1.3.1l-2.4-2.3a.9.9 0 1 1 1.2-1.3l1.7 1.6 4.5-5.4a.9.9 0 1 1 1.4 1.2Z" /></Svg>
  ),
  chevronLeft: (p: P) => <Svg {...p}><path d="m14.5 6-6 6 6 6" /></Svg>,
  chevronRight: (p: P) => <Svg {...p}><path d="m9.5 6 6 6-6 6" /></Svg>,
  chevronDown: (p: P) => <Svg {...p}><path d="m6 9.5 6 6 6-6" /></Svg>,
  chevronUp: (p: P) => <Svg {...p}><path d="m6 14.5 6-6 6 6" /></Svg>,
  upDown: (p: P) => <Svg {...p}><path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" /></Svg>,
  play: (p: P) => <Svg {...p} fill><path d="M7.5 4.8v14.4a1 1 0 0 0 1.5.9l11.3-7.2a1 1 0 0 0 0-1.7L9 4a1 1 0 0 0-1.5.8Z" /></Svg>,
  pause: (p: P) => <Svg {...p} fill><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></Svg>,
  prev: (p: P) => <Svg {...p} fill><rect x="4.5" y="5" width="2.4" height="14" rx="1" /><path d="M19.5 6v12a.9.9 0 0 1-1.4.8l-9.3-6a.9.9 0 0 1 0-1.6l9.3-6a.9.9 0 0 1 1.4.8Z" /></Svg>,
  next: (p: P) => <Svg {...p} fill><rect x="17.1" y="5" width="2.4" height="14" rx="1" /><path d="M4.5 6v12a.9.9 0 0 0 1.4.8l9.3-6a.9.9 0 0 0 0-1.6l-9.3-6A.9.9 0 0 0 4.5 6Z" /></Svg>,
  toStart: (p: P) => <Svg {...p} fill><rect x="4.5" y="5" width="2.4" height="14" rx="1" /><path d="M19.5 6v12a.9.9 0 0 1-1.4.8l-9.3-6a.9.9 0 0 1 0-1.6l9.3-6a.9.9 0 0 1 1.4.8Z" /></Svg>,
  loop: (p: P) => (
    <Svg {...p}><path d="M16.5 3.5 19.5 6.5l-3 3" /><path d="M4.5 11.5v-1a4 4 0 0 1 4-4h11" /><path d="M7.5 20.5l-3-3 3-3" /><path d="M19.5 12.5v1a4 4 0 0 1-4 4h-11" /></Svg>
  ),
  ellipsis: (p: P) => <Svg {...p} fill><circle cx="6" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18" cy="12" r="1.7" /></Svg>,
  share: (p: P) => (
    <Svg {...p}><path d="M12 14.5V3.5M8 7.5l4-4 4 4" /><path d="M8.5 10.5H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5" /></Svg>
  ),
  scissors: (p: P) => (
    <Svg {...p}><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="17.5" r="2.5" /><path d="M8.6 8 19.5 17.5M8.6 16 19.5 6.5" /></Svg>
  ),
  merge: (p: P) => (
    <Svg {...p}><path d="M4 5.5v13M20 5.5v13" /><path d="M8 12h8M13.5 9l3 3-3 3M10.5 9l-3 3 3 3" /></Svg>
  ),
  wand: (p: P) => (
    <Svg {...p}><path d="m4 20 11-11M13 7l4 4" /><path d="M17.5 3v3M16 4.5h3M20 9v2M19 10h2M10 3.5v2M9 4.5h2" /></Svg>
  ),
  trash: (p: P) => (
    <Svg {...p}><path d="M4.5 6.5h15M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7M6.5 6.5l.8 12.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-12.2" /></Svg>
  ),
  arrowUp: (p: P) => <Svg {...p}><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></Svg>,
  arrowDown: (p: P) => <Svg {...p}><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" /></Svg>,
  zoomIn: (p: P) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8M10.5 7.8v5.4M7.8 10.5h5.4" /></Svg>,
  zoomOut: (p: P) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8M7.8 10.5h5.4" /></Svg>,
  link: (p: P) => (
    <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3.1-3.1a4 4 0 0 0-5.7-5.7l-1.4 1.4" /><path d="M14 10a4 4 0 0 0-5.7 0l-3.1 3.1a4 4 0 0 0 5.7 5.7l1.4-1.4" /></Svg>
  ),
  photo: (p: P) => (
    <Svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17.5 5-4.5 3.5 3 3-2.5 4.5 4" /></Svg>
  ),
  sparkles: (p: P) => (
    <Svg {...p}><path d="M10 3.5 11.6 8a2 2 0 0 0 1.2 1.2L17.5 11l-4.7 1.7a2 2 0 0 0-1.2 1.2L10 18.5l-1.6-4.6a2 2 0 0 0-1.2-1.2L2.5 11l4.7-1.8A2 2 0 0 0 8.4 8Z" /><path d="M18.5 3v3.5M16.8 4.8h3.5" /></Svg>
  ),
  doc: (p: P) => (
    <Svg {...p}><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" /><path d="M14 3.5V8h4.5M9 12.5h6M9 16h4" /></Svg>
  ),
  refresh: (p: P) => (
    <Svg {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></Svg>
  ),
  warning: (p: P) => (
    <Svg {...p}><path d="M10.3 4.2 2.9 17.3A2 2 0 0 0 4.6 20.3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9.5v4.5M12 17h.01" /></Svg>
  ),
  eye: (p: P) => (
    <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></Svg>
  ),
};

export type IconName = keyof typeof Icon;
