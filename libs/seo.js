import config from "@/config";

// These are all the SEO tags you can add to your pages.
// It prefills data with default title/description/OG, etc.. and you can cusotmize it for each page.
// It's already added in the root layout.js so you don't have to add it to every pages
// But I recommend to set the canonical URL for each page (export const metadata = getSEOTags({canonicalUrlRelative: "/"});)
// SEO configuration for SleepySquid Drones
export const getSEOTags = ({
  title,
  description,
  keywords,
  openGraph,
  canonicalUrlRelative,
  extraTags,
} = {}) => {
  return {
    // up to 50 characters (what does your app do for the user?) > your main should be here
    title: title || config.appName,
    // up to 160 characters (how does your app help the user?)
    description: description || config.appDescription,
    // some keywords separated by commas. by default it will be your app name
    keywords: keywords || [config.appName],
    applicationName: config.appName,
    // set a base URL prefix for other fields that require a fully qualified URL (.e.g og:image: og:image: 'https://yourdomain.com/share.png' => '/share.png')
    metadataBase: new URL(
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/"
        : `https://${config.domainName}/`
    ),

    openGraph: {
      title: openGraph?.title || config.appName,
      description: openGraph?.description || config.appDescription,
      url: openGraph?.url || `https://${config.domainName}/`,
      siteName: openGraph?.title || config.appName,
      // If you add an opengraph-image.(jpg|jpeg|png|gif) image to the /app folder, you don't need the code below
      // images: [
      //   {
      //     url: `https://${config.domainName}/share.png`,
      //     width: 1200,
      //     height: 660,
      //   },
      // ],
      locale: "en_US",
      type: "website",
    },

    twitter: {
      title: openGraph?.title || config.appName,
      description: openGraph?.description || config.appDescription,
      // If you add an twitter-image.(jpg|jpeg|png|gif) image to the /app folder, you don't need the code below (X/Twitter cards)
      // images: [openGraph?.image || defaults.og.image],
      card: "summary_large_image",
      creator: "@lawmbass",
      site: "@lawmbass",
    },

    // If a canonical URL is given, we add it. The metadataBase will turn the relative URL into a fully qualified URL
    ...(canonicalUrlRelative && {
      alternates: { canonical: canonicalUrlRelative },
    }),

    // If you want to add extra tags, you can pass them here
    ...extraTags,
  };
};

// Sanitize string to prevent XSS attacks (but preserve domain names for URLs)
const sanitizeForJSON = (str) => {
  if (typeof str !== 'string') return str;
  // Remove HTML tags and escape dangerous characters, but preserve & in domain names
  return str.replace(/<[^>]*>/g, '').replace(/[<>"']/g, (match) => {
    const escapeMap = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return escapeMap[match];
  });
};

// Validate URL to prevent XSS through URL injection
const sanitizeURL = (url) => {
  try {
    const parsedURL = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsedURL.toString();
  } catch {
    return 'https://example.com'; // Safe fallback
  }
};

// Structured data for the public homepage. LocalBusiness only.
// Do not add aggregateRating or a review count. Do not add streetAddress.
// SEO configuration for SleepySquid Drones
export const renderSchemaTags = () => {
  // Sanitize all config values to prevent XSS
  const safeAppName = sanitizeForJSON(config.appName);
  const safeAppDescription = sanitizeForJSON(config.appDescription);
  const safeDomainName = sanitizeForJSON(config.domainName);
  
  // Validate and sanitize URLs
  const safeImageURL = sanitizeURL(`https://${safeDomainName}/icon.png`);
  const safeAppURL = sanitizeURL(`https://${safeDomainName}/`);

  // Service-area business: do not add streetAddress. No iPostal1 box and no residential address.
  // Future business line: add telephone only after a public number is confirmed, as a tel:+1XXXXXXXXXX link.
  // Never publish a personal mobile number.
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": safeAppURL,
    name: safeAppName,
    description: safeAppDescription,
    image: safeImageURL,
    url: safeAppURL,
    serviceType: [
      "Listing Photos",
      "Listing Photos + Video",
      "Roof & Property Condition",
      "Construction Progress",
      "Event Aerials",
      "Mapping & 3D",
    ],
    areaServed: ["Washington, DC", "Maryland", "Virginia"],
    founder: {
      "@type": "Person",
      name: "Lawrence Bass",
    },
    datePublished: "2023-08-01",
    priceRange: "$199 - $1,200+",
    offers: [
            {
              "@type": "Service",
              name: "Listing Photos",
              price: "199.00",
              priceCurrency: "USD",
              description: "15-20 edited photos, 48-hour delivery"
            },
            {
              "@type": "Service",
              name: "Listing Photos + Video",
              price: "399.00",
              priceCurrency: "USD",
              description: "15-20 edited photos and a short edited video up to 2 min, 48-hour delivery"
            },
            {
              "@type": "Service",
              name: "Event Aerials",
              price: "500.00",
              priceCurrency: "USD",
              description: "From $500. Photo and video coverage, priced by event"
            },
            {
              "@type": "Service",
              name: "Mapping & 3D",
              price: "900.00",
              priceCurrency: "USD",
              description: "From $900, by quote"
            },
            {
              "@type": "Service",
              name: "Roof & Property Condition",
              price: "249.00",
              priceCurrency: "USD",
              description: "$249 per structure, flat. 20–30 edited photos of one structure, 48-hour delivery. Photos only — not a licensed roof inspection, damage diagnosis, claim opinion, thermal scan, or roof measurement report."
            },
            {
              "@type": "Service",
              name: "Construction Progress (single visit)",
              price: "350.00",
              priceCurrency: "USD",
              description: "$350 per visit. 20–30 edited photos from repeatable GPS points, plus 1 overhead overview, in a dated folder within 48 hours."
            },
            {
              "@type": "Service",
              name: "Construction Progress (2 visits/mo)",
              price: "650.00",
              priceCurrency: "USD",
              description: "$650 per month for 2 visits. 20–30 edited photos per visit from repeatable GPS points, plus 1 overhead overview."
            },
            {
              "@type": "Service",
              name: "Construction Progress (4 visits/mo)",
              price: "1200.00",
              priceCurrency: "USD",
              description: "$1,200 per month for 4 visits. 20–30 edited photos per visit from repeatable GPS points, plus 1 overhead overview."
            }
          ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemaData),
      }}
    ></script>
  );
};
