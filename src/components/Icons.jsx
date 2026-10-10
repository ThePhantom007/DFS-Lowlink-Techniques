const base = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false };

export const IconPlay = () => (<svg {...base} fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" /></svg>);
export const IconPause = () => (<svg {...base} fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></svg>);
export const IconStart = () => (<svg {...base} fill="currentColor"><rect x="5" y="5" width="2.6" height="14" rx="1.1" /><path d="M19 5.4v13.2a.9.9 0 0 1-1.4.74L9 12.74a.9.9 0 0 1 0-1.48l8.6-6.6A.9.9 0 0 1 19 5.4z" /></svg>);
export const IconEnd = () => (<svg {...base} fill="currentColor"><rect x="16.4" y="5" width="2.6" height="14" rx="1.1" /><path d="M5 5.4v13.2a.9.9 0 0 0 1.4.74l8.6-6.6a.9.9 0 0 0 0-1.48L6.4 4.66A.9.9 0 0 0 5 5.4z" /></svg>);
export const IconBack = () => (<svg {...base} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 6l-6 6 6 6" /></svg>);
export const IconNext = () => (<svg {...base} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 6l6 6-6 6" /></svg>);

export const IconSun = () => (
  <svg {...base} width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </svg>
);
export const IconMoon = () => (
  <svg {...base} width="17" height="17" fill="currentColor"><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a.7.7 0 0 0-.95-.82A9.6 9.6 0 1 0 21.3 15.15a.7.7 0 0 0-.8-.95z" /></svg>
);
