import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
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

// Only apply Sentry build plugin when all required env vars are set
const hasSentryConfig = !!(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
);

const finalConfig = withNextIntl(nextConfig);

export default hasSentryConfig
  ? withSentryConfig(finalConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: false,
    })
  : finalConfig;
