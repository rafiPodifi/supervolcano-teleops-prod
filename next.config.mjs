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
    // gRPC + protobuf loaders use dynamic require() and __dirname-relative
    // .proto files. Webpack bundling mangles those paths so unary calls
    // fast-fail with empty status — surfaces as "undefined undefined: undefined".
    // Keep them as runtime node_modules instead.
    serverComponentsExternalPackages: [
      "@google-cloud/video-intelligence",
      "@grpc/grpc-js",
      "@grpc/proto-loader",
      "google-gax",
    ],
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

