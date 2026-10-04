//@ts-check
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Next doesn't pick up stray lockfiles in parent dirs.
  turbopack: {
    root: path.join(__dirname, '../..'),
  },
};

module.exports = nextConfig;
