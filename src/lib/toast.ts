import { create } from 'zustand';

export interface ToastMessage {
    id: string;
    message: string;
    type: 'error' | 'success' | 'info';
    createdAt: number;
}

interface ToastStore {
    toasts: ToastMessage[];
    addToast: (message: string, type?: ToastMessage['type']) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],
    addToast: (message, type = 'error') => {
        const id = Math.random().toString(36).slice(2);
        set((state) => ({
            toasts: [...state.toasts, { id, message, type, createdAt: Date.now() }]
        }));
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, 5000);
    },
    removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    clearToasts: () => set({ toasts: [] })
}));