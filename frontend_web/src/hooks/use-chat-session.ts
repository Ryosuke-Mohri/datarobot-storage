import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStorageItem, setStorageItem } from '@/lib/storage';
import { useCreateChat, usePostMessage } from '@/api/chat/hooks.ts';
import { FileSchema, KnowledgeBaseWithContent, useListFiles } from '@/api/knowledge-bases/hooks';

function getSuggestPromptsMessage(knowledgeBase?: KnowledgeBaseWithContent, files?: FileSchema[]) {
    let message = 'Suggest questions to ask about';
    if (knowledgeBase) {
        message += ` knowledge base: "${knowledgeBase.title}"`;
    } else if (files && files.length > 0) {
        message += files.length > 1 ? ` files: ` : ' file: ';
        message += files.map(file => `"${file.filename}"`).join(', ');
    } else {
        return null;
    }
    return message;
}

const CHAT_DRAFT_PREFIX_KEY = 'chat-draft';
const NEWCHAT_ID = 'temp-chat-id';
const STORAGE_KEYS = {
    SELECTED_KNOWLEDGE_BASE_ID: 'SELECTED_KNOWLEDGE_BASE_ID',
    SELECTED_EXTERNAL_FILE_ID: 'SELECTED_EXTERNAL_FILE_ID',
    SELECTED_LOCAL_FILE_ID: 'SELECTED_LOCAL_FILE_ID',
    MESSAGE_DRAFT: 'MESSAGE_DRAFT',
    PENDING_MESSAGE: 'PENDING_MESSAGE',
} as const;

type ChatDraft = {
    [STORAGE_KEYS.SELECTED_EXTERNAL_FILE_ID]?: string[];
    [STORAGE_KEYS.SELECTED_KNOWLEDGE_BASE_ID]?: string;
    [STORAGE_KEYS.SELECTED_LOCAL_FILE_ID]?: string[];
    [STORAGE_KEYS.MESSAGE_DRAFT]?: string;
    [STORAGE_KEYS.PENDING_MESSAGE]?: boolean;
};

export function useChatSession(chatId: string = NEWCHAT_ID) {
    const [chatDraft, setChatDraft] = useState<ChatDraft | null>(null);
    const navigate = useNavigate();
    const { mutateAsync: sendMessage } = usePostMessage({ chatId });
    const { mutateAsync: startChat, isPending: isCreatingChat } = useCreateChat();
    const { data: uploadedFiles = [] } = useListFiles();

    const loadDraft = useCallback(() => {
        if (chatId !== NEWCHAT_ID) {
            const draft = getStorageItem(CHAT_DRAFT_PREFIX_KEY);
            const parsedDraft = draft ? JSON.parse(draft) : {};
            setChatDraft(parsedDraft[chatId] || null);
        }
    }, [chatId]);

    useEffect(() => {
        loadDraft();
    }, [loadDraft]);

    const selectedFiles = useMemo<FileSchema[]>(() => {
        const selectedExternalFileId = chatDraft?.[STORAGE_KEYS.SELECTED_EXTERNAL_FILE_ID] || [];
        const selectedLocalFileId = chatDraft?.[STORAGE_KEYS.SELECTED_LOCAL_FILE_ID] || [];

        return (
            uploadedFiles.filter(
                file =>
                    selectedExternalFileId.includes(file.uuid) ||
                    selectedLocalFileId.includes(file.uuid)
            ) || []
        );
    }, [uploadedFiles, chatDraft]);

    // Listen for storage changes from other components
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === CHAT_DRAFT_PREFIX_KEY) {
                loadDraft();
            }
        };

        // Listen for custom events (for same-tab updates)
        const handleCustomStorageChange = () => {
            loadDraft();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('chatDraftUpdated', handleCustomStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('chatDraftUpdated', handleCustomStorageChange);
        };
    }, [loadDraft]);

    const updateChatInStorage = useCallback(
        (key: string, value: string[] | string | boolean | null) => {
            const allDrafts = JSON.parse(getStorageItem(CHAT_DRAFT_PREFIX_KEY) || '{}');
            const draft = chatId === NEWCHAT_ID ? { ...chatDraft } : allDrafts[chatId] || {};

            draft[key] = value;
            allDrafts[chatId] = draft;
            setChatDraft(draft);
            if (chatId !== NEWCHAT_ID) {
                setStorageItem(CHAT_DRAFT_PREFIX_KEY, JSON.stringify(allDrafts));
            }

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('chatDraftUpdated'));
        },
        [setChatDraft, chatDraft, chatId]
    );

    const setSelectedLocalFileId = (id: string) => {
        // For the first relase we only allow one selected local file ID at a time
        const selectedIds = [id];

        updateChatInStorage(STORAGE_KEYS.SELECTED_LOCAL_FILE_ID, selectedIds);
    };

    const removeSelectedLocalFileId = (localFileId: string | null) => {
        const selectedIds = localFileId
            ? chatDraft?.[STORAGE_KEYS.SELECTED_LOCAL_FILE_ID]?.filter(id => id !== localFileId) ||
              []
            : [];

        updateChatInStorage(STORAGE_KEYS.SELECTED_LOCAL_FILE_ID, selectedIds);
    };

    const setSelectedExternalFileId = (id: string) => {
        // For the first relase we only allow one selected external file ID at a time
        const selectedIds = [id];

        updateChatInStorage(STORAGE_KEYS.SELECTED_EXTERNAL_FILE_ID, selectedIds);
    };

    const removeSelectedExternalFileId = (externalFileId: string | null) => {
        const selectedIds = externalFileId
            ? chatDraft?.[STORAGE_KEYS.SELECTED_EXTERNAL_FILE_ID]?.filter(
                  id => id !== externalFileId
              ) || []
            : [];

        updateChatInStorage(STORAGE_KEYS.SELECTED_EXTERNAL_FILE_ID, selectedIds);
    };

    const setSelectedKnowledgeBaseId = (knowledgeBaseId: string | null) => {
        updateChatInStorage(STORAGE_KEYS.SELECTED_KNOWLEDGE_BASE_ID, knowledgeBaseId);
    };

    const setMessageDraft = useCallback(
        (message: string) => {
            updateChatInStorage(STORAGE_KEYS.MESSAGE_DRAFT, message);
        },
        [updateChatInStorage]
    );

    const setHasPendingMessage = (isPending: boolean) => {
        updateChatInStorage(STORAGE_KEYS.PENDING_MESSAGE, isPending);
    };

    const setUpNewChatDraft = useCallback(
        (newChatId: string) => {
            if (chatId !== NEWCHAT_ID) return;
            const allDrafts = JSON.parse(getStorageItem(CHAT_DRAFT_PREFIX_KEY) || '{}');
            if (chatDraft?.[STORAGE_KEYS.MESSAGE_DRAFT]) {
                chatDraft[STORAGE_KEYS.MESSAGE_DRAFT] = '';
            }
            allDrafts[newChatId] = chatDraft || {};
            setStorageItem(CHAT_DRAFT_PREFIX_KEY, JSON.stringify(allDrafts));
        },
        [chatId, chatDraft]
    );

    const removeDraft = (id: string) => {
        if (id === NEWCHAT_ID) return;
        const allDrafts = JSON.parse(getStorageItem(CHAT_DRAFT_PREFIX_KEY) || '{}');
        delete allDrafts[id];
        setStorageItem(CHAT_DRAFT_PREFIX_KEY, JSON.stringify(allDrafts));
    };

    const handleSubmit = useCallback(
        async (
            isSuggestion = false,
            customMessage?: string,
            selectedKnowledgeBase?: KnowledgeBaseWithContent,
            selectedFiles?: FileSchema[]
        ) => {
            const messageToSend = isSuggestion
                ? getSuggestPromptsMessage(selectedKnowledgeBase, selectedFiles)
                : customMessage || chatDraft?.[STORAGE_KEYS.MESSAGE_DRAFT];
            const requestType = isSuggestion ? 'suggestion' : 'message';

            if (messageToSend) {
                try {
                    // Send file IDs instead of content
                    const context = selectedFiles?.length
                        ? { fileIds: selectedFiles.map(file => file.uuid) }
                        : undefined;
                    // Send only knowledge base ID instead of full knowledge base object
                    const knowledgeBaseId =
                        chatDraft?.[STORAGE_KEYS.SELECTED_KNOWLEDGE_BASE_ID] ?? undefined;

                    if (chatId && chatId !== NEWCHAT_ID) {
                        await sendMessage({
                            message: messageToSend,
                            context,
                            knowledgeBaseId,
                            type: requestType,
                        });
                    } else {
                        await startChat(
                            {
                                message: messageToSend,
                                context,
                                knowledgeBaseId,
                                type: requestType,
                            },
                            {
                                onSettled(data) {
                                    setUpNewChatDraft(data?.uuid || '');
                                    navigate(`/chat/${data?.uuid}`);
                                },
                            }
                        );
                    }
                } finally {
                    if (!isSuggestion) {
                        setMessageDraft('');
                    }
                }
            }
        },
        [sendMessage, startChat, navigate, setUpNewChatDraft, chatId, chatDraft, setMessageDraft]
    );

    return {
        selectedKnowledgeBaseId: chatDraft?.[STORAGE_KEYS.SELECTED_KNOWLEDGE_BASE_ID] || null,
        selectedExternalFileId: chatDraft?.[STORAGE_KEYS.SELECTED_EXTERNAL_FILE_ID] || [],
        selectedLocalFileId: chatDraft?.[STORAGE_KEYS.SELECTED_LOCAL_FILE_ID] || [],
        messageDraft: chatDraft?.[STORAGE_KEYS.MESSAGE_DRAFT] || '',
        hasPendingMessage: chatDraft?.[STORAGE_KEYS.PENDING_MESSAGE] || false,
        hasPendingChat: isCreatingChat,
        selectedFiles,
        actions: {
            removeSelectedExternalFileId,
            setSelectedKnowledgeBaseId,
            removeSelectedLocalFileId,
            setSelectedExternalFileId,
            setUpNewChatDraft,
            setMessageDraft,
            setSelectedLocalFileId,
            setHasPendingMessage,
            removeDraft,
            handleSubmit,
        },
    };
}
