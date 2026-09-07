/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  async redirects() {
    return [
      {
        source: "/scanner",
        destination: "/dashboard/scanner",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;

