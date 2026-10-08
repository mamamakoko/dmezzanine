import { Sheet } from '@/components/till/sheet';
import { ISSUE_REASONS, type TransferLineRow, type TransferRow } from '@/lib/transfers';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface IssueSheetProps {
    target: { transfer: TransferRow; line: TransferLineRow } | null;
    onClose: () => void;
    onSave: (reason: string, note: string) => void;
    busy?: boolean;
}

/**
 * Report what went wrong with a transfer line. It's a flag for both ends; stock doesn't change.
 */
export function IssueSheet({ target, onClose, onSave, busy }: IssueSheetProps) {
    const [reason, setReason] = useState(ISSUE_REASONS[0].value);
    const [note, setNote] = useState('');

    useEffect(() => {
        setReason(target?.line.issue?.reason ?? ISSUE_REASONS[0].value);
        setNote(target?.line.issue?.note ?? '');
    }, [target]);

    return (
        <Sheet open={target !== null} onClose={onClose} title="Report an issue" width="max-w-[440px]" className="z-[64]">
            <div className="text-text/74 -mt-1 mb-[18px] text-[13.5px]">
                {target?.transfer.no} · {target?.line.name}
            </div>
            <div className="text-text/74 mb-2 text-xs">What went wrong?</div>
            <div className="mb-[18px] flex flex-wrap gap-2">
                {ISSUE_REASONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setReason(option.value)}
                        className={cn(
                            'border-divider rounded-btn min-h-10 cursor-pointer border px-3 py-[7px] text-[12.5px]',
                            reason === option.value ? 'bg-neutral-900 text-neutral-100' : 'bg-bg text-text',
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <label htmlFor="issue-note" className="text-text/74 mb-1.5 block text-xs">
                Notes (optional)
            </label>
            <textarea
                id="issue-note"
                rows={3}
                value={note}
                maxLength={300}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. 4 of 20 packs crushed, driver informed"
                className="border-divider rounded-btn bg-bg text-text w-full resize-y border p-2.5 text-[13px]"
            />
            <div className="mt-5 flex gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary flex-1 p-[11px] text-[13.5px]">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSave(reason, note.trim())}
                    className="btn btn-primary flex-1 p-[11px] text-[13.5px] font-semibold disabled:opacity-50"
                >
                    Flag issue
                </button>
            </div>
        </Sheet>
    );
}
