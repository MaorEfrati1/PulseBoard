import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { User, TokenPair } from '../types';

// ─── State & Actions ─────────────────────────────────────────────────────────

interface AuthState {
    user: User | null;
    tokens: TokenPair | null;
    isAuthenticated: boolean;

    setUser: (user: User) => void;
    setTokens: (tokens: TokenPair) => void;
    setAuth: (user: User, tokens: TokenPair) => void;
    logout: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            tokens: null,
            isAuthenticated: false,

            setUser: (user) => set({ user }),

            setTokens: (tokens) => set({ tokens }),

            setAuth: (user, tokens) =>
                set({ user, tokens, isAuthenticated: true }),

            logout: () =>
                set({ user: null, tokens: null, isAuthenticated: false }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // Persist only what is needed — never persist derived/ui state
            partialize: (state) => ({
                user: state.user,
                tokens: state.tokens,
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
);