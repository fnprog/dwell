import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'portfolio'
  | 'map'
  | 'calendar'
  | 'calendarPlus'
  | 'inbox'
  | 'people'
  | 'peopleAdd'
  | 'money'
  | 'issues'
  | 'reminders'
  | 'search'
  | 'plus'
  | 'check'
  | 'building'
  | 'buildingSmall'
  | 'room'
  | 'card'
  | 'wrench'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'location'
  | 'expand'
  | 'trend'
  | 'message'
  | 'bell'
  | 'close'
  | 'download'
  | 'upload'
  | 'settings'
  | 'logout'
  | 'clock'
  | 'trash'
  | 'edit'
  | 'arrowRight'
  | 'arrowDown'
  | 'refresh'
  | 'key'
  | 'shield'
  | 'sparkle'
  | 'document'
  | 'box'
  | 'user';

const paths: Record<IconName, string> = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"></path>',
  portfolio:
    '<path d="M4 21V5l8-3v19M12 9h8v12M4 21h16M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01"></path>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"></path>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  calendarPlus:
    '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4M12 13v4M10 15h4"></path>',
  inbox: '<path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"></path>',
  people:
    '<path d="M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8zM21 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"></path>',
  peopleAdd:
    '<path d="M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6"></path>',
  money: '<rect x="3" y="6" width="18" height="14" rx="3"></rect><path d="M3 10h18M16 15h2"></path>',
  issues: '<path d="M14.7 6.3a4 4 0 005 5L21 13l-8 8-8-8 8-8 1.7 1.3z"></path>',
  reminders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"></path><circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  building: '<path d="M4 21V5l8-3v19M12 9h8v12M4 21h16M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01"></path>',
  buildingSmall: '<path d="M4 21V5l8-3v19M12 9h8v12"></path>',
  room: '<rect x="6" y="3" width="12" height="18" rx="2.5"></rect><circle cx="14.5" cy="12" r="1" fill="currentColor"></circle>',
  card: '<rect x="3" y="7" width="18" height="10" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle>',
  wrench: '<path d="M14.7 6.3a4 4 0 005 5L21 13l-8 8-8-8 8-8 1.7 1.3z"></path>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"></path>',
  chevronRight: '<path d="M9 6l6 6-6 6"></path>',
  chevronDown: '<path d="M6 9l6 6 6-6"></path>',
  location: '<path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"></path><circle cx="12" cy="10" r="2.5"></circle>',
  expand: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"></path>',
  message: '<path d="M3 21l1.7-5A8.5 8.5 0 1112 20.5a8.5 8.5 0 01-4.2-1.1L3 21z"></path>',
  bell: '<path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"></path>',
  close: '<path d="M6 6l12 12M18 6L6 18"></path>',
  download: '<path d="M12 3v12M5 10l7 7 7-7"></path><path d="M4 20h16"></path>',
  upload: '<path d="M12 21V9M5 14l7-7 7 7"></path><path d="M4 4h16"></path>',
  settings:
    '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"></path>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6"></path>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"></path>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"></path>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"></path>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 6M20 5v6h-6"></path>',
  key: '<circle cx="8" cy="15" r="4"></circle><path d="M11 12l9-9M17 6l3 3M14 9l3 3"></path>',
  shield: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"></path>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path>',
  document: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"></path>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"></path>',
  user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  className,
  style,
  filled = false,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths[name] }}
    />
  );
}

/** The Dwell mark: an arch with a location pin cut out of it. */
export function Logo({ width = 34, height = 38, tone = 'gold' }: { width?: number; height?: number; tone?: 'gold' | 'ink' | 'bone' }) {
  const color = tone === 'ink' ? '#1A1813' : tone === 'bone' ? '#F3EFE4' : '#FFB91F';
  return (
    <svg width={width} height={height} viewBox="40 8 250 275" aria-hidden="true">
      <path d="M52 202V108L164 22L276 108V202" fill="none" stroke={color} strokeWidth="29" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M164 91c-34 0-61 27-61 61 0 47 61 117 61 117s61-70 61-117c0-34-27-61-61-61Z M164 136a17 17 0 1 0 0 34a17 17 0 1 0 0-34Z"
        fill={color}
        fillRule="evenodd"
      />
    </svg>
  );
}

/** The watermark used on the sign-in panel and welcome screen. */
export function LogoWatermark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <path d="M40 220V120L200 10L360 120V220" stroke="#1A1813" strokeOpacity=".28" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M200 110c-40 0-72 32-72 72 0 56 72 140 72 140s72-84 72-140c0-40-32-72-72-72z"
        fill="#1A1813"
        fillOpacity=".2"
        stroke="#1A1813"
        strokeOpacity=".22"
        strokeWidth="8"
      />
    </svg>
  );
}

/** Small building illustration for a site card. */
export function BuildingArt({ width = 148, height = 120 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 148 120" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 116h144M14 116V84h22v32M116 116V70h26v46" />
      <rect x="40" y="14" width="68" height="102" rx="3" />
      <path d="M52 32h12M78 32h12M52 54h12M78 54h12M52 76h12M78 76h12M66 116v-20h16v20" />
    </svg>
  );
}

export function StampArt({ children }: { children: ReactNode }) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 104 134" fill="none" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <rect x="2" y="2" width="100" height="130" rx="10" stroke="#171612" strokeWidth="6" strokeDasharray="0 11" strokeLinecap="round" />
      {children}
    </svg>
  );
}

export function ProgressRing({
  size = 112,
  radius = 44,
  stroke = 9,
  pct,
  color = '#62E6B1',
}: {
  size?: number;
  radius?: number;
  stroke?: number;
  pct: number;
  color?: string;
}) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#3d3a31" strokeWidth={stroke} />
      <circle
        className="ring"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}
