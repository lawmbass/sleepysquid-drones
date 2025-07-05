const config = {
  // REQUIRED
  appName: "SleepySquid Drones",
  // REQUIRED: a short description of your app for SEO tags (can be overwritten)
  appDescription:
    "Professional drone photography, videography, and specialized aerial services. Stunning aerial perspectives for real estate, construction, events, and mapping projects.",
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
        name: "Basic",
        // A friendly description of the plan, displayed on the pricing page. Tip: explain why this plan and not others
        description: "Essential aerial package perfect for real estate listings, basic inspections, or simple photography projects",
        // The price you want to display, the one user will be charged on Stripe.
        price: 199,
        // If you have an anchor price (i.e. $29) that you want to display crossed out, put it here. Otherwise, leave it empty
        priceAnchor: null,
        features: [
          {
            name: "Up to 1 hour flight time",
          },
          { name: "15-20 high-resolution photos" },
          { name: "Key angle coverage (4-8 shots)" },
          { name: "Birds eye overview shots" },
          { name: "Property/subject elevation views" },
          { name: "Basic photo editing & color correction" },
          { name: "Digital delivery within 48 hours" },
          { name: "Commercial usage rights included" },
        ],
      },
      {
        // This plan will look different on the pricing page, it will be highlighted. You can only have one plan with isFeatured: true
        isFeatured: true,
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_standard_drone_service"
            : "price_standard_drone_service_prod",
        name: "Standard",
        description: "Complete aerial documentation ideal for real estate marketing, event coverage, or comprehensive projects",
        price: 399,
        priceAnchor: null,
        features: [
          {
            name: "Up to 2 hours flight time",
          },
          { name: "20-30 high-resolution photos" },
          { name: "Comprehensive angle coverage (8+ positions)" },
          { name: "Multiple altitude perspectives" },
          { name: "Detail and overview combinations" },
          { name: "2-3 minute edited highlight video" },
          { name: "Advanced photo editing & color grading" },
          { name: "Next-day digital delivery" },
          { name: "Raw files included" },
          { name: "Commercial usage rights" },
        ],
      },
      {
        priceId:
          process.env.NODE_ENV === "development"
            ? "price_premium_drone_service"
            : "price_premium_drone_service_prod",
        name: "Premium",
        description: "Professional-grade package designed for mapping, commercial inspections, or premium documentation needs",
        price: 799,
        priceAnchor: null,
        features: [
          {
            name: "Up to 4 hours flight time",
          },
          { name: "Comprehensive photo coverage (50+ images)" },
          { name: "Automated flight planning for precision" },
          { name: "Specialized data collection (mapping/3D)" },
          { name: "Complete 360° coverage at multiple altitudes" },
          { name: "Custom flight path planning" },
          { name: "5+ minute professional video production" },
          { name: "Advanced analytics & measurements" },
          { name: "Same-day rush delivery available" },
          { name: "Raw footage & source files" },
          { name: "Extended commercial licensing" },
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
