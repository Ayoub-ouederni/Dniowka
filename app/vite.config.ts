import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// `pnpm dev:https` sets VITE_HTTPS=1: Android's Mobile Wallet Adapter only works in a
// secure context, so the phone on the LAN needs HTTPS (self-signed).
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ include: ["buffer"], globals: { Buffer: true, process: true } }),
    ...(process.env.VITE_HTTPS ? [basicSsl()] : []),
  ],
  test: {
    environment: "jsdom",
  },
});
