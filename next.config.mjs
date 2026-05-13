/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // Legacy Firebase project — kept for any old asset URLs still in DB.
      { protocol: "https", hostname: "super-volcano-oem-portal.firebasestorage.app" },
      // New GCP project buckets (per-env).
      { protocol: "https", hostname: "*.storage.googleapis.com" },
    ],
  },
};

export default nextConfig;

