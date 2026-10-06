import { MarketingBar } from '@/components/marketing/marketing-bar';
import { ConfirmDialog, Toast } from '@/components/till/sheet';
import { useToast } from '@/hooks/use-toast';
import {
    distance,
    niceDate,
    officerColor,
    SWATCHES,
    type ClientAreaView,
    type ClientTypeView,
    type ClientView,
    type MapBranch,
} from '@/lib/marketing';
import { firstError } from '@/lib/till';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

interface ClientMapProps {
    isOwner: boolean;
    types: ClientTypeView[];
    officers: { id: number; name: string }[];
    areas: ClientAreaView[];
    branches: MapBranch[];
    clients: ClientView[];
}

interface ClientDraft {
    id: number | null;
    name: string;
    client_type_id: number;
    contact: string;
    address: string;
    lat: number | null;
    lng: number | null;
    branch_id: number | null;
    officer_id: number | null;
    last_order_on: string;
    notes: string;
}

interface AreaDraft {
    id: number | null;
    name: string;
    officer_id: number | null;
    lat: number | null;
    lng: number | null;
    radius_m: number;
}

type Panel =
    | { kind: 'client'; id: number }
    | { kind: 'form'; draft: ClientDraft }
    | { kind: 'branch'; id: number }
    | { kind: 'types' }
    | { kind: 'areas' }
    | { kind: 'area'; draft: AreaDraft }
    | null;

type Placing = { kind: 'client' } | { kind: 'move'; client: ClientView } | { kind: 'branch'; branch: MapBranch } | { kind: 'area' } | null;

const NEUTRAL = 'oklch(0.45 0.03 60)';

const pinIcon = (color: string, selected = false) =>
    L.divIcon({
        className: '',
        html: `<div style="width:${selected ? 28 : 22}px;height:${selected ? 28 : 22}px;border-radius:999px;background:${color};border:3px solid var(--color-bg);box-shadow:0 1px 4px rgba(32,30,29,.35);${selected ? 'outline:3px solid var(--color-accent);outline-offset:1px' : ''}"></div>`,
        iconSize: selected ? [28, 28] : [22, 22],
        iconAnchor: selected ? [14, 14] : [11, 11],
    });

const branchIcon = L.divIcon({
    className: '',
    html: '<div style="width:30px;height:30px;border-radius:999px;background:var(--color-neutral-900);border:3px solid var(--color-bg);box-shadow:0 1px 4px rgba(32,30,29,.35);display:flex;align-items:center;justify-content:center;color:#e0b12a;font-weight:700;font-size:11px;font-family:var(--font-body)">DM</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

/**
 * Marketing's client map: past clients pinned by type, the areas each officer handles, and the branches.
 * Anyone in Marketing records clients. The Owner edits the legend, draws areas and moves branch pins.
 */
export default function ClientMap({ isOwner, types, officers, areas, branches, clients }: ClientMapProps) {
    const [panel, setPanel] = useState<Panel>(null);
    const [placing, setPlacing] = useState<Placing>(null);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<number | 'all'>('all');
    const [officerFilter, setOfficerFilter] = useState<number | 'all' | 'none'>('all');
    const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | null>(null);
    const [deleting, setDeleting] = useState<ClientView | ClientAreaView | null>(null);
    const [toast, showToast] = useToast();

    const typeOf = (id: number) => types.find((type) => type.id === id);
    const colorOf = (id: number) => typeOf(id)?.color ?? NEUTRAL;
    const officerIds = officers.map((officer) => officer.id);
    const terms = query.trim().toLowerCase();
    const visible = clients.filter(
        (client) =>
            (typeFilter === 'all' || client.client_type_id === typeFilter) &&
            (officerFilter === 'all' || (officerFilter === 'none' ? client.officer === null : client.officer?.id === officerFilter)) &&
            (!terms || `${client.name} ${client.address ?? ''} ${client.contact ?? ''} ${client.notes ?? ''}`.toLowerCase().includes(terms)),
    );
    const missingBranches = branches.filter((branch) => branch.lat === null || branch.lng === null);
    const selectedId = panel?.kind === 'client' ? panel.id : panel?.kind === 'form' ? panel.draft.id : null;

    const send = (method: 'post' | 'put' | 'delete', url: string, data: Record<string, unknown>, success: string, after?: () => void) => {
        const options = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                showToast(success);
                after?.();
            },
            onError: (errors: Record<string, string>) => showToast(firstError(errors)),
        };

        if (method === 'delete') {
            router.delete(url, options);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router[method](url, data as any, options);
        }
    };

    const clientPayload = (draft: ClientDraft) => ({
        name: draft.name.trim(),
        client_type_id: draft.client_type_id,
        contact: draft.contact.trim() || null,
        address: draft.address.trim() || null,
        lat: draft.lat,
        lng: draft.lng,
        branch_id: draft.branch_id,
        officer_id: draft.officer_id,
        last_order_on: draft.last_order_on || null,
        notes: draft.notes.trim() || null,
    });

    const toDraft = (client: ClientView): ClientDraft => ({
        id: client.id,
        name: client.name,
        client_type_id: client.client_type_id,
        contact: client.contact ?? '',
        address: client.address ?? '',
        lat: client.lat,
        lng: client.lng,
        branch_id: client.branch_id,
        officer_id: client.officer_id,
        last_order_on: client.last_order_on ?? '',
        notes: client.notes ?? '',
    });

    const fly = (lat: number, lng: number, zoom?: number) => setFlyTo({ lat, lng, zoom, seq: Date.now() });

    const onMapClick = (lat: number, lng: number) => {
        if (placing?.kind === 'client' && panel?.kind === 'form') {
            setPanel({ kind: 'form', draft: { ...panel.draft, lat, lng } });
            setPlacing(null);
        } else if (placing?.kind === 'move') {
            const client = placing.client;
            setPlacing(null);
            send('put', route('marketing.clients.update', client.id), clientPayload({ ...toDraft(client), lat, lng }), `${client.name} moved`, () =>
                setPanel({ kind: 'client', id: client.id }),
            );
        } else if (placing?.kind === 'branch') {
            const branch = placing.branch;
            setPlacing(null);
            send('put', route('marketing.branches.location', branch.id), { lat, lng }, `${branch.name} pin moved`, () =>
                setPanel({ kind: 'branch', id: branch.id }),
            );
        } else if (placing?.kind === 'area' && panel?.kind === 'area') {
            setPanel({ kind: 'area', draft: { ...panel.draft, lat, lng } });
            setPlacing(null);
        }
    };

    const bannerText =
        placing?.kind === 'branch'
            ? `Click the new location for ${placing.branch.name}.`
            : placing?.kind === 'area'
              ? 'Click the center of the area.'
              : 'Click the map where the client is, or search an address.';

    const areaDraft = panel?.kind === 'area' ? panel.draft : null;

    return (
        <>
            <Head title="Client map" />
            <div className="bg-bg font-body text-text flex h-screen flex-col">
                <MarketingBar active="clients" />
                <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,40vh)_minmax(0,1fr)] md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-1">
                    <aside className="border-divider flex min-h-0 flex-col border-b md:border-r md:border-b-0">
                        <div className="flex flex-col gap-3 px-5 pt-5 pb-3.5">
                            <div className="flex items-center gap-2.5">
                                <div className="min-w-0 flex-1">
                                    <h2 className="m-0 text-xl">Client map</h2>
                                    <div className="text-text/74 text-[12.5px]">
                                        {clients.length
                                            ? visible.length === clients.length
                                                ? `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`
                                                : `${visible.length} of ${clients.length} clients`
                                            : 'No clients recorded yet'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPanel({
                                            kind: 'form',
                                            draft: {
                                                id: null,
                                                name: '',
                                                client_type_id: types[0]?.id,
                                                contact: '',
                                                address: '',
                                                lat: null,
                                                lng: null,
                                                branch_id: branches[0]?.id ?? null,
                                                officer_id: null,
                                                last_order_on: '',
                                                notes: '',
                                            },
                                        });
                                        setPlacing({ kind: 'client' });
                                    }}
                                    className="btn btn-primary min-h-[42px] px-4 text-sm font-semibold"
                                >
                                    Add client
                                </button>
                            </div>
                            <input
                                className="input h-[42px] w-full"
                                placeholder="Search clients"
                                aria-label="Search clients"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            <div className="flex flex-wrap gap-1.5">
                                {[{ id: 'all' as const, name: 'All' }, ...types].map((type) => (
                                    <Chip key={type.id} on={typeFilter === type.id} onClick={() => setTypeFilter(type.id)}>
                                        {type.name}
                                    </Chip>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    aria-label="Filter by officer"
                                    className="input h-[38px] min-w-0 flex-1 text-[13px]"
                                    value={officerFilter}
                                    onChange={(event) =>
                                        setOfficerFilter(
                                            event.target.value === 'all' || event.target.value === 'none'
                                                ? event.target.value
                                                : Number(event.target.value),
                                        )
                                    }
                                >
                                    <option value="all">All officers</option>
                                    {officers.map((officer) => (
                                        <option key={officer.id} value={officer.id}>
                                            {officer.name} · {clients.filter((client) => client.officer?.id === officer.id).length}
                                        </option>
                                    ))}
                                    <option value="none">No officer · {clients.filter((client) => client.officer === null).length}</option>
                                </select>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPlacing(null);
                                        setPanel({ kind: 'areas' });
                                    }}
                                    className="border-divider rounded-btn min-h-[38px] cursor-pointer border bg-neutral-100 px-3 text-[13px] font-semibold hover:bg-neutral-200"
                                >
                                    Areas
                                </button>
                            </div>
                        </div>

                        {missingBranches.length > 0 && (
                            <div className="border-divider bg-accent-100 rounded-btn mx-5 mb-3 flex flex-col gap-2 border px-3.5 py-3">
                                <div className="text-[13.5px] font-semibold">
                                    {missingBranches.length === 1
                                        ? '1 branch isn’t on the map yet'
                                        : `${missingBranches.length} branches aren’t on the map yet`}
                                </div>
                                {missingBranches.map((branch) => (
                                    <div key={branch.id} className="flex items-center gap-2.5">
                                        <span className="min-w-0 flex-1 text-[13.5px]">{branch.name}</span>
                                        {isOwner && (
                                            <button
                                                type="button"
                                                onClick={() => setPlacing({ kind: 'branch', branch })}
                                                className="border-divider rounded-btn min-h-[34px] cursor-pointer border bg-neutral-100 px-3 text-[13px] font-semibold"
                                            >
                                                Place pin
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {!isOwner && <div className="text-text/74 text-[12.5px]">Ask the Owner to place it.</div>}
                            </div>
                        )}

                        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto overscroll-contain px-3 pb-4">
                            {visible.length === 0 && (
                                <div className="text-text/74 px-3 py-[34px] text-center text-[12.5px]">
                                    {clients.length
                                        ? 'No clients match.'
                                        : 'Add a client and drop a pin where you served them. Each pin keeps their contact, event type and notes.'}
                                </div>
                            )}
                            {visible.map((client) => (
                                <button
                                    key={client.id}
                                    type="button"
                                    aria-current={client.id === selectedId}
                                    onClick={() => {
                                        setPlacing(null);
                                        setPanel({ kind: 'client', id: client.id });
                                        fly(client.lat, client.lng, 15);
                                    }}
                                    className={cn(
                                        'rounded-btn hover:bg-surface grid cursor-pointer grid-cols-[10px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-1 border px-3 py-[11px] text-left',
                                        client.id === selectedId ? 'border-divider bg-surface' : 'border-transparent bg-transparent',
                                    )}
                                >
                                    <span className="size-2.5 self-center rounded-full" style={{ background: colorOf(client.client_type_id) }} />
                                    <span className="truncate text-[14.5px] font-semibold">{client.name}</span>
                                    <span className="text-text/72 col-start-2 text-xs">
                                        {[typeOf(client.client_type_id)?.name, client.address].filter(Boolean).join(' · ')}
                                    </span>
                                    {client.officer ? (
                                        <span className="text-text/72 col-start-2 text-xs">Handled by {client.officer.name}</span>
                                    ) : (
                                        <span className="text-accent-700 col-start-2 text-xs">No officer</span>
                                    )}
                                    {client.last_order_on && (
                                        <span className="text-text/72 col-start-2 text-xs">Last order {niceDate(client.last_order_on)}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="relative min-h-[320px] min-w-0">
                        <MapContainer
                            center={[13.52, 123.3]}
                            zoom={11}
                            className="bg-surface absolute inset-0 z-0"
                            style={{ cursor: placing ? 'crosshair' : undefined }}
                        >
                            <TileLayer
                                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="© OpenStreetMap contributors"
                                maxZoom={19}
                                referrerPolicy="strict-origin-when-cross-origin"
                            />
                            <MapEvents onClick={onMapClick} flyTo={flyTo} fitTo={clients} branches={branches} />

                            {areas
                                .filter((area) => area.id !== areaDraft?.id)
                                .map((area) => {
                                    const color = officerColor(area.officer_id, officerIds);

                                    return (
                                        <Circle
                                            key={`area-${area.id}`}
                                            center={[area.lat, area.lng]}
                                            radius={area.radius_m}
                                            pathOptions={{
                                                color,
                                                weight: 2,
                                                dashArray: area.officer_id ? undefined : '6 6',
                                                fillColor: color,
                                                fillOpacity: officerFilter === 'all' || officerFilter === area.officer_id ? 0.1 : 0.03,
                                            }}
                                            eventHandlers={{
                                                click: (event) => {
                                                    if (placing) {
                                                        return;
                                                    }

                                                    L.DomEvent.stop(event);
                                                    setPanel(isOwner ? { kind: 'area', draft: { ...area } } : { kind: 'areas' });
                                                },
                                            }}
                                        >
                                            <Tooltip sticky>
                                                {area.name} · {area.officer ?? 'No officer'}
                                            </Tooltip>
                                        </Circle>
                                    );
                                })}

                            {areaDraft && areaDraft.lat !== null && areaDraft.lng !== null && (
                                <Circle
                                    center={[areaDraft.lat, areaDraft.lng]}
                                    radius={areaDraft.radius_m}
                                    pathOptions={{
                                        color: officerColor(areaDraft.officer_id, officerIds),
                                        weight: 3,
                                        fillColor: officerColor(areaDraft.officer_id, officerIds),
                                        fillOpacity: 0.15,
                                    }}
                                    interactive={false}
                                />
                            )}

                            {branches
                                .filter((branch) => branch.lat !== null && branch.lng !== null)
                                .map((branch) => (
                                    <Marker
                                        key={`branch-${branch.id}`}
                                        position={[branch.lat!, branch.lng!]}
                                        icon={branchIcon}
                                        zIndexOffset={1000}
                                        eventHandlers={{ click: () => !placing && setPanel({ kind: 'branch', id: branch.id }) }}
                                    >
                                        <Tooltip direction="top" offset={[0, -14]}>
                                            {branch.name}
                                        </Tooltip>
                                    </Marker>
                                ))}

                            {visible
                                .filter((client) => !(panel?.kind === 'form' && panel.draft.id === client.id))
                                .map((client) => (
                                    <Marker
                                        key={`client-${client.id}`}
                                        position={[client.lat, client.lng]}
                                        icon={pinIcon(colorOf(client.client_type_id), client.id === selectedId)}
                                        zIndexOffset={client.id === selectedId ? 900 : 0}
                                        eventHandlers={{ click: () => !placing && setPanel({ kind: 'client', id: client.id }) }}
                                    >
                                        <Tooltip direction="top" offset={[0, -10]}>
                                            {client.name}
                                        </Tooltip>
                                    </Marker>
                                ))}

                            {panel?.kind === 'form' && panel.draft.lat !== null && panel.draft.lng !== null && (
                                <Marker
                                    position={[panel.draft.lat, panel.draft.lng]}
                                    icon={pinIcon(colorOf(panel.draft.client_type_id), true)}
                                    draggable
                                    zIndexOffset={1200}
                                    eventHandlers={{
                                        dragend: (event) => {
                                            const point = event.target.getLatLng();
                                            setPanel({ kind: 'form', draft: { ...panel.draft, lat: point.lat, lng: point.lng } });
                                        },
                                    }}
                                />
                            )}
                        </MapContainer>

                        {placing && (
                            <div className="rounded-btn absolute top-3.5 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-3.5 bg-neutral-900 py-2.5 pr-3 pl-4 text-[13.5px] text-neutral-100 shadow-[var(--shadow-md)]">
                                <span>{bannerText}</span>
                                <button
                                    type="button"
                                    onClick={() => setPlacing(null)}
                                    className="rounded-btn hover:bg-accent-2-700 min-h-[34px] cursor-pointer border border-white/25 bg-transparent px-3 text-[13px] font-semibold text-neutral-100"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        <div className="border-divider bg-bg absolute bottom-[30px] left-3.5 z-[500] flex min-w-40 flex-col gap-[9px] rounded-md border px-4 py-3.5 text-sm font-semibold shadow-[var(--shadow-md)]">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">Legend</div>
                                {isOwner && (
                                    <button
                                        type="button"
                                        title="Edit legend"
                                        aria-label="Edit legend"
                                        onClick={() => {
                                            setPlacing(null);
                                            setPanel({ kind: 'types' });
                                        }}
                                        className="text-text/60 hover:bg-surface hover:text-accent-700 rounded-btn -m-1 flex cursor-pointer bg-transparent p-1"
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.75"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden
                                        >
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2.5">
                                <span className="flex size-[22px] items-center justify-center rounded-full border-2 border-[var(--color-bg)] bg-neutral-900 text-[8px] font-bold text-[#e0b12a]">
                                    DM
                                </span>
                                Branch
                            </div>
                            {types.map((type) => (
                                <div key={type.id} className="flex items-center gap-2.5">
                                    <span
                                        className="size-[18px] flex-none rounded-full border-[3px] border-[var(--color-bg)] shadow-[0_0_0_1px_var(--color-divider),0_1px_3px_rgba(32,30,29,.3)]"
                                        style={{ background: type.color }}
                                    />
                                    {type.name}
                                </div>
                            ))}
                        </div>

                        {panel && !placing && (
                            <div className="bg-bg absolute top-3.5 right-3.5 bottom-3.5 z-[600] flex w-[340px] max-w-[calc(100%-28px)] flex-col overflow-hidden rounded-md shadow-[var(--shadow-lg)]">
                                {panel.kind === 'client' && (
                                    <ClientDetail
                                        client={clients.find((client) => client.id === panel.id)}
                                        type={typeOf(clients.find((client) => client.id === panel.id)?.client_type_id ?? 0)}
                                        branchName={(id) => branches.find((branch) => branch.id === id)?.name}
                                        onClose={() => setPanel(null)}
                                        onEdit={(client) => setPanel({ kind: 'form', draft: toDraft(client) })}
                                        onMove={(client) => setPlacing({ kind: 'move', client })}
                                        onDelete={(client) => setDeleting(client)}
                                    />
                                )}
                                {panel.kind === 'form' && (
                                    <ClientForm
                                        draft={panel.draft}
                                        types={types}
                                        branches={branches}
                                        officers={officers}
                                        onChange={(draft) => setPanel({ kind: 'form', draft })}
                                        onPick={(lat, lng) => {
                                            setPanel({ kind: 'form', draft: { ...panel.draft, lat, lng } });
                                            setPlacing(null);
                                            fly(lat, lng, 16);
                                        }}
                                        onPlace={() => setPlacing({ kind: 'client' })}
                                        onCancel={() => setPanel(panel.draft.id ? { kind: 'client', id: panel.draft.id } : null)}
                                        onSave={() => {
                                            if (!panel.draft.name.trim()) {
                                                showToast('Give the client a name');
                                            } else if (panel.draft.lat === null) {
                                                showToast('Place a pin on the map first');
                                            } else if (panel.draft.id) {
                                                send(
                                                    'put',
                                                    route('marketing.clients.update', panel.draft.id),
                                                    clientPayload(panel.draft),
                                                    `${panel.draft.name} saved`,
                                                    () => setPanel({ kind: 'client', id: panel.draft.id! }),
                                                );
                                            } else {
                                                send(
                                                    'post',
                                                    route('marketing.clients.store'),
                                                    clientPayload(panel.draft),
                                                    `${panel.draft.name} added to the map`,
                                                    () => setPanel(null),
                                                );
                                            }
                                        }}
                                    />
                                )}
                                {panel.kind === 'branch' && (
                                    <BranchDetail
                                        branch={branches.find((branch) => branch.id === panel.id)}
                                        clients={clients.filter((client) => client.branch_id === panel.id)}
                                        colorOf={colorOf}
                                        isOwner={isOwner}
                                        onClose={() => setPanel(null)}
                                        onOpenClient={(client) => {
                                            setPanel({ kind: 'client', id: client.id });
                                            fly(client.lat, client.lng, 15);
                                        }}
                                        onMove={(branch) => setPlacing({ kind: 'branch', branch })}
                                    />
                                )}
                                {panel.kind === 'types' && (
                                    <TypesEditor
                                        types={types}
                                        onCancel={() => setPanel(null)}
                                        onSave={(payload) =>
                                            send('put', route('marketing.client-types.save'), payload, 'Legend saved', () => setPanel(null))
                                        }
                                    />
                                )}
                                {panel.kind === 'areas' && (
                                    <AreasList
                                        areas={areas}
                                        officers={officers}
                                        clients={clients}
                                        isOwner={isOwner}
                                        onClose={() => setPanel(null)}
                                        onOpen={(area) => {
                                            fly(area.lat, area.lng, 13);

                                            if (isOwner) {
                                                setPanel({ kind: 'area', draft: { ...area } });
                                            }
                                        }}
                                        onDraw={() => {
                                            setPanel({
                                                kind: 'area',
                                                draft: {
                                                    id: null,
                                                    name: '',
                                                    officer_id: officers[0]?.id ?? null,
                                                    lat: null,
                                                    lng: null,
                                                    radius_m: 2000,
                                                },
                                            });
                                            setPlacing({ kind: 'area' });
                                        }}
                                    />
                                )}
                                {panel.kind === 'area' && (
                                    <AreaForm
                                        draft={panel.draft}
                                        officers={officers}
                                        inside={
                                            panel.draft.lat === null
                                                ? 0
                                                : clients.filter(
                                                      (client) =>
                                                          distance(client.lat, client.lng, panel.draft.lat!, panel.draft.lng!) <=
                                                          panel.draft.radius_m,
                                                  ).length
                                        }
                                        onChange={(draft) => setPanel({ kind: 'area', draft })}
                                        onMove={() => setPlacing({ kind: 'area' })}
                                        onCancel={() => setPanel({ kind: 'areas' })}
                                        onDelete={() => setDeleting(areas.find((area) => area.id === panel.draft.id) ?? null)}
                                        onSave={() => {
                                            const draft = panel.draft;

                                            if (!draft.name.trim()) {
                                                showToast('Give the area a name');
                                            } else if (draft.lat === null) {
                                                showToast('Click the center of the area on the map');
                                            } else {
                                                const payload = {
                                                    name: draft.name.trim(),
                                                    officer_id: draft.officer_id,
                                                    lat: draft.lat,
                                                    lng: draft.lng,
                                                    radius_m: draft.radius_m,
                                                };

                                                if (draft.id) {
                                                    send('put', route('marketing.areas.update', draft.id), payload, `${payload.name} saved`, () =>
                                                        setPanel({ kind: 'areas' }),
                                                    );
                                                } else {
                                                    send('post', route('marketing.areas.store'), payload, `${payload.name} drawn`, () =>
                                                        setPanel({ kind: 'areas' }),
                                                    );
                                                }
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={deleting !== null}
                title={deleting && 'radius_m' in deleting ? `Delete the ${deleting.name} area?` : `Delete ${deleting?.name} from the map?`}
                body={
                    deleting && 'radius_m' in deleting
                        ? 'Its clients keep any officer assigned to them directly.'
                        : 'The pin and its notes are removed.'
                }
                cancelLabel="Keep it"
                confirmLabel="Delete"
                onCancel={() => setDeleting(null)}
                onConfirm={() => {
                    if (deleting && 'radius_m' in deleting) {
                        send('delete', route('marketing.areas.destroy', deleting.id), {}, `${deleting.name} area deleted`, () =>
                            setPanel({ kind: 'areas' }),
                        );
                    } else if (deleting) {
                        send('delete', route('marketing.clients.destroy', deleting.id), {}, `${deleting.name} deleted`, () => setPanel(null));
                    }

                    setDeleting(null);
                }}
            />
            <Toast message={toast} />
        </>
    );
}

/** Map clicks, flying to a client or area, and fitting the first view to the pins. */
function MapEvents({
    onClick,
    flyTo,
    fitTo,
    branches,
}: {
    onClick: (lat: number, lng: number) => void;
    flyTo: { lat: number; lng: number; zoom?: number; seq: number } | null;
    fitTo: ClientView[];
    branches: MapBranch[];
}) {
    const map = useMap();
    const fitted = useRef(false);

    useMapEvents({ click: (event: { latlng: { lat: number; lng: number } }) => onClick(event.latlng.lat, event.latlng.lng) });

    useEffect(() => {
        if (flyTo) {
            map.flyTo([flyTo.lat, flyTo.lng], Math.max(map.getZoom(), flyTo.zoom ?? 13), { duration: 0.5 });
        }
    }, [flyTo, map]);

    useEffect(() => {
        const points: L.LatLngTuple[] = [
            ...fitTo.map((client): L.LatLngTuple => [client.lat, client.lng]),
            ...branches.flatMap((branch): L.LatLngTuple[] => (branch.lat !== null && branch.lng !== null ? [[branch.lat, branch.lng]] : [])),
        ];

        if (!fitted.current && fitTo.length) {
            fitted.current = true;
            map.fitBounds(L.latLngBounds(points).pad(0.15));
        }
    }, [fitTo, branches, map]);

    return null;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onClick}
            className={cn(
                'rounded-btn cursor-pointer border px-[11px] py-1.5 text-[12.5px] font-semibold',
                on ? 'border-neutral-900 bg-neutral-900 text-neutral-100' : 'border-divider text-text bg-neutral-100',
            )}
        >
            {children}
        </button>
    );
}

function PanelBody({ children }: { children: ReactNode }) {
    return <div className="flex flex-1 flex-col gap-3 overflow-auto p-5">{children}</div>;
}

function PanelFoot({ children }: { children: ReactNode }) {
    return <div className="border-divider flex gap-2 border-t px-5 py-3.5">{children}</div>;
}

function PanelButton({ primary = false, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-btn min-h-[42px] cursor-pointer border px-4 text-sm font-semibold',
                primary ? 'border-accent bg-accent text-bg hover:bg-accent-600' : 'border-divider text-text bg-neutral-100 hover:bg-neutral-200',
            )}
        >
            {children}
        </button>
    );
}

function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            aria-label="Close"
            onClick={onClick}
            className="border-divider rounded-btn min-h-[34px] cursor-pointer border bg-neutral-100 px-[11px] hover:bg-neutral-200"
        >
            ✕
        </button>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="flex flex-col gap-[5px] text-xs font-semibold tracking-[.02em]">
            {label}
            {children}
        </label>
    );
}

function ClientDetail({
    client,
    type,
    branchName,
    onClose,
    onEdit,
    onMove,
    onDelete,
}: {
    client?: ClientView;
    type?: ClientTypeView;
    branchName: (id: number) => string | undefined;
    onClose: () => void;
    onEdit: (client: ClientView) => void;
    onMove: (client: ClientView) => void;
    onDelete: (client: ClientView) => void;
}) {
    if (!client) {
        return null;
    }

    return (
        <>
            <PanelBody>
                <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                        <div className="text-text/74 flex items-center gap-[7px] text-[12.5px]">
                            <span className="size-2.5 rounded-full" style={{ background: type?.color ?? NEUTRAL }} />
                            {type?.name}
                        </div>
                        <h3 className="mt-1 mb-0 text-[19px]">{client.name}</h3>
                    </div>
                    <CloseButton onClick={onClose} />
                </div>
                <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
                    {client.contact && <Row term="Contact">{client.contact}</Row>}
                    {client.address && <Row term="Location">{client.address}</Row>}
                    {client.branch_id && <Row term="Served by">{branchName(client.branch_id)}</Row>}
                    <Row term="Officer">
                        {client.officer ? (
                            <>
                                {client.officer.name}
                                <div className="text-text/74 text-[12.5px]">
                                    {client.officer.via === null ? 'Assigned to this client' : `From area: ${client.officer.via}`}
                                </div>
                            </>
                        ) : (
                            <span className="text-accent-700">None yet</span>
                        )}
                    </Row>
                    {client.last_order_on && <Row term="Last order">{niceDate(client.last_order_on)}</Row>}
                    {client.added_by && <Row term="Recorded by">{client.added_by}</Row>}
                </dl>
                {client.notes && (
                    <div className="bg-surface rounded-btn px-3 py-2.5 text-[13.5px] leading-normal whitespace-pre-wrap">{client.notes}</div>
                )}
            </PanelBody>
            <PanelFoot>
                <PanelButton onClick={() => onDelete(client)}>Delete</PanelButton>
                <div className="flex-1" />
                <PanelButton onClick={() => onMove(client)}>Move pin</PanelButton>
                <PanelButton primary onClick={() => onEdit(client)}>
                    Edit
                </PanelButton>
            </PanelFoot>
        </>
    );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
    return (
        <>
            <dt className="text-text/72">{term}</dt>
            <dd className="m-0">{children}</dd>
        </>
    );
}

interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
}

function ClientForm({
    draft,
    types,
    branches,
    officers,
    onChange,
    onPick,
    onPlace,
    onCancel,
    onSave,
}: {
    draft: ClientDraft;
    types: ClientTypeView[];
    branches: MapBranch[];
    officers: { id: number; name: string }[];
    onChange: (draft: ClientDraft) => void;
    onPick: (lat: number, lng: number) => void;
    onPlace: () => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    const [results, setResults] = useState<SearchResult[] | 'none' | 'error' | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const set = (patch: Partial<ClientDraft>) => onChange({ ...draft, ...patch });

    useEffect(() => () => clearTimeout(timer.current), []);

    const search = (value: string) => {
        set({ address: value });
        clearTimeout(timer.current);

        if (value.trim().length < 3) {
            setResults(null);

            return;
        }

        timer.current = setTimeout(() => {
            fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ph&viewbox=122.9,13.9,123.7,13.2&q=${encodeURIComponent(value.trim())}`,
            )
                .then((response) => response.json())
                .then((rows: SearchResult[]) => setResults(rows.length ? rows : 'none'))
                .catch(() => setResults('error'));
        }, 450);
    };

    return (
        <>
            <PanelBody>
                <h3 className="m-0 text-[19px]">{draft.id ? 'Edit client' : 'New client'}</h3>
                <Field label="Client name">
                    <input
                        className="input h-[42px]"
                        maxLength={120}
                        placeholder="Company, family or event host"
                        value={draft.name}
                        onChange={(event) => set({ name: event.target.value })}
                    />
                </Field>
                <Field label="Type">
                    <div className="flex flex-wrap gap-1.5">
                        {types.map((type) => (
                            <Chip key={type.id} on={draft.client_type_id === type.id} onClick={() => set({ client_type_id: type.id })}>
                                {type.name}
                            </Chip>
                        ))}
                    </div>
                </Field>
                <Field label="Contact">
                    <input
                        className="input h-[42px]"
                        maxLength={120}
                        placeholder="Name and mobile number"
                        value={draft.contact}
                        onChange={(event) => set({ contact: event.target.value })}
                    />
                </Field>
                <Field label="Location">
                    <div className="relative">
                        <input
                            className="input h-[42px] w-full"
                            maxLength={200}
                            autoComplete="off"
                            placeholder="Search or type an address"
                            value={draft.address}
                            onChange={(event) => search(event.target.value)}
                        />
                        {results && (
                            <div className="border-divider bg-bg rounded-btn absolute top-[46px] right-0 left-0 z-10 flex max-h-[220px] flex-col overflow-auto border shadow-[var(--shadow-md)]">
                                {results === 'none' || results === 'error' ? (
                                    <div className="text-text/74 px-3 py-[9px] text-[12.5px] font-normal">
                                        {results === 'none'
                                            ? 'No match. Click the map instead.'
                                            : 'Address search is unavailable. Click the map instead.'}
                                    </div>
                                ) : (
                                    results.map((row, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => {
                                                set({ address: row.display_name.split(',').slice(0, 3).join(',').trim() });
                                                setResults(null);
                                                onPick(Number(row.lat), Number(row.lon));
                                            }}
                                            className="hover:bg-surface cursor-pointer bg-transparent px-3 py-[9px] text-left text-[13px] font-normal"
                                        >
                                            {row.display_name}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </Field>
                <div className="text-text/74 -mt-1.5 flex items-center gap-2 text-[12.5px]">
                    <span className="flex-1">
                        {draft.lat !== null ? 'Pin placed. Drag it on the map to adjust.' : 'No pin yet. Click the map or pick a search result.'}
                    </span>
                    {draft.lat === null && (
                        <button type="button" onClick={onPlace} className="text-accent-700 cursor-pointer bg-transparent text-[12.5px] font-semibold">
                            Place pin
                        </button>
                    )}
                </div>
                <Field label="Served by">
                    <select
                        className="input h-[42px]"
                        value={draft.branch_id ?? ''}
                        onChange={(event) => set({ branch_id: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">—</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Officer">
                    <select
                        className="input h-[42px]"
                        value={draft.officer_id ?? ''}
                        onChange={(event) => set({ officer_id: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">Auto (from area)</option>
                        {officers.map((officer) => (
                            <option key={officer.id} value={officer.id}>
                                {officer.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Last order">
                    <input
                        type="date"
                        className="input h-[42px]"
                        value={draft.last_order_on}
                        onChange={(event) => set({ last_order_on: event.target.value })}
                    />
                </Field>
                <Field label="Notes">
                    <textarea
                        className="input h-[72px] resize-y py-2.5"
                        maxLength={2000}
                        placeholder="What they ordered, headcount, follow-ups"
                        value={draft.notes}
                        onChange={(event) => set({ notes: event.target.value })}
                    />
                </Field>
            </PanelBody>
            <PanelFoot>
                <PanelButton onClick={onCancel}>Cancel</PanelButton>
                <div className="flex-1" />
                <PanelButton primary onClick={onSave}>
                    Save client
                </PanelButton>
            </PanelFoot>
        </>
    );
}

function BranchDetail({
    branch,
    clients,
    colorOf,
    isOwner,
    onClose,
    onOpenClient,
    onMove,
}: {
    branch?: MapBranch;
    clients: ClientView[];
    colorOf: (typeId: number) => string;
    isOwner: boolean;
    onClose: () => void;
    onOpenClient: (client: ClientView) => void;
    onMove: (branch: MapBranch) => void;
}) {
    if (!branch) {
        return null;
    }

    const served = [...clients].sort((a, b) => (b.last_order_on ?? '').localeCompare(a.last_order_on ?? ''));
    const last = served.find((client) => client.last_order_on);

    return (
        <>
            <PanelBody>
                <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                        <div className="text-text/74 text-[12.5px]">Branch · {branch.status}</div>
                        <h3 className="mt-1 mb-0 text-[19px]">{branch.name}</h3>
                    </div>
                    <CloseButton onClick={onClose} />
                </div>
                <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13.5px]">
                    {branch.address && <Row term="Address">{branch.address}</Row>}
                    {branch.manager && <Row term="Manager">{branch.manager}</Row>}
                    <Row term="Staff">{branch.staff}</Row>
                    <Row term="Clients">
                        {served.length} {served.length === 1 ? 'client served' : 'clients served'}
                    </Row>
                    {last && (
                        <Row term="Last order">
                            {last.name} · {niceDate(last.last_order_on)}
                        </Row>
                    )}
                </dl>
                {served.length > 0 && (
                    <div>
                        <div className="text-text/74 mb-1.5 text-[11.5px] font-semibold tracking-[.06em] uppercase">Clients served</div>
                        <div className="flex flex-col gap-0.5">
                            {served.map((client) => (
                                <button
                                    key={client.id}
                                    type="button"
                                    onClick={() => onOpenClient(client)}
                                    className="rounded-btn hover:bg-surface flex cursor-pointer items-center gap-2.5 bg-transparent px-2.5 py-2 text-left"
                                >
                                    <span className="size-2.5 rounded-full" style={{ background: colorOf(client.client_type_id) }} />
                                    <span className="truncate text-[13.5px] font-semibold">{client.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </PanelBody>
            {isOwner && (
                <PanelFoot>
                    <div className="flex-1" />
                    <PanelButton onClick={() => onMove(branch)}>Change location</PanelButton>
                </PanelFoot>
            )}
        </>
    );
}

interface TypeDraft {
    id: number | null;
    name: string;
    color: string;
    count: number;
}

function TypesEditor({
    types,
    onCancel,
    onSave,
}: {
    types: ClientTypeView[];
    onCancel: () => void;
    onSave: (payload: Record<string, unknown>) => void;
}) {
    const [drafts, setDrafts] = useState<TypeDraft[]>(() =>
        types.map((type) => ({ id: type.id, name: type.name, color: type.color, count: type.count })),
    );
    const [moves, setMoves] = useState<Record<number, string>>({});
    const removed = useMemo(() => types.filter((type) => !drafts.some((draft) => draft.id === type.id)), [types, drafts]);
    const set = (index: number, patch: Partial<TypeDraft>) =>
        setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

    return (
        <>
            <PanelBody>
                <h3 className="m-0 text-[19px]">Client types</h3>
                <div className="text-text/74 -mt-1.5 text-[12.5px]">These are the colors on the map and the type choices when saving a client.</div>
                {drafts.map((draft, index) => (
                    <div key={draft.id ?? `new-${index}`} className="bg-surface rounded-btn flex flex-col gap-2 p-3">
                        <div className="flex items-center gap-2">
                            <span
                                className="size-[18px] flex-none rounded-full shadow-[0_0_0_1px_var(--color-divider)]"
                                style={{ background: draft.color }}
                            />
                            <input
                                className="input h-[38px] min-w-0 flex-1"
                                aria-label="Type name"
                                maxLength={40}
                                value={draft.name}
                                onChange={(event) => set(index, { name: event.target.value })}
                            />
                            <button
                                type="button"
                                title="Remove"
                                aria-label={`Remove ${draft.name}`}
                                disabled={drafts.length <= 1}
                                onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                                className="border-divider rounded-btn min-h-[38px] w-[38px] flex-none cursor-pointer border bg-neutral-100 disabled:opacity-40"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {SWATCHES.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    aria-label="Color"
                                    aria-pressed={draft.color === color}
                                    onClick={() => set(index, { color })}
                                    className="size-[26px] cursor-pointer rounded-full shadow-[0_0_0_1px_var(--color-divider)]"
                                    style={{
                                        background: color,
                                        border: `2px solid ${draft.color === color ? 'var(--color-text)' : 'var(--color-bg)'}`,
                                    }}
                                />
                            ))}
                            <label title="Pick any color" className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                                <input
                                    type="color"
                                    value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#8a7a66'}
                                    onChange={(event) => set(index, { color: event.target.value })}
                                    className="rounded-btn h-[26px] w-[30px] cursor-pointer bg-neutral-100 p-0"
                                    style={{ border: `2px solid ${SWATCHES.includes(draft.color) ? 'var(--color-divider)' : 'var(--color-text)'}` }}
                                />
                                Custom
                            </label>
                        </div>
                        <div className="text-text/74 text-[12.5px]">
                            {draft.id ? `${draft.count} ${draft.count === 1 ? 'client' : 'clients'}` : 'New type'}
                        </div>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() =>
                        setDrafts((current) => [
                            ...current,
                            {
                                id: null,
                                name: '',
                                color: SWATCHES.find((color) => !current.some((draft) => draft.color === color)) ?? SWATCHES[0],
                                count: 0,
                            },
                        ])
                    }
                    className="border-divider rounded-btn min-h-[42px] cursor-pointer self-start border bg-neutral-100 px-4 text-sm font-semibold hover:bg-neutral-200"
                >
                    Add type
                </button>
                {removed
                    .filter((type) => type.count > 0)
                    .map((type) => (
                        <Field key={type.id} label={`${type.count} ${type.count === 1 ? 'client uses' : 'clients use'} ${type.name}. Move them to`}>
                            <select
                                className="input h-[42px]"
                                value={moves[type.id] ?? ''}
                                onChange={(event) => setMoves((current) => ({ ...current, [type.id]: event.target.value }))}
                            >
                                <option value="">Pick a type</option>
                                {drafts
                                    .filter((draft) => draft.name.trim())
                                    .map((draft, index) => (
                                        <option key={index} value={draft.name.trim()}>
                                            {draft.name.trim()}
                                        </option>
                                    ))}
                            </select>
                        </Field>
                    ))}
            </PanelBody>
            <PanelFoot>
                <PanelButton onClick={onCancel}>Cancel</PanelButton>
                <div className="flex-1" />
                <PanelButton
                    primary
                    onClick={() => onSave({ types: drafts.map(({ id, name, color }) => ({ id, name: name.trim(), color })), moves })}
                >
                    Save legend
                </PanelButton>
            </PanelFoot>
        </>
    );
}

function AreasList({
    areas,
    officers,
    clients,
    isOwner,
    onClose,
    onOpen,
    onDraw,
}: {
    areas: ClientAreaView[];
    officers: { id: number; name: string }[];
    clients: ClientView[];
    isOwner: boolean;
    onClose: () => void;
    onOpen: (area: ClientAreaView) => void;
    onDraw: () => void;
}) {
    const officerIds = officers.map((officer) => officer.id);
    const inside = (area: ClientAreaView) => clients.filter((client) => distance(client.lat, client.lng, area.lat, area.lng) <= area.radius_m).length;
    const areaRow = (area: ClientAreaView) => (
        <button
            key={area.id}
            type="button"
            onClick={() => onOpen(area)}
            className="rounded-btn hover:bg-surface flex cursor-pointer flex-col bg-transparent px-2.5 py-2 text-left"
        >
            <span className="text-[13.5px] font-semibold">{area.name}</span>
            <span className="text-text/72 text-xs">
                {(area.radius_m / 1000).toFixed(1)} km radius · {inside(area)} {inside(area) === 1 ? 'client' : 'clients'}
            </span>
        </button>
    );

    return (
        <>
            <PanelBody>
                <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                        <h3 className="m-0 text-[19px]">Areas</h3>
                        <div className="text-text/74 text-[12.5px]">
                            Each area is handled by one marketing officer. Clients inside it go to that officer unless a client has its own officer.
                        </div>
                    </div>
                    <CloseButton onClick={onClose} />
                </div>
                {officers.length === 0 && (
                    <div className="text-text/74 text-[12.5px]">No marketing officers yet. Officers are users with the Marketing role.</div>
                )}
                {officers.map((officer) => {
                    const theirs = areas.filter((area) => area.officer_id === officer.id);
                    const total = clients.filter((client) => client.officer?.id === officer.id).length;

                    return (
                        <div key={officer.id}>
                            <div className="mb-1 flex items-center gap-2">
                                <span className="size-2.5 rounded-full" style={{ background: officerColor(officer.id, officerIds) }} />
                                <span className="flex-1 text-sm font-semibold">{officer.name}</span>
                                <span className="text-text/74 text-[12.5px]">
                                    {total} {total === 1 ? 'client' : 'clients'}
                                </span>
                            </div>
                            {theirs.length ? theirs.map(areaRow) : <div className="text-text/74 pl-[18px] text-[12.5px]">No areas yet.</div>}
                        </div>
                    );
                })}
                {areas.some((area) => area.officer_id === null) && (
                    <div>
                        <div className="mb-1 text-sm font-semibold">No officer</div>
                        {areas.filter((area) => area.officer_id === null).map(areaRow)}
                    </div>
                )}
            </PanelBody>
            {isOwner && (
                <PanelFoot>
                    <div className="flex-1" />
                    <PanelButton primary onClick={onDraw}>
                        Draw area
                    </PanelButton>
                </PanelFoot>
            )}
        </>
    );
}

function AreaForm({
    draft,
    officers,
    inside,
    onChange,
    onMove,
    onCancel,
    onDelete,
    onSave,
}: {
    draft: AreaDraft;
    officers: { id: number; name: string }[];
    inside: number;
    onChange: (draft: AreaDraft) => void;
    onMove: () => void;
    onCancel: () => void;
    onDelete: () => void;
    onSave: () => void;
}) {
    return (
        <>
            <PanelBody>
                <h3 className="m-0 text-[19px]">{draft.id ? 'Edit area' : 'New area'}</h3>
                <Field label="Area name">
                    <input
                        className="input h-[42px]"
                        maxLength={80}
                        placeholder="Iriga Poblacion"
                        value={draft.name}
                        onChange={(event) => onChange({ ...draft, name: event.target.value })}
                    />
                </Field>
                <Field label="Marketing officer">
                    <select
                        className="input h-[42px]"
                        value={draft.officer_id ?? ''}
                        onChange={(event) => onChange({ ...draft, officer_id: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">No officer yet</option>
                        {officers.map((officer) => (
                            <option key={officer.id} value={officer.id}>
                                {officer.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={`Radius · ${(draft.radius_m / 1000).toFixed(1)} km`}>
                    <input
                        type="range"
                        min={300}
                        max={15000}
                        step={100}
                        value={draft.radius_m}
                        onChange={(event) => onChange({ ...draft, radius_m: Number(event.target.value) })}
                        className="accent-accent"
                    />
                </Field>
                <div className="text-text/74 text-[12.5px]">
                    {draft.lat === null ? 'Click the center of the area on the map.' : `${inside} ${inside === 1 ? 'client' : 'clients'} inside`}
                </div>
                <button
                    type="button"
                    onClick={onMove}
                    className="border-divider rounded-btn min-h-[42px] cursor-pointer self-start border bg-neutral-100 px-4 text-sm font-semibold hover:bg-neutral-200"
                >
                    {draft.lat === null ? 'Place center' : 'Move center'}
                </button>
            </PanelBody>
            <PanelFoot>
                {draft.id && <PanelButton onClick={onDelete}>Delete</PanelButton>}
                <div className="flex-1" />
                <PanelButton onClick={onCancel}>Cancel</PanelButton>
                <PanelButton primary onClick={onSave}>
                    Save area
                </PanelButton>
            </PanelFoot>
        </>
    );
}
