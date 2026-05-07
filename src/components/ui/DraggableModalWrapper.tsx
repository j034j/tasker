
import React, { useMemo, useRef } from 'react';
import Draggable from 'react-draggable';
import { createPortal } from 'react-dom';

interface DraggableModalWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    className?: string;
    hasUnsavedChanges?: boolean;
}

export function DraggableModalWrapper({ isOpen, onClose, children, className = '', hasUnsavedChanges = false }: DraggableModalWrapperProps) {
    const nodeRef = useRef(null);
    const portalTarget = useMemo(() => {
        if (typeof document === 'undefined') return null;
        return document.body;
    }, []);

    if (!isOpen || !portalTarget) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (hasUnsavedChanges) {
                const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close? Your data will be lost.');
                if (!confirmClose) return;
            }
            console.log('[TaskModal][BackdropClose] backdrop clicked, closing modal');
            onClose();
        }
    };

    return createPortal(
        <div
            className="animate-in fade-in bg-black/50 backdrop-blur-sm"
            style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                boxSizing: 'border-box',
                width: '100vw',
                height: '100dvh',
                padding: '1rem',
                display: 'grid',
                placeItems: 'center',
                zIndex: 9999,
            }}
            onClick={handleBackdropClick}
        >
            <Draggable
                nodeRef={nodeRef}
                handle=".modal-handle"
                defaultPosition={{ x: 0, y: 0 }}
            >
                <div
                    ref={nodeRef}
                    className={`modal-solid-bg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative ${className}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        isolation: 'isolate',
                        boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.5)',
                        maxHeight: 'calc(100dvh - 2rem)',
                        margin: 0,
                    }}
                >
                    {children}
                </div>
            </Draggable>
        </div>
        ,
        portalTarget
    );
}
