export const appConfig = {
  port: Number(process.env.API_PORT ?? 3000),
  prefix: process.env.API_PREFIX ?? "/api",
};
