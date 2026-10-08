import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { IssueSheet } from '@/components/transfers/issue-sheet';
import { RequestSheet } from '@/components/transfers/request-sheet';
import { DateFilter, TransferCard } from '@/components/transfers/transfer-card';
import { qtyLabel, stockStatus, type TabData } from '@/lib/back-office';
import { inRange, isIncoming, type TransferLineRow, type TransferRow } from '@/lib/transfers';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type View = 'deliveries' | 'in' | 'out';

/** Today in the cafés' time zone, Y-m-d. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/**
 * Stock-in: receive a supplier's delivery into the branch's stock, and the branch's transfers in and out,
 * with requests to the warehouse or the commissary.
 */
export function StockInTab({
    data,
    branchName,
    branchId,
    toast,
}: {
    data: TabData<'stockin'>;
    branchName: string;
    branchId: number;
    toast: (message: string) => void;
}) {
    const [view, setView] = useState<View>('deliveries');
    const [range, setRange] = useState({ from: '', to: '' });
    const [openId, setOpenId] = useState<number | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [flagging, setFlagging] = useState<{ transfer: TransferRow; line: TransferLineRow } | null>(null);
    const { send, processing } = useBackOfficeAction(toast);

    const inbound = data.transfers.filter((transfer) => transfer.to.id === branchId);
    const outbound = data.transfers.filter((transfer) => transfer.from.id === branchId);
    const shown = (view === 'in' ? inbound : outbound).filter((transfer) => inRange(transfer, range.from, range.to));
    const tabs: { view: View; label: string; count: number }[] = [
        { view: 'deliveries', label: 'Deliveries', count: 0 },
        { view: 'in', label: 'Inbound', count: inbound.filter(isIncoming).length },
        { view: 'out', label: 'Outbound', count: outbound.filter((transfer) => transfer.status !== 'received').length },
    ];

    return (
        <div>
            <div className="border-divider mb-[22px] flex items-end gap-6 overflow-x-auto border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.view}
                        type="button"
                        aria-current={view === tab.view ? 'page' : undefined}
                        onClick={() => {
                            setView(tab.view);
                            setOpenId(null);
                        }}
                        className={cn(
                            'hover:text-accent-800 -mb-px flex min-h-11 cursor-pointer items-center gap-[7px] border-b-2 bg-transparent px-px pb-[11px] text-[13.5px] whitespace-nowrap',
                            view === tab.view ? 'border-accent text-text font-semibold' : 'text-text/66 border-transparent font-medium',
                        )}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className="bg-accent-200 text-accent-900 rounded-full px-[7px] py-px text-[11px] font-semibold">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {view === 'deliveries' ? (
                <Deliveries data={data} send={send} processing={processing} />
            ) : (
                <div className="flex flex-col gap-[18px]">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                        <button
                            type="button"
                            onClick={() => setRequesting(true)}
                            className="btn btn-primary min-h-11 px-4 py-2 text-[13px] font-semibold"
                        >
                            Request stock
                        </button>
                        <div className="min-w-3 flex-1" />
                        <DateFilter from={range.from} to={range.to} today={today()} onChange={(from, to) => setRange({ from, to })} />
                    </div>
                    {shown.map((transfer) => (
                        <TransferCard
                            key={transfer.id}
                            tone="till"
                            transfer={transfer}
                            direction={view}
                            open={openId === transfer.id}
                            onToggle={() => setOpenId(openId === transfer.id ? null : transfer.id)}
                            busy={processing}
                            actions={
                                view === 'in'
                                    ? {
                                          receiveAll: () =>
                                              send(
                                                  'post',
                                                  route('pos.transfers.receive', transfer.id),
                                                  {},
                                                  { success: `${transfer.no} received in full` },
                                              ),
                                          receiveLine: (line) =>
                                              send(
                                                  'post',
                                                  route('pos.transfers.lines.receive', [transfer.id, line.id]),
                                                  {},
                                                  {
                                                      success: `Received ${qtyLabel(line.qty, line.unit)} · ${line.name}`,
                                                  },
                                              ),
                                          cancel:
                                              transfer.status === 'requested' || transfer.status === 'approved'
                                                  ? () =>
                                                        send(
                                                            'post',
                                                            route('pos.transfers.cancel', transfer.id),
                                                            {},
                                                            { success: `${transfer.no} cancelled` },
                                                        )
                                                  : undefined,
                                          flag: (line) => setFlagging({ transfer, line }),
                                      }
                                    : {}
                            }
                        />
                    ))}
                    {shown.length === 0 && (
                        <div className="border-divider text-text/74 rounded-md border bg-neutral-100 p-8 text-center text-[13.5px]">
                            No transfers in this direction for the selected dates.
                        </div>
                    )}
                </div>
            )}

            <RequestSheet
                open={requesting}
                sources={data.sources}
                destination={branchName}
                busy={processing}
                onClose={() => setRequesting(false)}
                onSubmit={(sourceId, lines) =>
                    send(
                        'post',
                        route('pos.requisitions.store'),
                        { from_branch_id: sourceId, lines },
                        {
                            success: `Requested ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} from ${data.sources.find((source) => source.id === sourceId)?.name}`,
                            onSuccess: () => {
                                setRequesting(false);
                                setView('in');
                            },
                        },
                    )
                }
            />
            <IssueSheet
                target={flagging}
                busy={processing}
                onClose={() => setFlagging(null)}
                onSave={(reason, note) =>
                    flagging &&
                    send(
                        'put',
                        route('pos.transfers.lines.flag', [flagging.transfer.id, flagging.line.id]),
                        { reason, note },
                        {
                            success: `Issue flagged on ${flagging.transfer.no}`,
                            onSuccess: () => setFlagging(null),
                        },
                    )
                }
            />
        </div>
    );
}

/**
 * Receive a supplier's delivery, beside the branch's stock on hand. Typing a name no item has makes a new
 * item, which needs its SKU, category and unit.
 */
function Deliveries({
    data,
    send,
    processing,
}: {
    data: TabData<'stockin'>;
    send: ReturnType<typeof useBackOfficeAction>['send'];
    processing: boolean;
}) {
    const [supplier, setSupplier] = useState('');
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [category, setCategory] = useState('');
    const [unit, setUnit] = useState(data.units[0]);
    const [qty, setQty] = useState('');
    const [cost, setCost] = useState('');

    const item = data.stock.find((row) => row.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
    const amount = parseFloat(qty) || 0;

    const pick = (value: string) => {
        setName(value);
        const hit = data.stock.find((row) => row.name.toLowerCase() === value.trim().toLowerCase());
        setCost(hit ? String(hit.cost) : '');
    };

    const post = () =>
        send(
            'post',
            route('pos.deliveries.store'),
            {
                supplier: supplier.trim(),
                qty: amount,
                unit_cost: parseFloat(cost) || 0,
                ...(item ? { stock_item_id: item.id } : { name: name.trim(), sku: sku.trim(), category: category.trim(), unit }),
            },
            {
                success: item
                    ? `${item.name} +${qtyLabel(amount, item.unit)} posted to stock`
                    : `${name.trim()} created · ${qtyLabel(amount, unit)} in stock`,
                onSuccess: () => {
                    setQty('');
                    setSku('');
                    setCategory('');
                },
            },
        );

    const sorted = [...data.stock].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex flex-wrap items-start gap-6">
            <div className="border-divider min-w-0 flex-[0_1_340px] rounded-md border bg-neutral-100 p-5">
                <h4 className="mb-3.5 text-base">Receive delivery</h4>
                <div className="field mb-3">
                    <label htmlFor="recv-supplier">Supplier</label>
                    <input
                        id="recv-supplier"
                        className="input w-full"
                        value={supplier}
                        onChange={(event) => setSupplier(event.target.value)}
                        placeholder="Supplier name"
                    />
                </div>
                <div className="field mb-2.5">
                    <label htmlFor="recv-item">Item</label>
                    <input
                        id="recv-item"
                        className="input w-full"
                        list="recv-items"
                        value={name}
                        onChange={(event) => pick(event.target.value)}
                        placeholder="Type or pick an item"
                    />
                    <datalist id="recv-items">
                        {sorted.map((row) => (
                            <option key={row.id} value={row.name} />
                        ))}
                    </datalist>
                </div>
                <div className="mb-2 flex gap-2.5">
                    <div className="field flex-1">
                        <label htmlFor="recv-sku">SKU</label>
                        <input
                            id="recv-sku"
                            className="input w-full"
                            value={item ? item.sku : sku}
                            disabled={item !== null}
                            onChange={(event) => setSku(event.target.value.toUpperCase())}
                            placeholder="WH-DRY-030"
                        />
                    </div>
                    <div className="field flex-1">
                        <label htmlFor="recv-category">Category</label>
                        <input
                            id="recv-category"
                            className="input w-full"
                            list="recv-categories"
                            value={item ? item.category : category}
                            disabled={item !== null}
                            onChange={(event) => setCategory(event.target.value)}
                            placeholder="Dairy"
                        />
                        <datalist id="recv-categories">
                            {data.categories.map((option) => (
                                <option key={option} value={option} />
                            ))}
                        </datalist>
                    </div>
                </div>
                <div className="field mb-2">
                    <label htmlFor="recv-unit">Unit</label>
                    <select
                        id="recv-unit"
                        className="input min-h-11 w-full"
                        value={item ? item.unit : unit}
                        disabled={item !== null}
                        onChange={(event) => setUnit(event.target.value)}
                    >
                        {(item && !data.units.includes(item.unit) ? [item.unit, ...data.units] : data.units).map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="text-text/74 mb-3.5 text-[12.5px]">
                    {item
                        ? `On hand ${qtyLabel(item.on_hand, item.unit)}`
                        : name.trim()
                          ? 'New item — give it a SKU and category to add it to stock.'
                          : 'Pick the item that arrived.'}
                </div>
                <div className="mb-3.5 flex gap-2.5">
                    <div className="field flex-1">
                        <label htmlFor="recv-qty">Quantity {item ? item.unit : unit}</label>
                        <input
                            id="recv-qty"
                            className="input w-full"
                            inputMode="decimal"
                            value={qty}
                            onChange={(event) => setQty(event.target.value.replace(/[^0-9.]/g, ''))}
                        />
                    </div>
                    <div className="field flex-1">
                        <label htmlFor="recv-cost">Unit cost</label>
                        <input
                            id="recv-cost"
                            className="input w-full"
                            inputMode="decimal"
                            value={cost}
                            onChange={(event) => setCost(event.target.value.replace(/[^0-9.]/g, ''))}
                        />
                    </div>
                </div>
                <div className="mb-4 flex gap-2">
                    {[6, 12, 24].map((quick) => (
                        <button
                            key={quick}
                            type="button"
                            onClick={() => setQty(String(quick))}
                            className="btn btn-secondary min-h-11 flex-1 font-semibold"
                        >
                            +{quick}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    disabled={processing || !name.trim() || amount <= 0 || !supplier.trim()}
                    onClick={post}
                    className="btn btn-primary btn-block w-full p-[13px] font-semibold disabled:opacity-50"
                >
                    Post to stock
                </button>
            </div>

            <div className="min-w-0 flex-[1_1_420px]">
                <h4 className="mb-3 text-base">Stock on hand</h4>
                <div className="max-h-[420px] overflow-auto overscroll-contain">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th className="text-left">SKU</th>
                                <th className="text-left">Item</th>
                                <th className="text-left">Category</th>
                                <th className="text-right">On hand</th>
                                <th className="text-right">Par</th>
                                <th className="text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((row) => {
                                const status = stockStatus(row);

                                return (
                                    <tr key={row.id}>
                                        <td className="text-text/74 text-[12.5px] tracking-[.04em] whitespace-nowrap">{row.sku}</td>
                                        <td className="text-[14.5px] font-semibold">{row.name}</td>
                                        <td className="text-text/74">{row.category}</td>
                                        <td className="text-right whitespace-nowrap tabular-nums">{qtyLabel(row.on_hand, row.unit)}</td>
                                        <td className="text-text/74 text-right whitespace-nowrap tabular-nums">{qtyLabel(row.par, row.unit)}</td>
                                        <td>
                                            <span
                                                className={cn(
                                                    'tag rounded-btn font-semibold whitespace-nowrap',
                                                    status.tone === 'accent'
                                                        ? 'tag-accent'
                                                        : status.tone === 'outline'
                                                          ? 'tag-outline'
                                                          : 'tag-accent-2',
                                                )}
                                            >
                                                {status.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
