/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  trailingSlash: false,
  compress: true,
  
  // Environment específico para admin
  env: {
    NEXT_PUBLIC_APP_TYPE: 'admin',
    NEXT_PUBLIC_APP_NAME: 'GateX Admin',
    NEXT_PUBLIC_APP_VERSION: 'admin-only',
  },
  
  // Otimizações experimentais
  experimental: {
    optimizePackageImports: ['@headlessui/react', '@heroicons/react', 'lucide-react'],
    webpackBuildWorker: true, // Use separate workers for webpack builds
    scrollRestoration: true,
    optimizeCss: true,
    esmExternals: true,
    // Otimizações para build mais rápido
    cpus: Math.max(1, require('os').cpus().length - 1), // Use todos os CPUs disponíveis menos 1
  },
  
  // Bundle optimization para produção
  webpack: (config, { dev, isServer }) => {
    // Fix para compatibilidade com Edge Runtime
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "crypto": false,
        "stream": false,
        "util": false,
        "os": false,
        "path": false,
      };
    }
    
    // Otimizações apenas para produção
    if (!dev && !isServer) {
      // Configurar chunks menores para loading mais rápido
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        maxSize: 150000, // 150KB max chunk size (reduzido)
        chunks: 'all',
        cacheGroups: {
          // Chunk separado para Firebase (prioridade alta)
          firebase: {
            name: 'firebase',
            test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
            chunks: 'all',
            priority: 50,
            maxSize: 120000, // Reduzido para 120KB
            enforce: true,
          },
          // Chunk para bibliotecas Web3 (carregamento sob demanda)
          web3: {
            name: 'web3',
            test: /[\\/]node_modules[\\/](ethers|@walletconnect|@web3modal|@reown|@wagmi|viem|wagmi)[\\/]/,
            chunks: 'async', // Mudado para async
            priority: 40,
            maxSize: 180000,
          },
          // Chunk para charts (carregamento sob demanda)
          charts: {
            name: 'charts',
            test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2|recharts|apexcharts|react-apexcharts|lightweight-charts)[\\/]/,
            chunks: 'async', // Mudado para async
            priority: 30,
            maxSize: 120000,
          },
          // React chunk (prioridade alta)
          react: {
            name: 'react',
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            chunks: 'all',
            priority: 60,
            maxSize: 80000,
            enforce: true,
          },
          // Chunk para UI (carregamento sob demanda)
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](@headlessui|@heroicons|lucide-react|framer-motion)[\\/]/,
            chunks: 'async',
            priority: 25,
            maxSize: 80000,
          },
          // Vendors críticos (carregamento imediato)
          vendors: {
            name: 'vendors',
            test: /[\\/]node_modules[\\/](next|@next|@tanstack)[\\/]/,
            chunks: 'all',
            priority: 45,
            maxSize: 80000,
            enforce: true,
          },
          // Vendors secundários (carregamento sob demanda)
          vendorsSecondary: {
            name: 'vendors-secondary',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'async',
            priority: 10,
            maxSize: 60000,
            minChunks: 2,
          }
        }
      };
      
      // Otimizar resolução de módulos
      config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
      
      // Adicionar otimizações de minificação
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Reduzir tamanho do bundle removendo source maps em produção
      config.devtool = false;
    }
    
    return config;
  },
  
  // Configurações de imagem (mantendo Firebase)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'gate33.net' },
      { protocol: 'https', hostname: 'gate33.me' },
    ],
  },
  
  // Headers de segurança básicos
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  
  // Configurações de compilação otimizadas
  poweredByHeader: false,
  distDir: '.next',
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'] // Keep error and warning logs
    } : false,
    styledComponents: true, // Optimize styled-components if used
  },
  
  // Performance optimizations
  onDemandEntries: {
    maxInactiveAge: 25 * 1000, // 25 seconds
    pagesBufferLength: 2,
  },
  
  // Cache optimization para build mais rápido
  generateBuildId: async () => {
    // Use hash do package.json para cache consistency
    const packageJson = require('./package.json');
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(packageJson.dependencies)).digest('hex');
  },
  
  // Build optimization
  excludeDefaultMomentLocales: true,
};

module.exports = nextConfig;
