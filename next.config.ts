import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "kfhoibszyssvazwwhcaa.supabase.co" },
      { protocol: "https", hostname: "*.top4top.io" },
      { protocol: "https", hostname: "cityupload.io" },
      { protocol: "https", hostname: "up6.cc" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "scontent.fatz1-1.fna.fbcdn.net" },
    ],
  },
};

export default nextConfig;
