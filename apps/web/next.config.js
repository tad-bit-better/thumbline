//@ts-check
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Next doesn't pick up stray lockfiles in parent dirs.
  turbopack: {
    root: path.join(__dirname, '../..'),
    // essentia's Emscripten loader names Node built-ins it only uses under Node.
    resolveAlias: {
      fs: { browser: './src/shims/empty.js' },
      path: { browser: './src/shims/empty.js' },
    },
  },
  // Screen-to-screen morphs with React's <ViewTransition> (docs/design/motion.md).
  experimental: {
    viewTransition: true,
  },
};

module.exports = nextConfig;
