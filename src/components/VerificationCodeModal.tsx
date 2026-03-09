import { useEffect, useState } from 'react';
import { Button } from './ui/Button';

interface VerificationCodeModalProps {
    code: string;
    onClose: () => void;
}

export function VerificationCodeModal({ code, onClose }: VerificationCodeModalProps) {
    const [countdown, setCountdown] = useState(10);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            onClose();
        }
    }, [countdown, onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Verification Code</h2>
                <p className="mb-4">Your Tasker verification code is:</p>
                <div className="text-center mb-4">
                    <span className="text-3xl font-mono font-bold bg-gray-100 px-4 py-2 rounded">
                        {code}
                    </span>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    This code expires in 24 hours. Copy it now!
                </p>
                <p className="text-lg font-semibold text-red-600 mb-4">
                    Time remaining: {countdown} seconds
                </p>
                <div className="flex justify-end">
                    <Button onClick={onClose} variant="secondary">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}