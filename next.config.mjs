import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,

  async headers() {
    // Production: strict CSP. Dev: relaxed for hot-reload.
    const connectSrc = isProd
      ? "connect-src 'self'"
      : "connect-src 'self' http://127.0.0.1:3001 http://localhost:3001 ws://127.0.0.1:3001 ws://localhost:3001";

    // Production: no unsafe-eval. Dev: needed for Next.js hot-reload / source maps.
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    const securityHeaders = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          scriptSrc,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          connectSrc,
          "form-action 'self'",
        ].join("; "),
      },
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    // Server-only пакеты: не бандлить (native/CJS, избегаем ESM-конфликтов)
    serverComponentsExternalPackages: ['pg', 'pgvector', 'openai', 'pizzip', 'docxtemplater'],
  },
  // Исключаем папки с данными из сборки
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@"] = path.resolve(__dirname, ".");
    config.resolve.alias["@lib"] = path.resolve(__dirname, "lib");
    config.resolve.alias["@services"] = path.resolve(__dirname, "services");
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/00_SYSTEM/**',
        '**/data/**',
        '**/Новая папка/**',
        '**/РД — копия/**',
        '**/tv3 — копия/**',
        '**/аи-9 — копия/**',
        '**/договоры — копия/**',
        '**/климов — копия/**',
        '**/ОДК — копия/**',
        '**/одк-стар — копия/**',
        '**/окр — копия/**',
        '**/письма — копия/**',
        '**/платежи — копия/**',
        '**/Руководство по среднему ремонту — копия/**',
        '**/ТУ ММ 2.0 — копия/**',
      ],
    };
    return config;
  },
};

export default nextConfig;
