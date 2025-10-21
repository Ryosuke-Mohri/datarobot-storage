import '@testing-library/jest-dom';
import { server } from './__mocks__/node.js';

beforeAll(() => {
    server.listen();
});

afterEach(() => {
    server.resetHandlers();
});

afterAll(() => {
    server.close();
});

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }),
});

class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}

global.ResizeObserver = ResizeObserver;

// Mock EventSource for SSE testing with instance tracking
export const eventSourceInstances: EventSourceMock[] = [];

export class EventSourceMock {
    url: string;
    onopen: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    readyState = 0;
    CONNECTING = 0;
    OPEN = 1;
    CLOSED = 2;

    constructor(url: string) {
        this.url = url;
        eventSourceInstances.push(this);
    }

    close() {
        this.readyState = 2;
    }

    simulateMessage(data: unknown) {
        if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
        }
    }

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
        return true;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.EventSource = EventSourceMock as any;
