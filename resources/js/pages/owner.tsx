import { ActivityLog } from '@/components/owner/activity-log';
import { Locations } from '@/components/owner/locations';
import { PageAccess } from '@/components/owner/page-access';
import { Users } from '@/components/owner/users';
import { NavHeading, NavItem, StockShell } from '@/components/stock/stock-shell';
import { Sheet } from '@/components/till/sheet';
import { useToast } from '@/hooks/use-toast';
import { openScreen, type Issued, type OwnerProps, type Screen } from '@/lib/owner';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

const TITLES: Record<Screen, { kicker: string; title: string }> = {
    users: { kicker: 'User control', title: 'Users & access' },
    pages: { kicker: 'User control', title: 'Page access' },
    locations: { kicker: 'System', title: 'Locations' },
    log: { kicker: 'System', title: 'Activity log' },
};

/**
 * The Owner console: users and their access, per-user page access, locations and the activity log.
 */
export default function Owner(props: OwnerProps) {
    const { screen } = props;
    const [query, setQuery] = useState('');
    const [inviting, setInviting] = useState(false);
    const [dismissed, setDismissed] = useState<Issued | null>(null);
    const [toast, showToast] = useToast();
    const pending = props.users.filter((user) => user.pending).length;
    const searchable = screen === 'users' || screen === 'pages';

    const go = (next: Screen) => {
        setQuery('');
        openScreen(next);
    };

    const nav = (
        <>
            <NavHeading>User control</NavHeading>
            <NavItem
                label="Users & access"
                icon="♟"
                count={pending ? String(pending) : undefined}
                active={screen === 'users'}
                onClick={() => go('users')}
            />
            <NavItem label="Page access" icon="▥" active={screen === 'pages'} onClick={() => go('pages')} />
            <NavHeading>System</NavHeading>
            <NavItem label="Locations" icon="▥" active={screen === 'locations'} onClick={() => go('locations')} />
            <NavItem label="Activity log" icon="◷" active={screen === 'log'} onClick={() => go('log')} />
        </>
    );

    return (
        <>
            <Head title="Owner console" />
            <StockShell
                appName="DMC Owner console"
                kicker={TITLES[screen].kicker}
                title={TITLES[screen].title}
                nav={nav}
                exitBody="You'll go back to the workspace picker. You stay signed in."
                toast={toast}
                headerEnd={
                    searchable && (
                        <div className="flex flex-wrap items-center gap-2.5">
                            <input
                                className="input min-h-11 w-[230px] max-w-full"
                                placeholder="Search name or email"
                                aria-label="Search name or email"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                            {screen === 'users' && (
                                <button
                                    type="button"
                                    onClick={() => setInviting(true)}
                                    className="btn btn-primary min-h-11 px-4 font-semibold whitespace-nowrap"
                                >
                                    Invite a user
                                </button>
                            )}
                        </div>
                    )
                }
            >
                <div key={screen} className="motion-safe:animate-tin">
                    {screen === 'users' && (
                        <Users data={props} query={query} inviting={inviting} onInvitingDone={() => setInviting(false)} toast={showToast} />
                    )}
                    {screen === 'pages' && <PageAccess data={props} query={query} toast={showToast} />}
                    {screen === 'locations' && <Locations data={props} toast={showToast} />}
                    {screen === 'log' && props.log && <ActivityLog log={props.log} />}
                </div>
            </StockShell>
            <IssuedSheet issued={props.issued !== dismissed ? props.issued : null} onClose={() => setDismissed(props.issued)} toast={showToast} />
        </>
    );
}

/**
 * A new password and/or till PIN, shown once for the Owner to pass on.
 */
function IssuedSheet({ issued, onClose, toast }: { issued: Issued | null; onClose: () => void; toast: (message: string) => void }) {
    const copy = (value: string, what: string) => {
        navigator.clipboard?.writeText(value).then(
            () => toast(`${what} copied`),
            () => toast(`Couldn't copy the ${what.toLowerCase()}. Note it down instead.`),
        );
    };

    const secrets: [string, string | null, string][] = [
        ['First-time password', issued?.password ?? null, 'Password'],
        ['Till PIN', issued?.pin ?? null, 'PIN'],
    ];

    return (
        <Sheet
            open={issued !== null}
            onClose={onClose}
            title={issued?.title ?? ''}
            description={`For ${issued?.email ?? ''}. Shown here once, so note it down if you need to read it out.`}
            width="max-w-[430px]"
        >
            <div className="grid gap-2.5">
                {secrets.map(
                    ([label, value, what]) =>
                        value && (
                            <div key={label} className="border-divider bg-surface rounded-btn flex items-center gap-3 border px-[15px] py-[13px]">
                                <div className="min-w-0 flex-1">
                                    <div className="text-text/74 text-[11px] tracking-[.09em] uppercase">{label}</div>
                                    <div
                                        className={
                                            what === 'PIN'
                                                ? 'mt-[3px] text-base font-semibold tracking-[.22em] tabular-nums'
                                                : 'mt-[3px] text-base font-semibold tracking-[.04em]'
                                        }
                                    >
                                        {value}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => copy(value, what)}
                                    className="border-divider bg-bg rounded-btn hover:border-accent flex-none cursor-pointer border px-3 py-[7px] text-[12.5px]"
                                >
                                    Copy
                                </button>
                            </div>
                        ),
                )}
            </div>
            <p className="text-text/74 mt-3.5 mb-[22px] text-[12.5px]">{issued?.who}</p>
            <button type="button" onClick={onClose} className="btn btn-primary w-full p-3 text-sm font-semibold">
                Done
            </button>
        </Sheet>
    );
}
