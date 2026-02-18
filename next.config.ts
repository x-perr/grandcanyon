import type { NextConfig } from "next";

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

export default nextConfig;
