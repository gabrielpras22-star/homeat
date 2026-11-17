import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'ancienne adresse (avant le changement de nom) renvoie vers la nouvelle.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "homeat-sigma.vercel.app" }],
        destination: "https://shareat-fr.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
