import { router } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { useEffect } from 'react';

/**
 * Reload some of the page's props when the server broadcasts an event on a private channel (Laravel
 * Reverb). Events carry no data the page shows; they only say what changed, and the page reloads those
 * props through Inertia, so prices and permissions stay with the server.
 *
 * Bursts of events (an add-on edited for every branch at once) are gathered into one reload.
 *
 * @param channel the private channel, such as "branch.3"; null subscribes to nothing
 * @param reloads the props to reload for each event, by the event's broadcastAs() name
 */
export function useLiveReload(channel: string | null, reloads: Record<string, string[]>): void {
    const signature = JSON.stringify(reloads);

    useEffect(() => {
        if (!channel || !echoIsConfigured()) {
            return;
        }

        const events: Record<string, string[]> = JSON.parse(signature);
        let subscription: ReturnType<ReturnType<typeof echo>['private']>;

        try {
            subscription = echo().private(channel);
        } catch {
            // Reverb isn't set up here; the page's fallback poll keeps it current.
            return;
        }

        const pending = new Set<string>();
        let timer: ReturnType<typeof setTimeout> | undefined;

        const flush = () => {
            const only = [...pending];
            pending.clear();
            router.reload({ only });
        };

        for (const [event, props] of Object.entries(events)) {
            if (props.length === 0) {
                continue;
            }

            subscription.listen(`.${event}`, () => {
                props.forEach((prop) => pending.add(prop));
                clearTimeout(timer);
                timer = setTimeout(flush, 250);
            });
        }

        return () => {
            clearTimeout(timer);
            Object.keys(events).forEach((event) => subscription.stopListening(`.${event}`));
            echo().leave(channel);
        };
    }, [channel, signature]);
}
