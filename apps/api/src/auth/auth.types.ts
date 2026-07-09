import { Request } from 'express';

export type AuthenticatedAdmin = {
  id: number;
  username: string;
  displayName: string;
  passwordVersion: number;
  lastLoginAt: Date | null;
};

export type AuthenticatedRequest = Request & {
  admin: AuthenticatedAdmin;
};

export type MaybeAuthenticatedRequest = Request & {
  admin?: AuthenticatedAdmin;
};
