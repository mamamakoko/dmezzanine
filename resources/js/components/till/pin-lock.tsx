import { cn } from '@/lib/utils';
import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'enter'] as const;

interface PinLockProps {
    branchName: string;
    greeting: string;
    clock: string;
}

/**
 * The locked till: a staff member enters their 4-digit PIN to open it.
 */
export function PinLock({ branchName, greeting, clock }: PinLockProps) {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [pin, setPin] = useState('');
    const [processing, setProcessing] = useState(false);

    const press = (key: (typeof KEYS)[number]) => {
        if (key === 'clear') {
            setPin((current) => current.slice(0, -1));
        } else if (key === 'enter') {
            router.post(
                route('pos.unlock'),
                { pin },
                {
                    onStart: () => setProcessing(true),
                    onFinish: () => {
                        setProcessing(false);
                        setPin('');
                    },
                },
            );
        } else {
            setPin((current) => (current.length < 4 ? current + key : current));
        }
    };

    return (
        <div className="bg-bg font-body grid min-h-screen grid-cols-1 md:h-screen md:grid-cols-[1.05fr_1fr]">
            <div className="relative flex flex-col justify-between gap-10 overflow-hidden bg-neutral-900 px-6 pt-11 pb-9 text-neutral-100 md:px-12">
                <div
                    aria-hidden
                    className="motion-safe:animate-drift-1 pointer-events-none absolute -top-[120px] -right-[160px] size-[560px] rounded-full bg-[radial-gradient(circle,rgba(224,177,42,.20),transparent_68%)]"
                />
                <div
                    aria-hidden
                    className="motion-safe:animate-drift-2 pointer-events-none absolute right-[60px] -bottom-[220px] size-[420px] rounded-full bg-[radial-gradient(circle,rgba(198,113,57,.16),transparent_70%)]"
                />

                <div className="relative flex flex-col">
                    <div className="flex items-center gap-3.5">
                        <img src="/images/logo.png" alt="D' Mezzanine Cafe" className="size-[52px] flex-none rounded-full object-cover" />
                        <div className="flex flex-col gap-[5px]">
                            <div className="text-lg leading-none font-semibold tracking-[.05em]">D’ MEZZANINE</div>
                            <div className="text-gold text-[11.5px] leading-none font-bold tracking-[.34em]">CAFE</div>
                        </div>
                    </div>
                    <Link
                        href={route('home')}
                        className="hover:border-accent hover:bg-accent hover:text-bg mt-7 inline-flex items-center gap-2 self-start rounded-full border border-neutral-100/34 px-4 py-[9px] text-[13.5px] font-semibold text-neutral-100 no-underline"
                    >
                        ← All workspaces
                    </Link>
                    <div className="mt-[26px] mb-3 flex items-center gap-2.5">
                        <div className="bg-gold h-0.5 w-[34px]" />
                        <div className="text-gold text-[11.5px] font-bold tracking-[.28em]">TILL</div>
                    </div>
                    <h1 className="m-0 mb-3 max-w-[14ch] text-[clamp(32px,4vw,52px)] leading-[1.08]">{greeting}</h1>
                    <p className="m-0 max-w-[34ch] text-[15px] leading-[1.6] text-neutral-100/70">Sign in with your PIN to open the till.</p>
                </div>

                <div className="relative text-[13px] text-neutral-100/70">
                    <div className="text-[26px] font-semibold text-neutral-100 tabular-nums">{clock}</div>
                    Local time
                </div>
            </div>

            <div className="flex items-center justify-center overflow-y-auto p-6">
                <div className="bg-surface w-full max-w-[400px] rounded-md p-5 shadow-[var(--shadow-lg)]">
                    <div className="border-divider bg-bg mb-3.5 rounded-md border px-[13px] py-2.5">
                        <div className="text-text/74 text-[12.5px] tracking-[.08em] uppercase">This till is at</div>
                        <div className="mt-1 text-[15.5px] font-semibold">{branchName}</div>
                    </div>
                    <h3 className="m-0 mb-2.5 text-[17px]">Enter your PIN</h3>

                    <div className="mb-2.5 flex items-center justify-between">
                        <div className="text-text/74 text-xs tracking-[.08em] uppercase">4‑digit PIN</div>
                        <div className="flex gap-[9px]" aria-label={`${pin.length} of 4 digits entered`}>
                            {[0, 1, 2, 3].map((dot) => (
                                <div key={dot} className={cn('size-[13px] rounded-full', dot < pin.length ? 'bg-accent' : 'bg-neutral-300')} />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {KEYS.map((key) => (
                            <button
                                key={key}
                                type="button"
                                disabled={processing}
                                aria-label={key === 'clear' ? 'Delete digit' : key === 'enter' ? 'Unlock' : undefined}
                                onClick={() => press(key)}
                                className={cn(
                                    'border-divider rounded-btn h-[52px] cursor-pointer border text-xl font-semibold disabled:opacity-60',
                                    key === 'enter' ? 'bg-accent text-bg hover:bg-accent-700' : 'text-text bg-neutral-100 hover:bg-neutral-200',
                                )}
                            >
                                {key === 'clear' ? '←' : key === 'enter' ? '↵' : key}
                            </button>
                        ))}
                    </div>

                    {errors.pin && (
                        <div role="alert" className="bg-accent-200 text-accent-800 mt-3 rounded-md px-[13px] py-[9px] text-[12.5px]">
                            {errors.pin}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
