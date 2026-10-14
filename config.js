const config = {
  // REQUIRED
  appName: "SleepySquid Drones",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "Professional drone photography, videography, and specialized aerial services. Stunning aerial perspectives for real estate, events, and mapping projects.",
  // REQUIRED (no https://, not trialing slash at the end, just the naked domain)
  domainName: "drones.sleepysquid.com",
  crisp: {
    // Crisp website ID. IF YOU DON'T USE CRISP: just remove this => Then add a support email in this config file (mailgun.supportEmail) otherwise customer support won't work.
    id: "",
    // Hide Crisp by default, except on route "/". Crisp is toggled with <ButtonSupport/>. If you want to show Crisp on every routes, just remove this below
    onlyShowOnRoutes: ["/"],
  },
  stripe: {
    // Create multiple plans in your Stripe dashboard, then add them here. You can add as many plans as you want, just make sure to add the priceId
    plans: [
      {
        // REQUIRED — we use this to find the plan in the webhook (for instance if you want to update the user's credits based on the plan)
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_basic_drone_service"
            : "price_basic_drone_service_prod",
        //  REQUIRED - Name of the plan, displayed on the pricing page
        name: "Listing Photos",
        description: "15-20 edited photos, 48-hour delivery.",
        price: 199,
        priceAnchor: null,
        features: [
          { name: "15-20 edited photos" },
          { name: "48-hour delivery" },
        ],
      },
      {
        isFeatured: true,
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_standard_drone_service"
            : "price_standard_drone_service_prod",
        name: "Listing Photos + Video",
        description: "15-20 edited photos and a short edited video up to 2 min, 48-hour delivery.",
        price: 399,
        priceAnchor: null,
        features: [
          { name: "15-20 edited photos" },
          { name: "Short edited video up to 2 min" },
          { name: "48-hour delivery" },
        ],
      },
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_premium_drone_service"
            : "price_premium_drone_service_prod",
        name: "Event Aerials",
        description: "From $500. Photo and video coverage, priced by event.",
        price: 500,
        priceAnchor: null,
        features: [
          { name: "Photo and video coverage" },
          { name: "Priced by event" },
        ],
      },
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_mapping_drone_service"
            : "price_mapping_drone_service_prod",
        name: "Mapping & 3D",
        description: "From $900, by quote.",
        price: 900,
        priceAnchor: null,
        features: [
          { name: "By quote" },
        ],
      },
    ],
  },
  aws: {
    // If you use AWS S3/Cloudfront, put values in here
    bucket: "bucket-name",
    bucketUrl: `https://bucket-name.s3.amazonaws.com/`,
    cdn: "https://cdn-id.cloudfront.net/",
  },
  mailgun: {
    // subdomain to use when sending emails, if you don't have a subdomain, just remove it. Highly recommended to have one (i.e. mg.yourdomain.com or mail.yourdomain.com)
    subdomain: "mg",
    // REQUIRED — Email 'From' field to be used when sending magic login links
    fromNoReply: `SleepySquid Drones <noreply@sleepysquid.com>`,
    // REQUIRED — Email 'From' field to be used when sending other emails, like abandoned carts, updates etc..
    fromAdmin: `Lawrence Bass at SleepySquid Drones <lawrence@sleepysquid.com>`,
    // Email shown to customer if need support. Leave empty if not needed => if empty, set up Crisp above, otherwise you won't be able to offer customer support."
    supportEmail: "support@sleepysquid.com",
    // When someone replies to supportEmail sent by the app, forward it to the email below (otherwise it's lost). If you set supportEmail to empty, this will be ignored.
    forwardRepliesTo: "lawrence@sleepysquid.com",
  },
  colors: {
    // REQUIRED — The DaisyUI theme to use (added to the main layout.js). Leave blank for default (light & dark mode). If you any other theme than light/dark, you need to add it in config.tailwind.js in daisyui.themes.
    theme: "light",
    // REQUIRED — This color will be reflected on the whole app outside of the document (loading bar, Chrome tabs, etc..). 
    // Custom color for the main theme
    main: "#3b82f6", // Blue color that matches our admin theme
  },
  auth: {
    // REQUIRED — the path to log in users. It's use to protect private routes (like /dashboard). It's used in apiClient (/libs/api.js) upon 401 errors from our API
    loginUrl: "/api/auth/signin",
    // REQUIRED — the path you want to redirect users after successfull login (i.e. /dashboard, /private). This is normally a private page for users to manage their accounts. It's used in apiClient (/libs/api.js) upon 401 errors from our API & in ButtonSignin.js
    callbackUrl: "/dashboard",
  },
};

export default config;
