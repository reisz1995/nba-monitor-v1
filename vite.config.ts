import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const securityCheckPlugin = () => ({
  name: 'security-check',
  buildStart() {
    // Collect all environment variables that start with VITE_ but don't include ANON
    const clientEnv = Object.keys(process.env).filter(k =>
      k.startsWith('VITE_') && !k.includes('ANON')
    );

    const dangerousKeys = ['SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'CRON_SECRET'];
    const exposed = dangerousKeys.filter(k => clientEnv.includes(`VITE_${k}`));

    if (exposed.length > 0) {
      throw new Error(
        `🚨 SECURITY BREACH: ${exposed.join(', ')} expostas no cliente! ` +
        `Remova o prefixo VITE_ dessas variáveis para evitar vazamento no bundle.`
      );
    }

    console.log('✅ Security check passed - no core secrets exposed in client bundle');
  },
});

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), securityCheckPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          vendor: ['@supabase/supabase-js', '@google/genai', 'swr', 'zod'],
          ui: ['lucide-react', 'sonner', 'html-to-image'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  }
});
