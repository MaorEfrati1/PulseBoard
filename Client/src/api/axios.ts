import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    InternalAxiosRequestConfig,
} from 'axios';

import { useAuthStore } from '../store/auth.store';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const REFRESH_ENDPOINT = '/auth/refresh';

// ─── Instance ────────────────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
});

// ─── Failed-queue pattern ────────────────────────────────────────────────────

interface FailedQueueItem {
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: FailedQueueItem[] = [];

function processQueue(error: unknown, token: string | null): void {
    failedQueue.forEach((item) => {
        if (error || token === null) {
            item.reject(error);
        } else {
            item.resolve(token);
        }
    });
    failedQueue = [];
}

// ─── Request interceptor — attach Bearer ─────────────────────────────────────

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const token = useAuthStore.getState().tokens?.accessToken;
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ─── Response interceptor — silent refresh ───────────────────────────────────

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as AxiosRequestConfig & {
            _retry?: boolean;
        };

        const status: number | undefined = error.response?.status;
        const isRefreshCall = originalRequest.url === REFRESH_ENDPOINT;

        // Only handle 401 on non-refresh calls that haven't been retried yet
        if (status !== 401 || originalRequest._retry || isRefreshCall) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // Queue the request until the ongoing refresh resolves
            return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((newToken) => {
                if (originalRequest.headers) {
                    (originalRequest.headers as Record<string, string>).Authorization =
                        `Bearer ${newToken}`;
                }
                return api(originalRequest);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            const refreshToken = useAuthStore.getState().tokens?.refreshToken;
            if (!refreshToken) throw new Error('No refresh token available');

            const { data } = await axios.post<{
                accessToken: string;
                refreshToken: string;
            }>(`${BASE_URL}${REFRESH_ENDPOINT}`, { refreshToken });

            useAuthStore.getState().setTokens(data);
            processQueue(null, data.accessToken);

            if (originalRequest.headers) {
                (originalRequest.headers as Record<string, string>).Authorization =
                    `Bearer ${data.accessToken}`;
            }

            return api(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            useAuthStore.getState().logout();
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);