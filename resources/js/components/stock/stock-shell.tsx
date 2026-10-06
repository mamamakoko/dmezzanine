import { ConfirmDialog, Toast } from '@/components/till/sheet';
import { type StockBranch } from '@/lib/stock';
import { type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';

interface StockShellProps {
    appName: string;
    kicker: string;
    title: string;
    branch: StockBranch;
    /** The café branches the Owner can switch between; null for everyone else. */
    branches: StockBranch[] | null;
    onBranch: (id: number) => void;
    nav: ReactNode;
    /** Shown at the right of the sticky header, such as a status pill or search. */
    headerEnd?: ReactNode;
    exitBody: string;
    toast: string;
    children: ReactNode;
}

/**
 * The charcoal sidebar and sticky header shared by Stock Count and Stock Report.
 */
export function StockShell({ appName, kicker, title, branch, branches, onBranch, nav, headerEnd, exitBody, toast, children }: StockShellProps) {
    const { auth } = usePage<SharedData>().props;
    const [exiting, setExiting] = useState(false);
    const initials = auth.user.name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2);

    return (
        <div className="bg-bg font-body text-text grid min-h-screen grid-cols-1 tabular-nums md:h-screen md:grid-cols-[246px_1fr]">
            <aside className="flex flex-col overflow-hidden bg-neutral-900 text-neutral-100 print:hidden">
                <div className="flex flex-none items-center gap-[11px] px-[18px] pt-5 pb-4">
                    <img src="/images/logo.png" alt="D' Mezzanine Cafe" className="size-9 flex-none rounded-full object-cover" />
                    <div>
                        <div className="text-[15px] leading-[1.15] font-semibold">{appName}</div>
                        <div className="text-gold text-[10px] tracking-[.28em]">D’ MEZZANINE CAFE</div>
                    </div>
                </div>

                <div className="flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2.5 pt-1 pb-4">
                    {nav}

                    <div className="rounded-btn mt-5 bg-neutral-100/7 px-[13px] pt-[13px] pb-3.5">
                        <div className="text-[10px] tracking-[.16em] uppercase opacity-60">
                            {appName === 'DMC Stock Count' ? 'Counting for' : 'Branch'}
                        </div>
                        {branches ? (
                            <select
                                aria-label="Branch"
                                value={branch.id}
                                onChange={(event) => onBranch(Number(event.target.value))}
                                className="focus:border-accent rounded-btn mt-1.5 w-full cursor-pointer border border-white/18 bg-neutral-800 px-2 py-[7px] text-[13px] font-semibold text-neutral-100"
                            >
                                {branches.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="mt-[5px] text-[13.5px] leading-[1.25] font-semibold">{branch.name}</div>
                        )}
                        <div className="mt-[5px] text-[11.5px] opacity-60">{branches ? 'Owner · switch branch' : 'Your assigned branch'}</div>
                    </div>
                </div>

                <div className="flex-none border-t border-white/12 px-[18px] pt-3.5 pb-[18px] text-xs">
                    <div className="flex items-center gap-[9px]">
                        <div className="flex size-7 items-center justify-center rounded-full bg-neutral-700 text-[11px] font-semibold">
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[12.5px]">{auth.user.name}</div>
                            <div className="text-[11px] opacity-55">{auth.role}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setExiting(true)}
                        className="rounded-btn mt-3 min-h-10 w-full cursor-pointer border border-white/14 bg-transparent px-2.5 py-2 text-center text-[12.5px] text-neutral-100/72 hover:bg-neutral-100/8 hover:text-neutral-100"
                    >
                        Exit
                    </button>
                </div>
            </aside>

            <div className="relative min-w-0 overflow-x-hidden overflow-y-auto">
                <div className="border-divider bg-bg/92 sticky top-0 z-[5] flex flex-wrap items-end gap-5 border-b px-4 pt-[22px] pb-4 backdrop-blur-[8px] sm:px-8">
                    <div className="min-w-[200px] flex-[1_1_220px]">
                        <div className="text-text/74 text-[11.5px] tracking-[.1em] uppercase">{kicker}</div>
                        <h2 className="mt-1 mb-0 text-[23px] leading-[1.1]">{title}</h2>
                    </div>
                    {headerEnd}
                </div>
                <div className="px-4 pt-[26px] pb-[60px] sm:px-8">{children}</div>
            </div>

            <ConfirmDialog
                open={exiting}
                title="Exit?"
                body={exitBody}
                cancelLabel="Stay here"
                confirmLabel="Exit"
                onCancel={() => setExiting(false)}
                onConfirm={() => router.visit(route('home'))}
            />
            <Toast message={toast} />
        </div>
    );
}

interface NavItemProps {
    label: string;
    icon?: string;
    count?: string;
    active: boolean;
    onClick: () => void;
}

export function NavHeading({ children }: { children: ReactNode }) {
    return <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-[.16em] uppercase opacity-42">{children}</div>;
}

export function NavItem({ label, icon, count, active, onClick }: NavItemProps) {
    return (
        <button
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={onClick}
            className={`rounded-btn flex min-h-9 w-full cursor-pointer items-center gap-[9px] px-3 py-[9px] text-left text-[13px] ${
                active ? 'bg-accent font-semibold text-neutral-100' : 'bg-transparent font-medium text-neutral-100/82 hover:bg-white/6'
            }`}
        >
            {icon !== undefined && (
                <span aria-hidden className="w-4 flex-none text-center text-xs opacity-85">
                    {icon}
                </span>
            )}
            <span className="flex-1">{label}</span>
            {count && <span className="flex-none text-[11px] tabular-nums opacity-55">{count}</span>}
        </button>
    );
}
