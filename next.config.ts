import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Strict mode for better development experience
  reactStrictMode: true,

  // Optimize images from Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // TypeScript checks during build
  typescript: {
    // Set to true only if you want to ignore type errors during build
    ignoreBuildErrors: false,
  },

  // Logging for debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

// Only wrap with Sentry when configured — avoids webpack plugin overhead in builds without Sentry
const sentryEnabled = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

let finalConfig: NextConfig = withNextIntl(nextConfig);

if (sentryEnabled) {
  const { withSentryConfig } = require("@sentry/nextjs");
  finalConfig = withSentryConfig(finalConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    bundleSizeOptimizations: {
      excludeDebugStatements: true,
      excludeReplayIframe: true,
      excludeReplayShadowDom: true,
    },
  });
}

export default finalConfig;
