const { withFumadocs } = require('@fumadocs/mdx/config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@fumadocs/ui', '@fumadocs/core'],
};

module.exports = withFumadocs(nextConfig);
