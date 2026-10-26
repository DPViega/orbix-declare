import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A proposta do hackathon é uma página estática em public/proposal. O endereço curto
  // /proposal leva ao arquivo: os caminhos relativos dela (./assets, ./vendor) dependem disso.
  async redirects() {
    return [{ source: "/proposal", destination: "/proposal/index.html", permanent: false }];
  },
  images: {
    // Logos de token no painel (TokenIcon): fonte estática do trustwallet/assets no GitHub.
    remotePatterns: [{ protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/trustwallet/assets/**" }],
  },
};

export default nextConfig;
