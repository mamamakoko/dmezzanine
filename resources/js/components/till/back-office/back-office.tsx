import { AddonsTab } from '@/components/till/back-office/addons-tab';
import { DashboardTab } from '@/components/till/back-office/dashboard-tab';
import { MenuTab } from '@/components/till/back-office/menu-tab';
import { PaymentsTab } from '@/components/till/back-office/payments-tab';
import { SalesTab } from '@/components/till/back-office/sales-tab';
import { StockInTab } from '@/components/till/back-office/stock-in-tab';
import { StockTab } from '@/components/till/back-office/stock-tab';
import { openBackOffice, TAB_META, type BackOfficeData, type BackOfficeTab } from '@/lib/back-office';
import { cn } from '@/lib/utils';

interface BackOfficeProps {
    data: BackOfficeData;
    branchName: string;
    branchId: number;
    staffName: string;
    staffRole: string;
    toast: (message: string) => void;
}

const TABS: BackOfficeTab[] = ['dash', 'menu', 'addons', 'payments', 'stock', 'stockin', 'sales'];

/**
 * The till's back office: a charcoal tab list on the left, the open tab on the right. Only the branch's
 * lead or the Owner gets here; the server checks every change again.
 */
export function BackOffice({ data, branchName, branchId, staffName, staffRole, toast }: BackOfficeProps) {
    const meta = TAB_META[data.tab];

    return (
        <div className="bg-bg font-body text-text flex min-h-screen flex-col md:h-screen md:flex-row">
            <nav className="flex flex-none flex-col bg-neutral-900 px-4 py-[22px] text-neutral-100 md:w-[232px]">
                <div className="flex items-center gap-2.5 px-1.5 pb-[22px]">
                    <img src="/images/logo.png" alt="D' Mezzanine Cafe" className="size-8 flex-none rounded-full object-cover" />
                    <div>
                        <div className="text-[15px] font-semibold">Back office</div>
                        <div className="text-gold text-[10.5px] tracking-[.16em]">{branchName}</div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-[3px] md:flex-col">
                    {TABS.map((tab) => {
                        const on = data.tab === tab;
                        const badge =
                            tab === 'stock' && data.lowCount ? data.lowCount : tab === 'stockin' && data.incomingCount ? data.incomingCount : null;

                        return (
                            <button
                                key={tab}
                                type="button"
                                aria-current={on ? 'page' : undefined}
                                onClick={() => openBackOffice(tab)}
                                className={cn(
                                    'rounded-btn flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-left text-sm font-semibold',
                                    on ? 'bg-accent text-bg' : 'bg-transparent text-neutral-100 hover:bg-white/8',
                                )}
                            >
                                <span>{TAB_META[tab].label}</span>
                                {badge && (
                                    <span
                                        className={cn(
                                            'rounded-btn min-w-5 px-1.5 text-center text-[11.5px] leading-5 tabular-nums',
                                            on ? 'bg-bg text-accent-700' : 'bg-accent text-bg',
                                        )}
                                    >
                                        {badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={() => openBackOffice(null)}
                    className="border-accent-2-700 rounded-btn mt-4 min-h-11 cursor-pointer border bg-transparent p-3 text-sm font-semibold text-neutral-100 hover:bg-white/8"
                >
                    ← Go to till
                </button>
                <div className="px-2 pt-3.5 text-[12.5px] text-neutral-100/62">
                    {staffName} · {staffRole}
                </div>
            </nav>

            <main className="flex min-w-0 flex-1 flex-col">
                <div className="px-4 pt-6 sm:px-[30px]">
                    <h2 className="m-0 mb-0.5 text-[26px]">{meta.title}</h2>
                    <p className="text-text/74 mt-0 mb-[18px] text-[13.5px]">{meta.sub}</p>
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-4 pb-[30px] sm:px-[30px]">
                    {data.tab === 'dash' && <DashboardTab data={data} branchName={branchName} />}
                    {data.tab === 'menu' && <MenuTab data={data} toast={toast} />}
                    {data.tab === 'addons' && <AddonsTab data={data} branchName={branchName} toast={toast} />}
                    {data.tab === 'payments' && <PaymentsTab data={data} branchName={branchName} toast={toast} />}
                    {data.tab === 'stock' && <StockTab data={data} />}
                    {data.tab === 'stockin' && <StockInTab data={data} branchName={branchName} branchId={branchId} toast={toast} />}
                    {data.tab === 'sales' && <SalesTab data={data} branchName={branchName} toast={toast} />}
                </div>
            </main>
        </div>
    );
}
