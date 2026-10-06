import { WORKSPACES } from '@/lib/workspaces';
import { type SharedData } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

interface LandingProps {
    canPasswordLogin?: boolean;
    status?: string;
}

const initials = (name: string) =>
    name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2);

export default function Landing({ canPasswordLogin = false, status }: LandingProps) {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user ?? null;

    return (
        <>
            <Head title={user ? 'Workspaces' : 'Sign in'} />

            <div className="font-body relative flex min-h-screen flex-col overflow-hidden bg-neutral-900 px-4 pt-8 pb-8 text-neutral-100 sm:px-[52px] sm:pt-11 sm:pb-[34px]">
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="motion-safe:animate-drift-1 absolute -top-[180px] -right-[140px] size-[620px] rounded-full bg-[radial-gradient(circle,rgba(224,177,42,.16),transparent_68%)]" />
                    <div className="motion-safe:animate-drift-2 absolute -bottom-[260px] -left-[160px] size-[660px] rounded-full bg-[radial-gradient(circle,rgba(198,113,57,.14),transparent_70%)]" />
                    <div className="absolute top-[120px] left-[44%] size-[300px] rounded-full border border-[rgba(224,177,42,.10)]" />
                </div>

                <header className="relative z-10 flex flex-wrap items-center gap-3.5 border-b border-[rgba(224,177,42,.28)] pb-5">
                    <img src="/images/logo.png" alt="D' Mezzanine Cafe" className="size-[51px] flex-none rounded-full object-cover" />
                    <div className="flex flex-none flex-col gap-[3px]">
                        <div className="text-lg leading-none font-semibold tracking-[.05em]">D’ MEZZANINE</div>
                        <div className="text-gold text-[11.5px] leading-none font-bold tracking-[.34em]">CAFE</div>
                    </div>
                    <div className="flex-1" />
                    {user && <UserChip name={user.name} role={auth.role ?? ''} />}
                </header>

                {user ? <WorkspacePicker firstName={user.name.split(' ')[0]} /> : <SignIn canPasswordLogin={canPasswordLogin} status={status} />}
            </div>
        </>
    );
}

function UserChip({ name, role }: { name: string; role: string }) {
    const [confirmingLogout, setConfirmingLogout] = useState(false);

    return (
        <div className="flex items-center gap-3 rounded-full border border-[rgba(224,177,42,.34)] bg-white/5 py-2 pr-2 pl-3">
            <div className="text-gold flex size-9 flex-none items-center justify-center rounded-full border border-[rgba(224,177,42,.4)] bg-[rgba(224,177,42,.18)] text-[13.5px] font-semibold">
                {initials(name)}
            </div>
            <div className="leading-[1.3]">
                <div className="text-[13.5px] font-semibold">{name}</div>
                <div className="text-[11px] tracking-[.1em] text-neutral-100/58 uppercase">{role}</div>
            </div>

            <DialogPrimitive.Root open={confirmingLogout} onOpenChange={setConfirmingLogout}>
                <DialogPrimitive.Trigger className="cursor-pointer rounded-full border border-white/22 px-[15px] py-2 text-[12.5px] font-semibold text-neutral-100/82 hover:border-white/40 hover:bg-white/12 hover:text-neutral-100">
                    Logout
                </DialogPrimitive.Trigger>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-neutral-900/45" />
                    <DialogPrimitive.Content className="bg-surface font-body text-text motion-safe:animate-tin fixed top-1/2 left-1/2 z-[70] w-[calc(100%-32px)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-md p-[26px] shadow-[var(--shadow-lg)]">
                        <DialogPrimitive.Title className="mb-1.5 text-lg">Log out?</DialogPrimitive.Title>
                        <DialogPrimitive.Description className="text-text/74 mb-[22px] text-[13.5px]">
                            You'll need to sign in again to open any workspace.
                        </DialogPrimitive.Description>
                        <div className="flex gap-2.5">
                            <DialogPrimitive.Close className="border-divider bg-bg rounded-btn flex-1 cursor-pointer border p-[11px] text-[13.5px]">
                                Stay signed in
                            </DialogPrimitive.Close>
                            <button
                                type="button"
                                onClick={() => router.post(route('logout'))}
                                className="bg-accent hover:bg-accent-700 rounded-btn flex-1 cursor-pointer p-3 text-sm font-semibold text-neutral-100"
                            >
                                Log out
                            </button>
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}

function WorkspacePicker({ firstName }: { firstName: string }) {
    const { auth } = usePage<SharedData>().props;
    const allowed = WORKSPACES.filter((workspace) => auth.areas.includes(workspace.area));
    const accessLine = [`${allowed.length} ${allowed.length === 1 ? 'workspace' : 'workspaces'} open to you`, auth.role, auth.branch]
        .filter(Boolean)
        .join(' · ');

    return (
        <main className="relative z-10 flex flex-1 flex-col justify-center py-14">
            <div className="text-gold text-[11px] tracking-[.16em] uppercase">Choose a workspace</div>
            <h1 className="mt-3 mb-0 max-w-[20ch] text-[32px] leading-[1.12] sm:text-[40px]">Where are you working today, {firstName}?</h1>
            <p className="mt-2.5 mb-0 text-sm text-neutral-100/60">{accessLine}</p>

            <div className="mt-[34px] flex max-w-[960px] flex-wrap gap-3.5">
                {allowed.map((workspace) => (
                    <Link
                        key={workspace.area}
                        href={route(workspace.area)}
                        className="rounded-btn hover:border-gold flex flex-[0_1_260px] flex-col border border-white/10 bg-neutral-100/6 px-[18px] pt-[18px] pb-4 text-neutral-100 no-underline"
                    >
                        <div className="text-gold text-[11px] tracking-[.14em] uppercase">{workspace.kicker}</div>
                        <div className="mt-3 text-[19px] font-semibold tracking-[-.015em]">{workspace.title}</div>
                        <p className="mt-1.5 mb-0 max-w-[32ch] text-[12.5px] leading-normal text-neutral-100/66">{workspace.body}</p>
                    </Link>
                ))}
            </div>
        </main>
    );
}

function SignIn({ canPasswordLogin, status }: { canPasswordLogin: boolean; status?: string }) {
    const { errors } = usePage<SharedData & { errors: Record<string, string> }>().props;

    return (
        <main className="relative z-10 flex flex-1 items-center justify-center py-12">
            <div className="grid w-full max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-center gap-[clamp(24px,4vw,52px)]">
                <div className="motion-safe:animate-rise">
                    <div className="mb-5 flex items-center gap-2.5">
                        <div className="bg-gold h-0.5 w-[34px]" />
                        <div className="text-gold text-[11.5px] tracking-[.28em]">SINCE 2023 · IRIGA CITY</div>
                    </div>
                    <h1 className="mt-0 mb-3.5 max-w-[18ch] text-[clamp(29px,3.8vw,48px)] leading-[1.12]">One sign-in for every workspace.</h1>
                    <p className="m-0 max-w-[40ch] text-[clamp(14px,1.3vw,17px)] leading-[1.6] text-neutral-100/66">
                        Your account decides which workspaces open. Page access is managed by the owner.
                    </p>
                </div>

                <div className="bg-surface text-text motion-safe:animate-tin w-full max-w-[440px] justify-self-end rounded-md p-[31px] shadow-[var(--shadow-lg)]">
                    <h3 className="mt-0 mb-[22px] text-[21px]">Sign in</h3>

                    {status && <Notice>{status}</Notice>}

                    {canPasswordLogin && (
                        <>
                            <PasswordForm />
                            <div className="my-5 flex items-center gap-3">
                                <div className="bg-divider h-px flex-1" />
                                <div className="text-text/74 text-[12.5px] tracking-[.09em] uppercase">or</div>
                                <div className="bg-divider h-px flex-1" />
                            </div>
                        </>
                    )}

                    {errors.google && <Notice>{errors.google}</Notice>}

                    <a
                        href={route('google.redirect')}
                        className="border-divider bg-surface hover:bg-bg text-text rounded-btn flex w-full items-center justify-center gap-[11px] border p-[14.5px] text-[15.5px] font-semibold no-underline"
                    >
                        <GoogleIcon />
                        Continue with Google
                    </a>
                    {!canPasswordLogin && (
                        <p className="text-text/74 mt-3 mb-0 text-center text-[12.5px]">Use the Google account the owner added you with.</p>
                    )}
                </div>
            </div>
        </main>
    );
}

function PasswordForm() {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm<Required<{ email: string; password: string }>>({
        email: '',
        password: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <form onSubmit={submit}>
            <div className="field mb-3.5">
                <label htmlFor="email">Work email</label>
                <input
                    id="email"
                    type="email"
                    className="input rounded-input"
                    autoComplete="email"
                    autoFocus
                    required
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    placeholder="you@example.com"
                />
            </div>
            <div className="field mb-2">
                <label htmlFor="password">Password</label>
                <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input rounded-input"
                    autoComplete="current-password"
                    required
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    placeholder="••••••••"
                />
            </div>
            <div className="mb-[18px]">
                <button type="button" onClick={() => setShowPassword((shown) => !shown)} className="text-accent-700 cursor-pointer p-0 text-[12.5px]">
                    {showPassword ? 'Hide password' : 'Show password'}
                </button>
            </div>

            {(errors.email || errors.password) && <Notice>{errors.email ?? errors.password}</Notice>}

            <button
                type="submit"
                disabled={processing}
                className="bg-accent hover:bg-accent-700 rounded-btn flex w-full cursor-pointer items-center justify-center gap-2 p-[15.5px] text-base font-semibold text-neutral-100 disabled:opacity-60"
            >
                {processing && <LoaderCircle className="size-4 animate-spin" />}
                Sign in
            </button>
        </form>
    );
}

function Notice({ children }: { children: React.ReactNode }) {
    return (
        <div role="alert" className="bg-accent-200 text-accent-800 mb-4 rounded-md px-[13px] py-[9px] text-[12.5px]">
            {children}
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 18 18" className="flex-none" aria-hidden>
            <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
            />
            <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
            />
            <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z" />
            <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
            />
        </svg>
    );
}
