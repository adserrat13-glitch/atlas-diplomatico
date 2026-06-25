/* Atlas Diplomático — SVG Icon Library
   All icons: 16×16 viewBox, stroke-based, geometric */

const ICONS = {

  home: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="1 7 8 1 15 7"/>
    <path d="M3 6v8h4v-4h2v4h4V6"/>
  </svg>`,

  cards: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="5" width="10" height="9" rx="1"/>
    <path d="M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2"/>
  </svg>`,

  sim: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="1" width="10" height="14" rx="1"/>
    <path d="M6 1v2h4V1"/>
    <line x1="5" y1="7" x2="11" y2="7"/>
    <line x1="5" y1="9.5" x2="11" y2="9.5"/>
    <line x1="5" y1="12" x2="9" y2="12"/>
  </svg>`,

  chart: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="1 12 5 7 9 9.5 14 3"/>
    <polyline points="10 3 14 3 14 7"/>
  </svg>`,

  review: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="8" cy="8" r="5.5"/>
    <path d="M8 5v3l2 1.5"/>
    <path d="M3 3l10 10" stroke-width=".8" stroke-dasharray="1.5 2" opacity=".4"/></svg>`,
  words: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 13L5.5 3L9 13"/>
    <line x1="3.5" y1="10" x2="7.5" y2="10"/>
    <line x1="12" y1="3" x2="12" y2="13"/>
    <line x1="10" y1="8" x2="14" y2="8"/>
  </svg>`,

  grammar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <line x1="2" y1="4" x2="14" y2="4"/>
    <line x1="2" y1="7" x2="14" y2="7"/>
    <line x1="2" y1="10" x2="10" y2="10"/>
    <path d="M11 9l2.5 2-2.5 2"/>
    <line x1="13.5" y1="11" x2="9" y2="11"/>
  </svg>`,

  gramC2: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="9" height="12" rx="1"/>
    <path d="M5 2v12"/>
    <line x1="7" y1="6" x2="10" y2="6"/>
    <line x1="7" y1="9" x2="10" y2="9"/>
    <path d="M12 9l2 2-2 2" stroke-width="1.3"/>
  </svg>`,

  games: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="5" width="14" height="8" rx="2"/>
    <line x1="5" y1="9" x2="7" y2="9"/>
    <line x1="6" y1="8" x2="6" y2="10"/>
    <circle cx="10.5" cy="8" r="1" fill="currentColor" stroke="none"/>
    <circle cx="12.5" cy="10" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  dip: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="8" y1="2" x2="8" y2="14"/>
    <line x1="4" y1="5" x2="12" y2="5"/>
    <path d="M3 5L1 9h4Z"/>
    <path d="M13 5l-2 4h4Z"/>
    <line x1="5" y1="14" x2="11" y2="14"/>
  </svg>`,

  economy: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <rect x="1" y="10" width="3" height="4"/>
    <rect x="6" y="6" width="3" height="8"/>
    <rect x="11" y="2" width="3" height="12"/>
    <line x1="1" y1="15" x2="15" y2="15"/>
  </svg>`,

  globe: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="8" cy="8" r="6.5"/>
    <ellipse cx="8" cy="8" rx="3" ry="6.5"/>
    <line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/>
    <line x1="1.5" y1="10.5" x2="14.5" y2="10.5"/>
  </svg>`,

  timeline: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <line x1="1" y1="8" x2="15" y2="8"/>
    <circle cx="4" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none"/>
    <line x1="4" y1="4.5" x2="4" y2="6.5"/>
    <line x1="8" y1="4.5" x2="8" y2="6.5"/>
    <line x1="12" y1="4.5" x2="12" y2="6.5"/>
  </svg>`,

  chron: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <line x1="5" y1="4" x2="14" y2="4"/>
    <line x1="5" y1="8" x2="14" y2="8"/>
    <line x1="5" y1="12" x2="11" y2="12"/>
    <circle cx="2.5" cy="4" r="1" fill="currentColor" stroke="none"/>
    <circle cx="2.5" cy="8" r="1" fill="currentColor" stroke="none"/>
    <circle cx="2.5" cy="12" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  map: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 1.5a4 4 0 0 1 4 4C12 9 8 14.5 8 14.5S4 9 4 5.5a4 4 0 0 1 4-4Z"/>
    <circle cx="8" cy="5.5" r="1.5"/>
  </svg>`,

  news: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <rect x="1" y="2" width="14" height="12" rx="1"/>
    <line x1="4" y1="5.5" x2="12" y2="5.5"/>
    <line x1="4" y1="8" x2="12" y2="8"/>
    <line x1="4" y1="10.5" x2="8.5" y2="10.5"/>
  </svg>`,

  rank: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <rect x="1" y="11" width="4" height="4"/>
    <rect x="6" y="8" width="4" height="7"/>
    <rect x="11" y="5" width="4" height="10"/>
    <line x1="1" y1="15" x2="15" y2="15"/>
  </svg>`,

  calendar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="3" width="14" height="12" rx="1"/>
    <line x1="1" y1="7" x2="15" y2="7"/>
    <line x1="5" y1="1" x2="5" y2="5"/>
    <line x1="11" y1="1" x2="11" y2="5"/>
  </svg>`,

  phase2: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.5 2.5l4 4-8 7H2v-3.5Z"/>
    <line x1="7.5" y1="4.5" x2="11.5" y2="8.5"/>
  </svg>`,

  settings: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="8" cy="8" r="2.5"/>
    <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>
  </svg>`,

  espiral: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M8 8c.5 0 1-.5 1-1s-.5-1-1-1-2 .5-2 2 1 3 3 3 4-1.5 4-4-2-5-5-5S2 5 2 8s3 7 7 7"/>
  </svg>`,

  flag: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="3" y1="1" x2="3" y2="15"/>
    <path d="M3 2h10L9 7l4 5H3"/>
  </svg>`,

  exchange: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 5h12M10 2l3 3-3 3"/>
    <path d="M15 11H3M6 8l-3 3 3 3"/>
  </svg>`,

  neural: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="8" cy="8" r="2"/>
    <circle cx="2" cy="4" r="1.5"/>
    <circle cx="14" cy="4" r="1.5"/>
    <circle cx="2" cy="12" r="1.5"/>
    <circle cx="14" cy="12" r="1.5"/>
    <line x1="3.2" y1="4.8" x2="6" y2="7"/>
    <line x1="12.8" y1="4.8" x2="10" y2="7"/>
    <line x1="3.2" y1="11.2" x2="6" y2="9"/>
    <line x1="12.8" y1="11.2" x2="10" y2="9"/>
  </svg>`,

  repos: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="4" cy="4" r="2"/>
    <circle cx="12" cy="4" r="2"/>
    <circle cx="4" cy="13" r="2"/>
    <line x1="4" y1="6" x2="4" y2="11"/>
    <line x1="6" y1="4" x2="10" y2="4"/>
    <path d="M6 13h2l4-5v-2"/>
  </svg>`,

  pocket: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 2h12a1 1 0 0 1 1 1v5a7 7 0 0 1-14 0V3a1 1 0 0 1 1-1Z"/>
    <polyline points="5 7 8 10 11 7"/>
  </svg>`,

  book: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3"/>
    <path d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1"/>
    <line x1="8" y1="2" x2="8" y2="14"/>
    <line x1="5" y1="5.5" x2="7" y2="5.5"/>
    <line x1="5" y1="8" x2="7" y2="8"/>
  </svg>`,

  scroll: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 3h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4"/>
    <path d="M4 3a2 2 0 0 0 0 4"/>
    <path d="M4 7a2 2 0 0 1 0 6"/>
    <line x1="7" y1="6" x2="11" y2="6"/>
    <line x1="7" y1="8.5" x2="11" y2="8.5"/>
    <line x1="7" y1="11" x2="9.5" y2="11"/>
  </svg>`,

  brazil: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <text x="2" y="12" font-size="11" font-weight="700" font-family="monospace" fill="currentColor" stroke="none">BR</text>
  </svg>`,

  spain: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <text x="2.5" y="12" font-size="11" font-weight="700" font-family="monospace" fill="currentColor" stroke="none">ES</text>
  </svg>`,

  law: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="1" width="4" height="3" rx=".5"/>
    <line x1="8" y1="4" x2="8" y2="15"/>
    <line x1="2" y1="7" x2="14" y2="7"/>
    <path d="M2 7l-1 4h4Z"/>
    <path d="M14 7l-1 4h4Z"/>
  </svg>`,

  trophy: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 2h6v5a3 3 0 0 1-6 0V2Z"/>
    <path d="M2 2h3M11 2h3M2 4a2 2 0 0 0 2 2M14 4a2 2 0 0 1-2 2"/>
    <line x1="8" y1="9" x2="8" y2="12"/>
    <line x1="5" y1="14" x2="11" y2="14"/>
    <line x1="6" y1="12" x2="10" y2="12"/>
  </svg>`,

  target: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <circle cx="8" cy="8" r="6.5"/>
    <circle cx="8" cy="8" r="3.5"/>
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  star: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="8 1.5 9.8 6 14.5 6.2 11 9.3 12.2 14 8 11.3 3.8 14 5 9.3 1.5 6.2 6.2 6"/>
  </svg>`,

  skull: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 9.5V13h8V9.5A4 4 0 1 0 4 9.5Z"/>
    <line x1="6" y1="13" x2="6" y2="15"/>
    <line x1="10" y1="13" x2="10" y2="15"/>
    <line x1="8" y1="13" x2="8" y2="15"/>
    <circle cx="6" cy="8" r="1" fill="currentColor" stroke="none"/>
    <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  check: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="8" cy="8" r="6.5"/>
    <polyline points="5 8.5 7 10.5 11 6"/>
  </svg>`,

  dot: `<svg viewBox="0 0 16 16" fill="currentColor" stroke="none">
    <circle cx="8" cy="8" r="4"/>
  </svg>`,

  sparkle: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 1v14M1 8h14"/>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke-width="1"/>
  </svg>`,

  history: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="8" cy="8" r="6.5"/>
    <polyline points="8 4 8 8 11 10"/>
    <path d="M1.5 8A6.5 6.5 0 0 1 4 3" stroke-dasharray="2 2" opacity=".5"/>
  </svg>`,

  lang: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 4h7M4.5 2v2M2 4c0 3 2.5 5 4.5 6"/>
    <path d="M6 4c.5 2 2 4 4 5"/>
    <path d="M9 9l1.5-4 1.5 4M9.7 7.5h2.6"/>
    <path d="M8 13h6"/>
  </svg>`,

  chat: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2l-3 2-1-2H2a1 1 0 0 1-1-1V4Z"/>
    <line x1="4" y1="6" x2="12" y2="6" stroke-width="1"/>
    <line x1="4" y1="9" x2="10" y2="9" stroke-width="1"/>
  </svg>`,

};

