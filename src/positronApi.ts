import { tryAcquirePositronApi } from '@posit-dev/positron';

// Lazily held Positron API instance. This module exposes a setter used
// during extension activation and a getter for all other modules. The
// getter throws when the API hasn't been set, turning a runtime undefined
// into an explicit, easy-to-diagnose error.

type PositronApi = ReturnType<typeof tryAcquirePositronApi> | undefined;

export type Positron = NonNullable<PositronApi>;

// Minimal ExecutionObserver shape. The real runtime ExecutionObserver may be
// richer, but the extension only needs these callbacks. Using a local type
// avoids coupling to the exact shape exported by the Positron types and
// prevents brittle compile errors when the runtime object is a value rather
// than a namespace of types.
export type ExecutionObserver = {
    onFailed?: (error: Error) => void;
    onError?: (error: string) => void;
    onCompleted?: () => void;
};

let _positron: PositronApi;

export function setPositron(api: Positron) {
    _positron = api;
}

export function getPositron(): Positron {
    if (!_positron) {
        throw new Error('Positron API is not available. Ensure the extension has been activated and setPositron() was called.');
    }
    return _positron as Positron;
}

// Convenience: attempt a runtime acquisition if someone imports this file
// before activation (keeps backwards compatibility for quick scripts), but
// don't rely on it — the extension should call setPositron during activate().
try {
    const maybe = tryAcquirePositronApi();
    if (maybe) {
        _positron = maybe;
    }
} catch (e) {
    // ignore — we'll throw in getPositron() if never set
}
