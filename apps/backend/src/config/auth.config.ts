export const authConfig = {
  accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
};
