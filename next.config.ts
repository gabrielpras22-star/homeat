import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dossier du projet est la racine (évite de confondre avec un dossier parent).
  turbopack: { root: __dirname },
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
