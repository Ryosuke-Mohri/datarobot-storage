import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    deleteChatById,
    renameChatById,
    getAllChats,
    getMessages,
    getLlmCatalog,
    postMessage,
    startNewChat,
} from './requests';
import { chatKeys } from './keys';
import { IChatMessage, IPostMessageContext, IUserMessage, IChat } from './types';
import { useAppState } from '@/state';
import { AGENT_MODEL_LLM } from '@/api/chat/constants.ts';
import { ROUTES } from '@/pages/routes.ts';

export const useCreateChat = () => {
    const { selectedLlmModel } = useAppState();
    const queryClient = useQueryClient();

    return useMutation<IChat, Error, IUserMessage, IPostMessageContext>({
        mutationFn: ({ message, context, knowledgeBase, knowledgeBaseId, type }) => {
            // Fallback to legacy pages format for backward compatibility
            const pages = Array.isArray(context?.pages)
                ? context.pages
                : Object.values(context?.pages || []);

            if (pages.length > 0) {
                console.warn('Legacy pages format detected. Consider updating to use fileIds.');
            }

            const fileIds =
                context?.fileIds && context.fileIds.length > 0 ? context.fileIds : undefined;
            return startNewChat({
                message: message,
                model: selectedLlmModel.model,
                knowledgeBase: knowledgeBase || undefined,
                knowledgeBaseId: knowledgeBaseId || undefined,
                fileIds,
                type,
            });
        },
        onError: error => {
            toast.error(error?.message || 'Failed to send message');
        },
        onSuccess: data => {
            queryClient.setQueryData<IChat[]>(chatKeys.all, (oldData = []) => [...oldData, data]);
            queryClient.invalidateQueries({ queryKey: chatKeys.chatList() });
        },
    });
};

export const usePostMessage = ({ chatId }: { chatId?: string }) => {
    const { selectedLlmModel } = useAppState();
    const queryClient = useQueryClient();
    return useMutation<IChatMessage[], Error, IUserMessage, IPostMessageContext>({
        mutationFn: ({ message, context, knowledgeBase, knowledgeBaseId, type }) => {
            if (!chatId) {
                throw new Error('chatId is required');
            }
            // Fallback to legacy pages format for backward compatibility
            const pages = Array.isArray(context?.pages)
                ? context.pages
                : Object.values(context?.pages || []);

            if (pages.length > 0) {
                console.warn('Legacy pages format detected. Consider updating to use fileIds.');
            }

            const fileIds =
                context?.fileIds && context.fileIds.length > 0 ? context.fileIds : undefined;
            return postMessage({
                message: message,
                model: selectedLlmModel.model,
                chatId,
                knowledgeBase: knowledgeBase || undefined,
                knowledgeBaseId: knowledgeBaseId || undefined,
                fileIds,
                type,
            });
        },
        onError: (error, _variables, context) => {
            // Restore previous messages
            if (context?.previousMessages && context?.messagesKey) {
                queryClient.setQueryData(context.messagesKey, context.previousMessages);
            }
            toast.error(error?.message || 'Failed to send message');
        },
        onSuccess: data => {
            // Merge without duplicating entries that may already exist via SSE
            queryClient.setQueryData<IChatMessage[]>(chatKeys.messages(chatId), (oldData = []) => {
                const next = [...oldData];
                data.forEach(message => {
                    if (chatId !== message.chat_id) {
                        // Chat ID mismatch can happen when user submits a prompt and changes to a different chat
                        return;
                    }
                    const existingIndex = next.findIndex(
                        existing => existing.uuid === message.uuid
                    );
                    if (existingIndex >= 0) {
                        // Do not replace a final message with an older incomplete message
                        if (!next[existingIndex].in_progress && message.in_progress) {
                            return;
                        }
                        next[existingIndex] = message;
                    } else {
                        next.push(message);
                    }
                });
                return next;
            });
            queryClient.setQueryData<IChat[]>(chatKeys.chatList(), (oldData = []) => {
                return oldData.map(chat =>
                    chat.uuid === data[data.length - 1].chat_id
                        ? ({ ...chat, updated_at: data[data.length - 1].created_at } as IChat)
                        : chat
                );
            });
        },
    });
};

export const useChatMessages = ({
    chatId,
    shouldRefetch,
}: {
    chatId?: string;
    shouldRefetch?: number;
}) => {
    return useQuery<IChatMessage[]>({
        queryKey: chatKeys.messages(chatId),
        queryFn: async ({ signal }) => {
            return await getMessages({ chatId: chatId!, signal });
        },
        enabled: !!chatId,
        refetchInterval: shouldRefetch,
    });
};

export const useChats = () => {
    return useQuery<IChat[]>({
        queryKey: chatKeys.chatList(),
        queryFn: async ({ signal }) => {
            return await getAllChats(signal);
        },
        staleTime: 60000, // Use 1 minute, we have invalidate calls when item is changed/deleted
    });
};

export const useChatsDelete = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();

    return useMutation<void, Error, { chatId: string }>({
        mutationFn: ({ chatId }) => deleteChatById({ chatId }),
        onSuccess: (_, { chatId }) => {
            queryClient.invalidateQueries({ queryKey: chatKeys.chatList() });
            if (location.pathname.includes(chatId)) {
                navigate(ROUTES.CHAT);
            }
        },
    });
};

export const useChatsRename = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { chatId: string; chatName: string }>({
        mutationFn: ({ chatId, chatName }) => renameChatById({ chatId, chatName }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chatKeys.chatList() });
            toast.success('Chat renamed successfully');
        },
        onError: error => {
            toast.error(error?.message || 'Failed to rename chat');
        },
    });
};

export const useLlmCatalog = () => {
    return useQuery({
        queryKey: chatKeys.llmCatalog,
        queryFn: () => getLlmCatalog(),
        select: data => {
            return [AGENT_MODEL_LLM, ...data];
        },
        staleTime: 60000,
    });
};
