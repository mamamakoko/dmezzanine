import { ConfirmDialog } from '@/components/till/sheet';
import { type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export type MarketingTab = 'order' | 'sent' | 'clients';

interface MarketingBarProps {
    active: MarketingTab;
    sentCount?: number;
    /** Switch between New order and Sent orders without leaving the page. */
    onTab?: (tab: 'order' | 'sent') => void;
}

/**
 * The charcoal bar across the top of Marketing: logo, New order / Sent orders / Client map, clock, the
 * agent's name and Exit.
 */
export function MarketingBar({ active, sentCount = 0, onTab }: MarketingBarProps) {
    const { auth } = usePage<SharedData>().props;
    const [exiting, setExiting] = useState(false);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 20000);

        return () => clearInterval(timer);
    }, []);

    const tabClass = (on: boolean) =>
        `rounded-btn flex min-h-11 cursor-pointer items-center px-[18px] text-sm font-semibold no-underline ${on ? 'bg-accent text-bg' : 'bg-transparent text-neutral-100/76 hover:text-neutral-100'}`;

    const tab = (value: 'order' | 'sent', label: string) =>
        onTab ? (
            <button type="button" onClick={() => onTab(value)} className={tabClass(active === value)}>
                {label}
            </button>
        ) : (
            <Link href={route('marketing', { tab: value })} className={tabClass(active === value)}>
                {label}
            </Link>
        );

    return (
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 bg-neutral-900 px-5 py-3 text-neutral-100">
            <div className="flex items-center gap-2.5">
                <img src="/images/logo.png" alt="D' Mezzanine Cafe" className="size-[34px] flex-none rounded-full object-cover" />
                <div>
                    <div className="text-[15px] leading-[1.15] font-semibold">D’ Mezzanine Cafe</div>
                    <div className="text-gold text-[10.5px] tracking-[.16em]">MARKETING</div>
                </div>
            </div>
            <nav className="ml-3.5 flex gap-1.5">
                {tab('order', 'New order')}
                {tab('sent', sentCount ? `Sent orders · ${sentCount}` : 'Sent orders')}
                <Link href={route('marketing.clients')} className={tabClass(active === 'clients')}>
                    Client map
                </Link>
            </nav>
            <div className="flex-1" />
            <div className="text-[13px] text-neutral-100/70 tabular-nums">
                {now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div className="text-[13px] font-semibold">{auth.user.name.split(' ')[0]}</div>
            <button
                type="button"
                onClick={() => setExiting(true)}
                className="rounded-btn hover:bg-accent-2-700 flex min-h-11 cursor-pointer items-center gap-2 border border-white/22 bg-transparent px-4 text-[13.5px] font-semibold text-neutral-100/82"
            >
                <span>Exit</span>
                <span aria-hidden className="text-sm">
                    ⎋
                </span>
            </button>
            <ConfirmDialog
                open={exiting}
                title="Exit?"
                body="You'll go back to your workspaces. Orders already sent stay with the branch."
                cancelLabel="Stay here"
                confirmLabel="Exit"
                onCancel={() => setExiting(false)}
                onConfirm={() => router.visit(route('home'))}
            />
        </div>
    );
}
