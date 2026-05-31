import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  resolve: {
    alias: {
      buffer: "buffer/",
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          solana: [
            "@solana/web3.js",
            "@solana/wallet-adapter-base",
            "@solana/wallet-adapter-react",
            "@solana/wallet-adapter-react-ui",
            "@solana/wallet-standard-wallet-adapter-react",
          ],
        },
      },
    },
  },
});
