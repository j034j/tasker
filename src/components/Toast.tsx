import { useToastStore, type ToastMessage } from '@/lib/toast';

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
    const bgColor = toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-blue-500';
    return (
        <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 min-w-[280px] max-w-md animate-in slide-in-from-right`}>
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
        </div>
    );
}

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();
    if (toasts.length === 0) return null;
    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}