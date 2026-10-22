import { useEffect, useState } from 'react';
import { DEFAULT_ORIGIN, ORIGINS, readOrigin } from '../../libs/origin';

// Shows the logo of the site the user last logged in from (ss_origin cookie). Cosmetic only.
export default function OriginLogo({ className = 'h-8 w-8 object-contain flex-shrink-0 rounded-md dark:bg-white dark:p-0.5' }) {
  const [o, setO] = useState(DEFAULT_ORIGIN);
  useEffect(() => { const k = readOrigin(); if (k) setO(ORIGINS[k]); }, []);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={o.src} alt={o.alt} className={className} width={o.w} height={o.h} data-origin-logo />;
}
