import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production'

// Production CSP — Next.js 16 (App Router + Turbopack) ships its
// hydration as inline <script> tags that call self.__next_f.push(...)
// PLUS uses `eval` / `new Function()` in the runtime for chunk
// resolution. Both 'unsafe-inline' and 'unsafe-eval' are required
// or React silently fails to hydrate — buttons render as static
// HTML with no event handlers attached. Verified empirically
// 2026-05-08 by reproducing the exact symptom Dylan reported.
//
// Honest security tradeoff: 'unsafe-inline' + 'unsafe-eval' on
// script-src weakens XSS defense. Mitigations still in place:
// 'self' + vercel.live as the only sources, strict frame-ancestors
// 'none' (no clickjacking), HSTS preload, no `eval(userInput)`
// surface in the codebase, every API route validates inputs.
//
// Proper long-term fix: nonce-based CSP via middleware.ts that
// generates a per-request nonce, applies it to every Next.js
// inline script tag, and uses 'strict-dynamic' to allow chunk
// loading transitively. Tracking that as a follow-up — for tonight
// this is the only working CSP that matches Next 16's runtime.
const productionCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
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
