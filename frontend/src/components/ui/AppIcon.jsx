export default function AppIcon({ name = 'box', size = 18, stroke = 'currentColor', style, className }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style,
    className,
    'aria-hidden': true,
    focusable: 'false',
  };

  switch (name) {
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
    case 'cart':
      return <svg {...common}><path d="M3 5h2l2 11h10l2-8H7" /><circle cx="10" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></svg>;
    case 'heart':
      return <svg {...common}><path d="M12 20s-7-4.6-9-8.6C1.5 8.5 3.5 5 7 5c2 0 3.1 1 5 3 1.9-2 3-3 5-3 3.5 0 5.5 3.5 4 6.4-2 4-9 8.6-9 8.6Z" /></svg>;
    case 'box':
      return <svg {...common}><path d="M3 8l9-5 9 5-9 5-9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>;
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case 'users':
      return <svg {...common}><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M14 20a4.5 4.5 0 0 1 7 0" /></svg>;
    case 'ruler':
      return <svg {...common}><path d="M4 8h16v8H4z" /><path d="M7 8v3M10 8v2M13 8v3M16 8v2" /></svg>;
    case 'location':
      return <svg {...common}><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>;
    case 'note':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
    case 'pencil':
      return <svg {...common}><path d="M4 20l4-1 9-9-3-3-9 9-1 4Z" /><path d="M13 7l3 3" /></svg>;
    case 'bulb':
      return <svg {...common}><path d="M9 17h6" /><path d="M10 20h4" /><path d="M8 14a6 6 0 1 1 8 0c-1.2 1-2 2-2 3h-4c0-1-0.8-2-2-3Z" /></svg>;
    case 'money':
      return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M7 12h.01M17 12h.01" /></svg>;
    case 'chart':
      return <svg {...common}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12 16V9M16 16v-7" /></svg>;
    case 'hourglass':
      return <svg {...common}><path d="M7 4h10M7 20h10M8 4c0 4 4 4 4 8s-4 4-4 8M16 4c0 4-4 4-4 8s4 4 4 8" /></svg>;
    case 'card':
      return <svg {...common}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>;
    case 'phone':
      return <svg {...common}><rect x="8" y="3" width="8" height="18" rx="2" /><path d="M11 18h2" /></svg>;
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 8l9 6 9-6" /></svg>;
    case 'tag':
      return <svg {...common}><path d="M20 12l-8 8-8-8V5h7l9 7Z" /><circle cx="8" cy="8" r="1" /></svg>;
    case 'needle':
      return <svg {...common}><path d="M20 4L7 17" /><path d="M16 8l4-4" /><path d="M6 18l-2 2" /><path d="M8 16l3 3" /><path d="M5 19l3 1" /><circle cx="18" cy="6" r="1.4" /></svg>;
    case 'category':
      return <svg {...common}><path d="M4 6h7v7H4zM13 6h7v7h-7zM4 15h7v5H4zM13 15h7v5h-7z" /></svg>;
    case 'success':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12l2.5 2.5L16 9" /></svg>;
    case 'error':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></svg>;
    case 'warning':
      return <svg {...common}><path d="M12 3l10 18H2L12 3Z" /><path d="M12 9v5M12 17h.01" /></svg>;
    case 'shirt':
      return <svg {...common}><path d="M8 5l4-2 4 2 3 4-3 2v10H8V11L5 9l3-4Z" /></svg>;
    case 'hat':
      return <svg {...common}><path d="M3 15h18" /><path d="M6 15c1.2-4.2 3.5-7 6-7s4.8 2.8 6 7" /><path d="M9 8.5c1-.8 2-1.2 3-1.2s2 .4 3 1.2" /></svg>;
    case 'trouser':
      return <svg {...common}><path d="M8 3h8l1 18h-4l-1-7-1 7H7l1-18Z" /></svg>;
    case 'sparkle':
      return <svg {...common}><path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3Z" /><path d="M18 14l.8 1.8L20.6 16l-1.8.8L18 18.6l-.8-1.8-1.8-.8 1.8-.8L18 14Z" /></svg>;
    case 'bag':
      return <svg {...common}><rect x="5" y="8" width="14" height="12" rx="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
    case 'scissors':
      return <svg {...common}><circle cx="6" cy="17" r="2" /><circle cx="6" cy="7" r="2" /><path d="M8 8l12 8M8 16l12-8" /></svg>;
    case 'help':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.2" /><path d="M12 17h.01" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}