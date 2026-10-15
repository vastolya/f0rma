import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-сервер по умолчанию пускает только localhost. Чтобы сайт открывался
  // с телефона по локальному Wi‑Fi (http://192.168.x.x:3000), разрешаем
  // адреса домашних сетей. На продакшен это не влияет.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
