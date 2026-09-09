/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["postgres"],
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
