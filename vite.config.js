import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' }
  },
  // Dependencies pre-bundle karo — cold start fast hoga
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'date-fns',
      'lucide-react'
    ]
  },
  server: {
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/pages/DashboardPage.jsx',
        './src/pages/PresalesPage.jsx',
      ]
    }
  }
})