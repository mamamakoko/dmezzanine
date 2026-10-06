import { cn } from '@/lib/utils';

export type TillScreen = 'till' | 'queue' | 'inventory';

interface TopBarProps {
    branchName: string;
    clock: string;
    /** The marketing inbox button: how many orders are waiting, and opening the inbox. Hidden when null. */
    inbox: { waiting: number; onOpen: () => void } | null;
    /** Till, Queue and (for the branch lead or Owner) Inventory; the order-only Branch Menu has just the till. */
    screens: { value: TillScreen; label: string; badge?: number }[];
    screen: TillScreen;
    onScreen: (screen: TillScreen) => void;
    printerName: string | null;
    onPrinter: () => void;
    staffName: string;
    onExit: () => void;
}

/**
 * The charcoal bar across the top of the till: logo and branch, screen tabs, clock, printer and Exit.
 */
export function TopBar({ branchName, clock, inbox, screens, screen, onScreen, printerName, onPrinter, staffName, onExit }: TopBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 bg-neutral-900 px-5 py-3 text-neutral-100">
            <div className="flex items-center gap-2.5">
                <img src="/images/logo.png" alt="D' Mezzanine Cafe" className="size-[34px] flex-none rounded-full object-cover" />
                <div>
                    <div className="text-[15px] leading-[1.15] font-semibold">D’ Mezzanine Cafe</div>
                    <div className="text-gold text-[10.5px] tracking-[.16em]">{branchName}</div>
                </div>
            </div>

            {screens.length > 1 && (
                <div className="ml-3.5 flex gap-1.5">
                    {screens.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => onScreen(tab.value)}
                            className={cn(
                                'rounded-btn flex min-h-11 cursor-pointer items-center gap-2 px-[18px] text-sm font-semibold',
                                screen === tab.value ? 'bg-accent text-bg' : 'bg-accent-2-800 hover:bg-accent-2-700 text-neutral-100',
                            )}
                        >
                            {tab.label}
                            {!!tab.badge && (
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 text-[11.5px] leading-[18px] tabular-nums',
                                        screen === tab.value ? 'bg-bg text-accent-700' : 'bg-accent text-bg',
                                    )}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex-1" />

            {inbox && (
                <button
                    type="button"
                    onClick={inbox.onOpen}
                    title="Orders sent by marketing"
                    className={cn(
                        'rounded-btn hover:border-accent flex min-h-11 cursor-pointer items-center gap-2 border bg-transparent px-[15px] text-[13px] font-semibold text-neutral-100',
                        inbox.waiting ? 'border-accent' : 'border-neutral-100/22',
                    )}
                >
                    <span className={cn('size-2 rounded-full', inbox.waiting ? 'bg-accent' : 'bg-neutral-100/40')} />
                    <span>{inbox.waiting ? `${inbox.waiting} new ${inbox.waiting === 1 ? 'order' : 'orders'}` : 'Marketing'}</span>
                </button>
            )}

            <div className="text-[13px] text-neutral-100/70 tabular-nums">{clock}</div>

            <button
                type="button"
                onClick={onPrinter}
                title={printerName ? 'Tap to release the printer' : 'Pair a USB thermal printer (Chrome/Edge)'}
                className="rounded-btn hover:border-accent-2-400 flex min-h-11 cursor-pointer items-center gap-2 border border-neutral-100/22 px-[15px] text-[13px]"
            >
                <span className={cn('size-2 rounded-full', printerName ? 'bg-accent-2-400' : 'bg-neutral-100/40')} />
                <span>{printerName ?? 'Connect printer'}</span>
            </button>

            <div className="hidden text-[13px] text-neutral-100/70 lg:block">{staffName}</div>

            <button
                type="button"
                onClick={onExit}
                className="rounded-btn hover:bg-accent-2-700 flex min-h-11 cursor-pointer items-center gap-2 border border-white/22 px-4 text-[13.5px] font-semibold text-neutral-100/82"
            >
                <span>Exit</span>
                <span aria-hidden className="text-sm">
                    ⎋
                </span>
            </button>
        </div>
    );
}
