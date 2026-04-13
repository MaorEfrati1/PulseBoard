import { api } from './axios';
import { TokenPair, User } from '../types';

export interface LoginPayload {
    email: string;
    password: string;
}

export interface RegisterPayload {
    email: string;
    password: string;
    fullName: string;
}

export interface AuthResponse {
    user: User;
    tokens: TokenPair;
}

export interface RefreshResponse {
    accessToken: string;
    refreshToken: string;
}

const authApi = {
    login: (payload: LoginPayload) =>
        api.post<AuthResponse>('/auth/login', payload).then((r) => r.data),

    register: (payload: RegisterPayload) =>
        api.post<AuthResponse>('/auth/register', payload).then((r) => r.data),

    refresh: (refreshToken: string) =>
        api
            .post<RefreshResponse>('/auth/refresh', { refreshToken })
            .then((r) => r.data),

    logout: (refreshToken: string) =>
        api.post('/auth/logout', { refreshToken }).then((r) => r.data),

    me: () => api.get<User>('/auth/me').then((r) => r.data),
};

export default authApi;