import { create } from 'zustand';
import { NetworkStatus } from '../types';

// ─── State & Actions ─────────────────────────────────────────────────────────

interface UIState {
    networkStatus: NetworkStatus;
    isOnline: boolean;
    unreadCount: number;
    activeTaskId: string | null;

    setNetworkStatus: (status: NetworkStatus) => void;
    setUnreadCount: (count: number) => void;
    incrementUnread: () => void;
    resetUnread: () => void;
    setActiveTaskId: (id: string | null) => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState>()((set) => ({
    networkStatus: 'online',
    isOnline: true,
    unreadCount: 0,
    activeTaskId: null,

    setNetworkStatus: (status) =>
        set({
            networkStatus: status,
            isOnline: status === 'online',
        }),

    setUnreadCount: (count) => set({ unreadCount: count }),

    incrementUnread: () =>
        set((state) => ({ unreadCount: state.unreadCount + 1 })),

    resetUnread: () => set({ unreadCount: 0 }),

    setActiveTaskId: (id) => set({ activeTaskId: id }),
}));