import { type Area, WORKSPACES } from '@/lib/workspaces';
import { Head, Link } from '@inertiajs/react';

/**
 * Stands in for a workspace that later build stages replace.
 */
export default function WorkspacePending({ area }: { area: Area }) {
    const workspace = WORKSPACES.find((candidate) => candidate.area === area);

    return (
        <>
            <Head title={workspace?.title} />

            <div className="font-body flex min-h-screen flex-col items-start justify-center gap-3 bg-neutral-900 px-4 text-neutral-100 sm:px-[52px]">
                <div className="text-gold text-[11px] tracking-[.16em] uppercase">{workspace?.kicker}</div>
                <h1 className="m-0 text-[32px] leading-[1.12]">{workspace?.title}</h1>
                <p className="m-0 max-w-[40ch] text-sm text-neutral-100/66">This workspace is still being built.</p>
                <Link href={route('home')} className="text-gold mt-4 text-sm">
                    ← Back to workspaces
                </Link>
            </div>
        </>
    );
}
