import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useChatSession } from '@/hooks';
import { useParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useGetKnowledgeBase } from '@/api/knowledge-bases/hooks.ts';

export function InteractiveSuggestion({ question }: { question: string }) {
    const { chatId } = useParams<{ chatId: string }>();

    const {
        selectedKnowledgeBaseId,
        hasPendingMessage,
        selectedFiles,
        actions: { handleSubmit },
    } = useChatSession(chatId);

    const actionTooltip = hasPendingMessage ? 'Wait for agent to finish responding' : 'Send';

    const { data: selectedKnowledgeBase } = useGetKnowledgeBase(
        selectedKnowledgeBaseId ?? undefined
    );

    const isActionShown = useMemo(() => {
        return Boolean(selectedFiles?.length || selectedKnowledgeBase);
    }, [selectedFiles, selectedKnowledgeBase]);

    return (
        <div className="h-fit p-2 bg-[#22272b] rounded border justify-start items-center gap-2 inline-flex w-full">
            <div className="grow shrink basis-0 text-primary text-sm font-normal leading-tight">
                {question}
            </div>
            <div className="w-9 h-p p-2 justify-center items-center flex">
                <div className="w-5 h-5 flex-col justify-center items-center gap-2.5 inline-flex">
                    <div className="text-center text-sm leading-tight cursor-pointer">
                        {isActionShown && (
                            <Button
                                variant="ghost"
                                disabled={hasPendingMessage}
                                title={actionTooltip}
                                onClick={() => {
                                    handleSubmit(
                                        false,
                                        question,
                                        selectedKnowledgeBase,
                                        selectedFiles
                                    );
                                }}
                            >
                                <Send />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
