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

// Strctured Data for Rich Results on Google. Learn more: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
// Find your type here (SoftwareApp, Book...): https://developers.google.com/search/docs/appearance/structured-data/search-gallery
// Use this tool to check data is well structure: https://search.google.com/test/rich-results
// You don't have to use this component, but it increase your chances of having a rich snippet on Google.
// I recommend this one below to your /page.js for software apps: It tells Google your AppName is a Software, and it has a rating of 4.8/5 from 12 reviews.
// Fill the fields with your own data
// SEO configuration for SleepySquid Drones
export const renderSchemaTags = () => {
  // Sanitize all config values to prevent XSS
  const safeAppName = sanitizeForJSON(config.appName);
  const safeAppDescription = sanitizeForJSON(config.appDescription);
  const safeDomainName = sanitizeForJSON(config.domainName);
  
  // Validate and sanitize URLs
  const safeImageURL = sanitizeURL(`https://${safeDomainName}/icon.png`);
  const safeAppURL = sanitizeURL(`https://${safeDomainName}/`);
  
  const schemaData = {
          "@context": "http://schema.org",
          "@type": "LocalBusiness",
    "@id": safeAppURL,
    name: safeAppName,
    description: safeAppDescription,
    image: safeImageURL,
    url: safeAppURL,
    serviceType: ["Drone Photography", "Aerial Videography", "Real Estate Photography", "Construction Documentation", "Mapping Services"],
    areaServed: "United States",
          founder: {
            "@type": "Person",
            name: "Lawrence Bass",
          },
          datePublished: "2023-08-01",
          priceRange: "$199-$799",
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: "4.9",
            ratingCount: "27",
          },
          offers: [
            {
              "@type": "Service",
              name: "Basic Drone Photography Package",
              price: "199.00",
              priceCurrency: "USD",
              description: "Essential aerial package perfect for real estate listings, basic inspections, or simple photography projects"
            },
            {
              "@type": "Service", 
              name: "Standard Drone Services Package",
              price: "399.00",
              priceCurrency: "USD",
              description: "Complete aerial documentation ideal for real estate marketing, event coverage, or comprehensive projects"
            },
            {
              "@type": "Service",
              name: "Premium Drone Services Package", 
              price: "799.00",
              priceCurrency: "USD",
              description: "Professional-grade package designed for mapping, commercial inspections, or premium documentation needs"
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
