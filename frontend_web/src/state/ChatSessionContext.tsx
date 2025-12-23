import { createContext, useContext } from 'react';
import { useChatSession } from '@/hooks';

type ChatSessionValue = ReturnType<typeof useChatSession>;

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

export function useChatSessionContext(): ChatSessionValue {
    const context = useContext(ChatSessionContext);
    if (!context) {
        throw new Error('useChatSessionContext must be used within a ChatSessionContext.Provider');
    }
    return context;
}

export function ChatSessionProvider({
    value,
    children,
}: {
    value: ChatSessionValue;
    children: React.ReactNode;
}) {
    return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}
