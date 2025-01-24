// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        allowedHosts: ['artemis'], // Add your hostname here
    },
});