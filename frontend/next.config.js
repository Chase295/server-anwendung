/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  async rewrites() {
    // Im Docker-Container verwende den Service-Namen, sonst localhost
    const backendUrl = process.env.DOCKER_ENV 
      ? 'http://backend:3000' 
      : 'http://localhost:3000';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig

