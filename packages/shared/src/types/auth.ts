export interface SharedAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}
