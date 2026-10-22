import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { originHome } from '../../libs/origin';

// Full-page link to the home of the site the user came from. Never next/link: on sleepysquid.com
// these pages are proxied from the drones app, so a client route to "/" would show the drones home.
export default function HomeLink({ children, ...props }) {
  const router = useRouter();
  const [href, setHref] = useState('/');
  useEffect(() => { setHref(originHome(router.query.from)); }, [router.query.from]);
  return <a href={href} data-home-link {...props}>{children}</a>;
}
