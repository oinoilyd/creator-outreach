import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production'

// Production CSP — strict. No 'unsafe-eval', no 'unsafe-inline' on scripts.
// Inline styles ARE allowed because Next.js + Tailwind generate inline
// style attributes (e.g. CSS variable assignments) that CSP'd inline-style
// blocks would break for cosmetic reasons.
const productionCsp = [
  "default-src 'self'",
  // Scripts: self + Vercel feedback only. No unsafe-eval, no unsafe-inline
  // — defense-in-depth against any reflected/stored XSS hole.
  "script-src 'self' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://vercel.live",
  "font-src 'self' https://vercel.live",
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// Dev CSP — Next.js HMR / Turbopack dev refresh injects inline + eval'd
// scripts; we allow them only when NODE_ENV !== 'production'.
const devCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://vercel.live",
  "font-src 'self' https://vercel.live",
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limit referrer info sent to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable browser features we don't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Force HTTPS for 2 years (only applies in production)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Content Security Policy — environment-aware
  { key: 'Content-Security-Policy', value: isProd ? productionCsp : devCsp },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
