import { Dashboard } from '@/components/inventory/dashboard';
import { History } from '@/components/inventory/history';
import { LocationTransfers } from '@/components/inventory/location-transfers';
import { Production } from '@/components/inventory/production';
import { ShoppingList } from '@/components/inventory/shopping-list';
import { StockList } from '@/components/inventory/stock-list';
import { Suppliers } from '@/components/inventory/suppliers';
import { NavHeading, NavItem, StockShell } from '@/components/stock/stock-shell';
import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { RequestSheet } from '@/components/transfers/request-sheet';
import { useToast } from '@/hooks/use-toast';
import { openScreen, type InventoryProps, type Screen, type ScreenData } from '@/lib/inventory';
import { isClosed } from '@/lib/transfers';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

type LocationTab = 'stock' | 'recipe' | 'batch' | 'xfer';

const TITLES: Record<Screen, { kicker: string; title: string }> = {
    dash: { kicker: 'Overview', title: 'Operations today' },
    wh: { kicker: 'Warehouse', title: 'Warehouse stock' },
    cm: { kicker: 'Commissary', title: 'Commissary production' },
    shop: { kicker: 'Warehouse', title: 'Shopping list' },
    sup: { kicker: 'Inventory', title: 'Suppliers' },
    hist: { kicker: 'Inventory', title: 'Transfer history' },
};

/**
 * Inventory: the warehouse's stock and shopping list, the commissary's production, transfers between
 * locations, suppliers and the transfer history.
 */
export default function Inventory(props: InventoryProps) {
    const { screen, locations } = props;
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<LocationTab>(screen === 'cm' ? 'recipe' : 'stock');
    const [primaryOpen, setPrimaryOpen] = useState(false);
    const [toast, showToast] = useToast();
    const { send, processing } = useBackOfficeAction(showToast);

    const location = screen === 'wh' ? locations.wh : screen === 'cm' ? locations.cm : null;
    const locationTransfers = (props as ScreenData<'wh'>).transfers ?? [];
    const pending = location ? locationTransfers.filter((transfer) => !isClosed(transfer)).length : 0;
    const searchHint =
        tab === 'xfer' && location
            ? 'Search order, location or item'
            : (
                  {
                      wh: 'Search item, SKU or supplier',
                      sup: 'Search supplier, contact or category',
                      hist: 'Search ref, location or item',
                  } as Partial<Record<Screen, string>>
              )[screen];
    const primaryLabel = screen === 'sup' ? 'Add a supplier' : screen === 'cm' && locations.cm?.can ? 'Request stock' : null;

    const switchTab = (next: LocationTab) => {
        setTab(next);
        setQuery('');
    };

    const screenTabs: { key: LocationTab; label: string; count: number }[] =
        screen === 'cm'
            ? [
                  { key: 'recipe', label: 'Production', count: 0 },
                  { key: 'batch', label: 'Batches', count: props.openBatches },
                  { key: 'xfer', label: 'Transfers', count: pending },
              ]
            : [
                  { key: 'stock', label: 'Stock', count: 0 },
                  { key: 'xfer', label: 'Transfers', count: pending },
              ];

    const nav = (
        <>
            <NavHeading>Overview</NavHeading>
            <NavItem label="Dashboard" icon="▦" active={screen === 'dash'} onClick={() => openScreen('dash')} />
            <NavHeading>Inventory</NavHeading>
            {locations.wh && (
                <NavItem
                    label="Warehouse stock"
                    icon="▧"
                    count={props.lowCount ? String(props.lowCount) : undefined}
                    active={screen === 'wh'}
                    onClick={() => openScreen('wh')}
                />
            )}
            {locations.cm && <NavItem label="Commissary production" icon="▧" active={screen === 'cm'} onClick={() => openScreen('cm')} />}
            <NavItem label="Shopping list" icon="☰" active={screen === 'shop'} onClick={() => openScreen('shop')} />
            <NavItem label="Suppliers" icon="◎" active={screen === 'sup'} onClick={() => openScreen('sup')} />
            <NavItem label="Transfer history" icon="⇄" active={screen === 'hist'} onClick={() => openScreen('hist')} />
        </>
    );

    return (
        <>
            <Head title="Inventory" />
            <StockShell
                appName="DMC Inventory"
                kicker={TITLES[screen].kicker}
                title={TITLES[screen].title}
                nav={nav}
                exitBody="You'll go back to the workspace picker. You stay signed in."
                toast={toast}
                headerEnd={
                    (searchHint || primaryLabel) && (
                        <div className="flex flex-wrap items-center gap-2.5">
                            {searchHint && (
                                <input
                                    className="input min-h-11 w-[230px] max-w-full"
                                    placeholder={searchHint}
                                    aria-label={searchHint}
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                />
                            )}
                            {primaryLabel && (
                                <button
                                    type="button"
                                    onClick={() => setPrimaryOpen(true)}
                                    className="btn btn-primary min-h-11 px-4 font-semibold whitespace-nowrap"
                                >
                                    {primaryLabel}
                                </button>
                            )}
                        </div>
                    )
                }
                headerTabs={
                    location && (
                        <div className="flex items-end gap-6 overflow-x-auto">
                            {screenTabs.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    aria-current={tab === option.key ? 'page' : undefined}
                                    onClick={() => switchTab(option.key)}
                                    className={cn(
                                        'hover:text-accent-800 flex min-h-10 cursor-pointer items-center gap-[7px] border-b-2 bg-transparent px-px pb-[11px] text-[13.5px] whitespace-nowrap transition-colors',
                                        tab === option.key ? 'border-accent text-text font-semibold' : 'text-text/66 border-transparent font-medium',
                                    )}
                                >
                                    {option.label}
                                    {option.count > 0 && (
                                        <span className="bg-accent-200 text-accent-900 rounded-full px-[7px] py-px text-[11px] font-semibold">
                                            {option.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )
                }
            >
                <div key={`${screen}-${tab}`} className="motion-safe:animate-tin">
                    {screen === 'dash' && <Dashboard data={props as ScreenData<'dash'>} toast={showToast} />}
                    {screen === 'wh' && locations.wh && tab === 'stock' && (
                        <StockList data={props as ScreenData<'wh'>} location={locations.wh} query={query} toast={showToast} />
                    )}
                    {screen === 'cm' && locations.cm && (tab === 'recipe' || tab === 'batch') && (
                        <Production data={props as ScreenData<'cm'>} location={locations.cm} view={tab} onView={switchTab} toast={showToast} />
                    )}
                    {location && tab === 'xfer' && (
                        <LocationTransfers data={props as ScreenData<'wh'>} location={location} today={props.today} query={query} toast={showToast} />
                    )}
                    {screen === 'shop' && <ShoppingList data={props as ScreenData<'shop'>} toast={showToast} />}
                    {screen === 'sup' && (
                        <Suppliers
                            data={props as ScreenData<'sup'>}
                            query={query}
                            adding={primaryOpen}
                            onAddingDone={() => setPrimaryOpen(false)}
                            toast={showToast}
                        />
                    )}
                    {screen === 'hist' && <History data={props as ScreenData<'hist'>} locations={locations} query={query} />}
                    {!location && (screen === 'wh' || screen === 'cm') && (
                        <div className="text-text/74 py-10 text-center text-sm">This location isn't set up yet.</div>
                    )}
                </div>
            </StockShell>
            {screen === 'cm' && locations.cm && (
                <RequestSheet
                    open={primaryOpen}
                    sources={(props as ScreenData<'cm'>).sources ?? []}
                    destination={locations.cm.name}
                    busy={processing}
                    onClose={() => setPrimaryOpen(false)}
                    onSubmit={(sourceId, lines) =>
                        send(
                            'post',
                            route('inventory.requisitions.store', locations.cm!.id),
                            { from_branch_id: sourceId, lines },
                            {
                                success: `Requested ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`,
                                onSuccess: () => {
                                    setPrimaryOpen(false);
                                    switchTab('xfer');
                                },
                            },
                        )
                    }
                />
            )}
        </>
    );
}
