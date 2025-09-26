import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils.ts';

export function TruncatedWithTooltip({
    text,
    maxWidthClass = 'max-w-xs',
}: {
    text: string;
    maxWidthClass: string;
}) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <p className={cn('cursor-default truncate', maxWidthClass)}>{text}</p>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs whitespace-normal break-words">
                    <p>{text}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
