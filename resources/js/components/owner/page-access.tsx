import { Avatar, filterUsers } from '@/components/owner/users';
import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { type OwnerProps, type UserRow } from '@/lib/owner';
import { cn } from '@/lib/utils';
import { type Area, WORKSPACES } from '@/lib/workspaces';

const GRID = 'grid grid-cols-[minmax(170px,1.4fr)_repeat(8,minmax(70px,1fr))] gap-2';

/**
 * Page access per user: ticks start from the role, and a change is kept as an exception for that person.
 */
export function PageAccess({ data, query, toast }: { data: OwnerProps; query: string; toast: (message: string) => void }) {
    const { send, processing } = useBackOfficeAction(toast);
    const shown = filterUsers(data.users, query);

    const toggle = (user: UserRow, area: Area, title: string) => {
        const allowed = !user.areas.includes(area);

        send(
            'put',
            route('owner.users.pages', [user.id, area]),
            { allowed },
            { success: `${allowed ? 'Granted' : 'Removed'} ${title} for ${user.name}` },
        );
    };

    return (
        <div className="border-divider bg-surface motion-safe:animate-tin overflow-x-auto rounded-md border">
            <div className={`${GRID} text-text/74 min-w-[900px] bg-neutral-100 px-[18px] py-3 text-[11px] font-bold tracking-[.06em] uppercase`}>
                <div>User</div>
                {WORKSPACES.map((workspace) => (
                    <div key={workspace.area} className="text-center text-pretty">
                        {workspace.title}
                    </div>
                ))}
            </div>
            {shown.length === 0 && <div className="text-text/74 p-[34px] text-center text-[13.5px]">No user matches “{query}”.</div>}
            {shown.map((user) => (
                <div
                    key={user.id}
                    className={cn(`${GRID} border-divider min-w-[900px] items-center border-t px-[18px] py-[11px]`, !user.active && 'opacity-60')}
                >
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar user={user} size="size-[30px] text-xs" />
                        <div className="min-w-0">
                            <div className="truncate text-[13.5px]">{user.name}</div>
                            <div className="text-text/74 text-[11.5px]">{user.role}</div>
                        </div>
                    </div>
                    {WORKSPACES.map((workspace) => {
                        const fixed = user.is_owner;
                        const label = `${user.name} · ${workspace.title}${fixed ? ' (the Owner always has access)' : ''}`;

                        return (
                            <label
                                key={workspace.area}
                                title={label}
                                className={cn('flex items-center justify-center', fixed ? 'cursor-default' : 'cursor-pointer')}
                            >
                                <input
                                    type="checkbox"
                                    aria-label={label}
                                    checked={user.areas.includes(workspace.area)}
                                    disabled={fixed || processing}
                                    onChange={() => toggle(user, workspace.area, workspace.title)}
                                    className={cn('accent-accent size-[19px]', fixed ? 'cursor-default' : 'cursor-pointer')}
                                />
                            </label>
                        );
                    })}
                </div>
            ))}
            <div className="border-divider text-text/74 border-t px-[18px] py-[13px] text-xs">
                Ticks are set from each person’s role, and any change you make here is kept as an exception for that person. The owner keeps every
                page, including this one.
            </div>
        </div>
    );
}
