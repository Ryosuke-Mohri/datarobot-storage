import { AppStateData, Action, LLM_MODEL } from './types';
import { ACTION_TYPES, DEFAULT_VALUES, STORAGE_KEYS } from './constants';
import { getStorageItem, setStorageItem } from '@/lib/storage';

export const createInitialState = (): AppStateData => {
    return {
        selectedLlmModel: getStorageItem(STORAGE_KEYS.SELECTED_LLM_MODEL)
            ? JSON.parse(getStorageItem(STORAGE_KEYS.SELECTED_LLM_MODEL)!)
            : DEFAULT_VALUES.selectedLlmModel,
        availableLlmModels: null,
        showRenameChatModalForId: DEFAULT_VALUES.showRenameChatModalForId,
        showDeleteChatModalForId: DEFAULT_VALUES.showDeleteChatModalForId,
    };
};

export const reducer = (state: AppStateData, action: Action): AppStateData => {
    switch (action.type) {
        case ACTION_TYPES.SET_SELECTED_LLM_MODEL:
            setStorageItem(STORAGE_KEYS.SELECTED_LLM_MODEL, JSON.stringify(action.payload));
            return {
                ...state,
                selectedLlmModel: action.payload,
            };
        case ACTION_TYPES.SET_AVAILABLE_LLM_MODELS:
            return {
                ...state,
                availableLlmModels: action.payload,
            };
        case ACTION_TYPES.SET_SHOW_RENAME_CHAT_MODAL_FOR_ID:
            return {
                ...state,
                showRenameChatModalForId: action.payload.chatId,
            };
        case ACTION_TYPES.SET_SHOW_DELETE_CHAT_MODAL_FOR_ID:
            return {
                ...state,
                showDeleteChatModalForId: action.payload.chatId,
            };
        default:
            return state;
    }
};

export const actions = {
    setSelectedLlmModel: (model: LLM_MODEL): Action => ({
        type: ACTION_TYPES.SET_SELECTED_LLM_MODEL,
        payload: model,
    }),
    setAvailableLlmModels: (models: LLM_MODEL[]): Action => ({
        type: ACTION_TYPES.SET_AVAILABLE_LLM_MODELS,
        payload: models,
    }),
    setShowRenameChatModalForId: (chatId: string | null): Action => ({
        type: ACTION_TYPES.SET_SHOW_RENAME_CHAT_MODAL_FOR_ID,
        payload: { chatId },
    }),
    setShowDeleteChatModalForId: (chatId: string | null): Action => ({
        type: ACTION_TYPES.SET_SHOW_DELETE_CHAT_MODAL_FOR_ID,
        payload: { chatId },
    }),
};
