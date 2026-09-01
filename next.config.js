/** @type {import('next').NextConfig} */
const nextConfig = {
  // The PDF route loads custom font files and logo/stamp images via
  // filesystem paths at request time. Next.js's automatic file tracing for
  // serverless functions doesn't reliably pick up files referenced this
  // way, so they're declared explicitly — otherwise this works in local dev
  // but the fonts/images silently fail to load once deployed to Vercel.
  //
  // This option lives under `experimental` in Next.js 14 (this project's
  // version); it only became a stable top-level option in Next.js 15+. If
  // you upgrade Next.js later, check whether it needs to move back out.
  experimental: {
    outputFileTracingIncludes: {
      '/api/po/[id]/pdf/route': ['./src/pdf/fonts/**', './src/pdf/assets/**'],
    },
  },
};
module.exports = nextConfig;
