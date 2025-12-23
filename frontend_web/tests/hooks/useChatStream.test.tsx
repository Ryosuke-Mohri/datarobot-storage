import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChatStream } from '@/hooks';
import { ReactNode } from 'react';
import { EventSourceMock, eventSourceInstances } from '../setupTests';

describe('useChatStream tests', () => {
    let queryClient: QueryClient;
    let localEventSourceInstances: EventSourceMock[] = [];

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        });
        localEventSourceInstances = [];
        eventSourceInstances.length = 0;

        // Mock EventSource and track instances
        global.EventSource = vi.fn((url: string) => {
            const instance = new EventSourceMock(url);
            localEventSourceInstances.push(instance);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return instance as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;
    });

    afterEach(() => {
        vi.clearAllMocks();
        localEventSourceInstances = [];
        eventSourceInstances.length = 0;
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    it('should close old stream and open new one when user switches between chats', () => {
        const { rerender } = renderHook(({ chatId }) => useChatStream(chatId), {
            wrapper,
            initialProps: { chatId: 'chat-1' },
        });

        expect(EventSource).toHaveBeenCalledTimes(1);
        expect(localEventSourceInstances[0].url).toContain('chat-1');
        const firstStreamCloseSpy = vi.spyOn(localEventSourceInstances[0], 'close');

        // User switches to different chat
        rerender({ chatId: 'chat-2' });

        expect(firstStreamCloseSpy).toHaveBeenCalled();
        expect(EventSource).toHaveBeenCalledTimes(2);
        expect(localEventSourceInstances[1].url).toContain('chat-2');
    });

    it('should activate polling fallback after multiple consecutive connection errors', async () => {
        const chatId = 'test-chat';
        const { result } = renderHook(() => useChatStream(chatId), { wrapper });

        expect(result.current.isPollingFallbackActive).toBe(false);

        // Simulate 10 consecutive connection failures
        const latestStream = localEventSourceInstances[localEventSourceInstances.length - 1];
        await act(async () => {
            for (let i = 0; i < 10; i++) {
                if (latestStream.onerror) {
                    latestStream.onerror(new Event('error'));
                }
            }
        });

        await waitFor(
            () => {
                expect(result.current.isPollingFallbackActive).toBe(true);
            },
            { timeout: 100 }
        );
    });

    it('should close connection when component unmounts', () => {
        const chatId = 'test-chat';
        const { unmount } = renderHook(() => useChatStream(chatId), { wrapper });

        const closeSpy = vi.spyOn(localEventSourceInstances[0], 'close');
        unmount();

        expect(closeSpy).toHaveBeenCalled();
    });
});
