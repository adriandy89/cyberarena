// Re-exported types for DI consumers (avoids circular imports between the
// auth module and its guards/controllers).
export { AUTH } from './auth.constants';
export type { AuthInstance, AuthSession, AuthUser } from './auth';
