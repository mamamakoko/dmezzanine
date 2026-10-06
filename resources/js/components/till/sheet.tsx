import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';

interface SheetProps {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    /** Shown under the title. */
    description?: ReactNode;
    /** Tailwind max-width class; the prototype's sheets are 380–600px wide. */
    width?: string;
    className?: string;
    children: ReactNode;
}

/**
 * A till modal: charcoal scrim at 45%, cream sheet, 160ms entrance.
 */
export function Sheet({ open, onClose, title, description, width = 'max-w-[520px]', className, children }: SheetProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="bg-text/45 fixed inset-0 z-40" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className={cn(
                        'bg-bg font-body text-text motion-safe:animate-tin fixed top-1/2 left-1/2 z-40 max-h-[88vh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-auto overscroll-contain rounded-md px-7 py-[26px] shadow-[var(--shadow-lg)]',
                        width,
                        className,
                    )}
                >
                    <DialogPrimitive.Title className="m-0 text-xl">{title}</DialogPrimitive.Title>
                    {description && <p className="text-text/74 mt-1 mb-[18px] text-[13.5px]">{description}</p>}
                    {children}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    body: ReactNode;
    cancelLabel: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * A two-button question, such as "Exit?" or "Void this order?".
 */
export function ConfirmDialog({ open, title, body, cancelLabel, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
    return (
        <Sheet open={open} onClose={onCancel} title={title} width="max-w-[400px]" className="z-[60]">
            <p className="text-text/74 mt-2 mb-[22px] text-sm">{body}</p>
            <div className="flex gap-2.5">
                <button type="button" onClick={onCancel} className="btn btn-secondary flex-1 p-[13px] font-semibold">
                    {cancelLabel}
                </button>
                <button type="button" onClick={onConfirm} className="btn btn-primary flex-1 p-[13px] font-semibold">
                    {confirmLabel}
                </button>
            </div>
        </Sheet>
    );
}

/**
 * A short message at the bottom of the till.
 */
export function Toast({ message }: { message: string }) {
    if (!message) {
        return null;
    }

    return (
        <div
            role="status"
            className="font-body motion-safe:animate-tin fixed bottom-6 left-1/2 z-[90] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-md bg-neutral-900 px-5 py-3 text-[13.5px] font-semibold text-neutral-100 shadow-[var(--shadow-lg)]"
        >
            {message}
        </div>
    );
}

/** Classes for a choice button (size, milk, payment method, cash amount), on or off. */
export const choiceClass = (on: boolean) =>
    cn(
        'rounded-btn cursor-pointer border font-semibold',
        on ? 'border-accent bg-accent-200 text-accent-800' : 'border-divider text-text hover:border-accent-400 bg-neutral-100',
    );
