import { api } from './axios';
import { User, TokenPair } from '../types';

// ─── Payload Types ────────────────────────────────────────────────────────────

export interface LoginPayload {
    email: string;
    password: string;
}

export interface RegisterPayload {
    fullName: string;
    email: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    tokens: TokenPair;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const authApi = {
    login: (payload: LoginPayload): Promise<AuthResponse> =>
        api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

    register: (payload: RegisterPayload): Promise<AuthResponse> =>
        api.post<AuthResponse>('/auth/register', payload).then((r) => r.data),

    logout: (): Promise<void> =>
        api.post('/auth/logout').then(() => undefined),

    refreshToken: (refreshToken: string): Promise<TokenPair> =>
        api
            .post<TokenPair>('/auth/refresh', { refreshToken })
            .then((r) => r.data),

    me: (): Promise<User> =>
        api.get<User>('/auth/me').then((r) => r.data),
};

export default authApi;