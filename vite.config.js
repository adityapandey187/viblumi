import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local development the Python backend runs on port 8000
// (uvicorn). This proxy lets the frontend call "/api/..." without
// worrying about ports or CORS. On Vercel this file is ignored -
// /api/* is served by the Python serverless functions directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
