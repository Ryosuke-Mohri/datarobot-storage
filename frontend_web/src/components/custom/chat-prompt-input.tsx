import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    FileChartColumnIncreasing,
    ArrowUpFromLine,
    BookOpenText,
    CloudUpload,
    Send,
    WandSparkles,
    XIcon,
    Plus,
    Info,
} from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils.ts';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useFileUploadMutation,
    useListKnowledgeBases,
    useGetKnowledgeBase,
} from '@/api/knowledge-bases/hooks';
import { useChatSession } from '@/hooks';
import { ConnectedSourcesDialog } from '@/components/custom/connected-sources-dialog';
import { ExternalFile, useExternalFileUploadMutation } from '@/api/external-files';
import { useAppState } from '@/state';
import { AGENT_MODEL } from '@/api/chat/constants';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/pages/routes.ts';

export function ChatPromptInput({
    classNames,
    hasPendingMessage,
}: {
    classNames?: string;
    hasPendingMessage: boolean;
}) {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { chatId } = useParams<{ chatId: string }>();
    const { selectedLlmModel } = useAppState();
    const {
        selectedKnowledgeBaseId,
        selectedExternalFileId,
        selectedLocalFileId,
        messageDraft,
        selectedFiles,
        hasPendingChat,
        actions: {
            removeSelectedExternalFileId,
            setSelectedKnowledgeBaseId,
            setSelectedExternalFileId,
            removeSelectedLocalFileId,
            setSelectedLocalFileId,
            setMessageDraft,
            handleSubmit,
        },
    } = useChatSession(chatId);

    const { data: selectedKnowledgeBase } = useGetKnowledgeBase(
        selectedKnowledgeBaseId ?? undefined
    );
    const { data: bases = [], isFetched: isKnowledgeBasesFetched } = useListKnowledgeBases();
    const [isSelectFileActionMenuOpen, setIsSelectFileActionMenuOpen] = useState(false);
    const [isConnectedSourcesOpen, setIsConnectedSourcesOpen] = useState(false);
    const [isComposing, setIsComposing] = useState(false);
    const [fileUploadName, setFileUploadName] = useState<string | null>(null);

    const { mutate, isPending: isFileUploading } = useFileUploadMutation({
        onSuccess: data => {
            if (data?.[0]?.uuid) {
                setSelectedLocalFileId(data?.[0]?.uuid);
            }
        },
        onError: error => {
            console.error('Error uploading file:', error);
        },
    });

    // Deselect Knowledge Base when it is no longer found
    useEffect(() => {
        if (
            isKnowledgeBasesFetched &&
            selectedKnowledgeBaseId &&
            !bases.some(base => base.uuid === selectedKnowledgeBaseId)
        ) {
            setSelectedKnowledgeBaseId(null);
        }
    }, [selectedKnowledgeBaseId, bases, isKnowledgeBasesFetched, setSelectedKnowledgeBaseId]);

    const { mutate: mutateExternalFile, isPending: isExternalFileUploading } =
        useExternalFileUploadMutation({
            onSuccess: data => {
                setIsConnectedSourcesOpen(false);
                // We currently only support 1 file selection
                if (data?.[0]?.uuid) {
                    setSelectedExternalFileId(data[0].uuid);
                }
            },
            onError: error => {
                console.error('Error uploading external file:', error);
            },
            knowledgeBaseUuid: selectedKnowledgeBaseId ?? undefined,
        });

    const isAgentModel = selectedLlmModel.model === AGENT_MODEL;

    const showSuggestPromptButton = useMemo(() => {
        return Boolean((selectedFiles?.length || selectedKnowledgeBase) && !messageDraft);
    }, [selectedFiles, selectedKnowledgeBase, messageDraft]);

    const handleMenuClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files;
        if (uploadedFile && uploadedFile[0]) {
            setFileUploadName(uploadedFile[0]?.name);
            mutate({ files: [uploadedFile[0]] });
        }
        // Reset the input so the same file can be selected again
        e.target.value = '';
    };

    const handleExternalFileSelect = (file: ExternalFile, source: 'google' | 'box') => {
        // Upload the external file using the new API
        setFileUploadName(file?.name);
        mutateExternalFile({ file, source });
    };

    const handleConnectedSourcesClick = () => {
        setIsSelectFileActionMenuOpen(false);
        setIsConnectedSourcesOpen(true);
    };

    const handleKnowledgeBaseSelect = async (baseUuid: string) => {
        const selectedBase = bases.find(base => base.uuid === baseUuid);
        setSelectedKnowledgeBaseId(selectedBase?.uuid || null);
    };

    const handleAddKnowledgeBase = () => {
        // Navigate to the new base page
        navigate(ROUTES.ADD_KNOWLEDGE_BASE);
    };

    const handleEnterPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
            e.preventDefault();
            handleSubmit(false, messageDraft, selectedKnowledgeBase, selectedFiles);
        }
    };

    function onRemove(fileId: string) {
        if (!selectedFiles) return;
        if (selectedLocalFileId.includes(fileId)) {
            removeSelectedLocalFileId(fileId);
        }
        if (selectedExternalFileId.includes(fileId)) {
            removeSelectedExternalFileId(fileId);
        }
    }

    return (
        <>
            <div
                className={cn(
                    hasPendingMessage || hasPendingChat ? 'cursor-wait opacity-70' : '',
                    'transition-all',
                    'justify-items-center p-5 w-2xl',
                    classNames
                )}
                data-testid="chat-prompt-input"
            >
                <Textarea
                    disabled={hasPendingMessage || hasPendingChat}
                    onChange={e => setMessageDraft(e.target.value)}
                    placeholder="Ask anything..."
                    value={messageDraft}
                    className={cn(
                        hasPendingMessage || (hasPendingChat && 'pointer-events-none'),
                        'resize-none rounded-none',
                        'dark:bg-muted border-gray-700'
                    )}
                    onKeyDown={handleEnterPress}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    data-testid="chat-prompt-input-textarea"
                />
                <div className="w-full p-1 border border-t-0 border-gray-700">
                    <div className="flex items-center justify-between h-12">
                        <div className="flex gap-1 items-center">
                            <DropdownMenu
                                open={isSelectFileActionMenuOpen}
                                onOpenChange={setIsSelectFileActionMenuOpen}
                            >
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        className="justify-self-end cursor-pointer"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => true}
                                        disabled={hasPendingMessage || hasPendingChat}
                                    >
                                        <Plus strokeWidth="4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        onClick={handleMenuClick}
                                        className="cursor-pointer"
                                    >
                                        <ArrowUpFromLine />
                                        Upload from computer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleConnectedSourcesClick}
                                        className="cursor-pointer"
                                    >
                                        <CloudUpload />
                                        Upload from connected source
                                    </DropdownMenuItem>
                                    {/* Knowledge base selection for all models */}
                                    {bases.length > 0 || selectedKnowledgeBaseId ? (
                                        [
                                            ...bases.map(base => (
                                                <DropdownMenuItem
                                                    key={base.uuid}
                                                    onClick={() =>
                                                        handleKnowledgeBaseSelect(base.uuid)
                                                    }
                                                    className={cn(
                                                        'cursor-pointer',
                                                        selectedKnowledgeBaseId === base.uuid &&
                                                            'bg-primary/10 text-primary font-semibold'
                                                    )}
                                                >
                                                    <BookOpenText
                                                        className={cn(
                                                            selectedKnowledgeBaseId === base.uuid &&
                                                                'text-primary'
                                                        )}
                                                    />
                                                    <div className="flex flex-col ml-2">
                                                        <span
                                                            className={cn(
                                                                'font-medium',
                                                                selectedKnowledgeBaseId ===
                                                                    base.uuid &&
                                                                    'font-semibold text-primary'
                                                            )}
                                                        >
                                                            {base.title}
                                                        </span>
                                                        <span className="text-xs text-gray-500 truncate">
                                                            {base.files.length} file
                                                            {base.files.length !== 1
                                                                ? 's'
                                                                : ''} •{' '}
                                                            {base.token_count.toLocaleString()}{' '}
                                                            tokens
                                                        </span>
                                                        {!isAgentModel && (
                                                            <span className="text-xs text-amber-600 font-medium">
                                                                ⚠ High token usage possible
                                                            </span>
                                                        )}
                                                    </div>
                                                </DropdownMenuItem>
                                            )),
                                        ]
                                    ) : (
                                        <DropdownMenuItem
                                            onClick={handleAddKnowledgeBase}
                                            className="cursor-pointer"
                                        >
                                            <BookOpenText />
                                            Add knowledge base
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Info className="h-4 text-gray-400" />
                            <p className="h-4 text-base text-gray-400 leading-none">
                                Upload a file or select a knowledge base
                            </p>
                        </div>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".txt,.pdf,.docx,.md,.pptx,.csv"
                            onChange={handleFileChange}
                        />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        className={cn(
                                            'justify-self-end cursor-pointer',
                                            showSuggestPromptButton &&
                                                !chatId &&
                                                'animate-[var(--animation-blink-border-and-shadow)]'
                                        )}
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            handleSubmit(
                                                showSuggestPromptButton,
                                                messageDraft,
                                                selectedKnowledgeBase,
                                                selectedFiles
                                            )
                                        }
                                        data-testid="chat-prompt-input-submit"
                                        disabled={hasPendingMessage || hasPendingChat}
                                    >
                                        {showSuggestPromptButton ? <WandSparkles /> : <Send />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="left"
                                    className="whitespace-normal break-words"
                                >
                                    <p>
                                        {showSuggestPromptButton
                                            ? 'Ask DataRobot to suggest questions about your documents.'
                                            : 'Submit prompt'}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    {selectedKnowledgeBase && (
                        <div className="gap-2 mt-2 bg-accent/30 p-2 rounded w-1/2">
                            <div className="flex items-center spacebetween">
                                <p
                                    className="text-base truncate"
                                    title={selectedKnowledgeBase.title}
                                >
                                    {selectedKnowledgeBase.title}
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={() => setSelectedKnowledgeBaseId(null)}
                                >
                                    <XIcon />
                                </Button>
                            </div>
                            <div>
                                <div className=" flex text-sm items-center text-gray-600 gap-2 mb-2">
                                    <div className="bg-indigo-400 rounded-full px-2 py-1 text-xs text-gray-900 vertical-align-middle">
                                        Knowledge base
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {selectedKnowledgeBase.files.length} file
                                        {selectedKnowledgeBase.files.length !== 1 ? 's' : ''} •{' '}
                                        {selectedKnowledgeBase.token_count.toLocaleString()} tokens
                                    </div>
                                </div>
                                {!isAgentModel && (
                                    <div className="text-xs text-amber-600 font-medium">
                                        ⚠ High token usage possible
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {(isFileUploading || isExternalFileUploading) && (
                        <Skeleton className="w-full h-10 my-3">
                            <div className="group flex items-center pt-2 gap-4 w-full ">
                                <div className="flex justify-center items-center w-8">
                                    <FileChartColumnIncreasing className="w-6 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                    <div className="text-sm font-normal leading-tight truncate">
                                        {fileUploadName}
                                    </div>
                                </div>
                                <div className="flex items-center mx-2">Uploading...</div>
                            </div>
                        </Skeleton>
                    )}
                    {selectedFiles?.map((file, index) => (
                        <div
                            key={index}
                            className="group flex items-center pt-6 pb-3 gap-4 w-full "
                        >
                            <div className="flex justify-center items-center w-8">
                                <FileChartColumnIncreasing className="w-6 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                                <div className="text-sm font-normal leading-tight truncate">
                                    {file.filename}
                                </div>
                                <div className="text-xs text-gray-400 leading-tight truncate">
                                    File size: {formatFileSize(file?.size_bytes || 0)}
                                </div>
                            </div>
                            <div className="flex items-center ml-2">
                                <XIcon
                                    className="w-4 h-4 cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={event => {
                                        event.stopPropagation();
                                        if (hasPendingMessage || hasPendingChat) {
                                            return;
                                        }
                                        onRemove(file.uuid);
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <ConnectedSourcesDialog
                open={isConnectedSourcesOpen}
                onOpenChange={setIsConnectedSourcesOpen}
                onFileSelect={handleExternalFileSelect}
                isUploading={isExternalFileUploading}
            />
        </>
    );
}
