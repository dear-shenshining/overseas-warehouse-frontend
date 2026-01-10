/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Next.js 16 中 serverActions 可以直接配置
  serverActions: {
    bodySizeLimit: 50 * 1024 * 1024, // 50MB in bytes (52428800)
  },
  // 如果上面的配置不生效，尝试使用 experimental（Next.js 16 通常不需要）
  experimental: {
    serverActions: {
      bodySizeLimit: 50 * 1024 * 1024, // 50MB in bytes
    },
  },
}

export default nextConfig
