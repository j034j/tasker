
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'danger';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
                    {
                        'bg-gradient-to-br from-primary to-blue-500 text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.3)] hover:-translate-y-[1px] hover:shadow-[0_14px_28px_hsl(var(--primary)/0.38)]': variant === 'default',
                        'border border-input/90 bg-card/80 text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.5),0_4px_12px_hsl(220_25%_20%/0.08)] hover:border-ring/40 hover:bg-card': variant === 'outline',
                        'text-foreground hover:bg-muted/85 hover:text-foreground': variant === 'ghost',
                        'bg-gradient-to-br from-destructive to-red-500 text-destructive-foreground shadow-[0_10px_24px_hsl(var(--destructive)/0.28)] hover:-translate-y-[1px]': variant === 'danger',
                        'h-10 px-4 py-2.5': size === 'default',
                        'h-8 rounded-lg px-3 text-xs': size === 'sm',
                        'h-11 rounded-xl px-8 text-base': size === 'lg',
                        'h-10 w-10': size === 'icon',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button };
