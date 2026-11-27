import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import Layout from '@/components/layout/Layout';
import { blurProps } from '@/components/home/marketingImageBlur';
import { SERVICE_NAV, SITE_ORIGIN } from '@/libs/publicPages.mjs';

export default function ServiceArticle({ title, description, path, children }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_ORIGIN}${path}`} />
      </Head>
      <Layout>
        <article className="bg-white dark:bg-gray-900">
          <div className="container mx-auto max-w-3xl px-4 md:px-6 pb-20 pt-28 md:pt-32">
            {children}
            <nav aria-label="More services" className="mt-16 border-t border-gray-200 pt-8 dark:border-gray-700">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">More</h2>
              <ul className="space-y-2">
                {SERVICE_NAV.filter((item) => item.href !== path).map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-blue-600 hover:underline dark:text-blue-400">
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/#pricing" className="text-blue-600 hover:underline dark:text-blue-400">
                    All packages
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </article>
      </Layout>
    </>
  );
}

export function PageKicker({ children }) {
  return (
    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-sky-300">
      {children}
    </p>
  );
}

export function PageTitle({ children }) {
  return (
    <h1 className="mb-4 text-3xl font-bold leading-tight text-gray-900 dark:text-white md:text-4xl">
      {children}
    </h1>
  );
}

export function PageText({ children }) {
  return <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300">{children}</p>;
}

export function PageHeading({ children }) {
  return <h2 className="mb-3 mt-10 text-2xl font-semibold text-gray-900 dark:text-white">{children}</h2>;
}

export function ScopeList({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-gray-700 dark:text-gray-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PlainNote({ children }) {
  return (
    <aside className="mt-8 border-l-4 border-gray-300 pl-4 text-gray-800 dark:border-gray-600 dark:text-gray-200">
      {children}
    </aside>
  );
}

export function BookPackageLink({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:shadow-lg"
    >
      {children}
    </Link>
  );
}

export function PriceRow({ name, price, detail, href, cta }) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 py-5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{name}</h2>
        {detail ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{detail}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{price}</p>
        <BookPackageLink href={href}>{cta}</BookPackageLink>
      </div>
    </div>
  );
}

export function ServicePhoto({ src, alt }) {
  return (
    <figure className="my-8">
      <div className="relative h-56 w-full overflow-hidden rounded-xl sm:h-72">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 720px"
          {...blurProps(src)}
        />
      </div>
    </figure>
  );
}
