import { mergeConfig } from 'vite';
import baseConfig from './vite.config.js';

export default mergeConfig(baseConfig, {
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.API_PORT || '8080'}`, 
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
