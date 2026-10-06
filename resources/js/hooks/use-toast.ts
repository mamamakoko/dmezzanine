import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A short-lived message for the till and stock pages' toast: shows for 2.6 seconds, and a new message
 * replaces the current one.
 */
export function useToast(): [string, (message: string) => void] {
    const [message, setMessage] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const show = useCallback((next: string) => {
        clearTimeout(timer.current);
        setMessage(next);
        timer.current = setTimeout(() => setMessage(''), 2600);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return [message, show];
}
