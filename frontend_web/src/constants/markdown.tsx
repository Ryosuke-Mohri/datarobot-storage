import React, { PropsWithChildren, HTMLAttributes } from 'react';
import { cn, extractText, isSuggestedPrompt } from '@/lib/utils';
import { SquareArrowOutUpRight } from 'lucide-react';
import { InteractiveSuggestion } from '../components/custom/interactive-suggestion';

type MarkdownComponentProps = PropsWithChildren<HTMLAttributes<HTMLElement>>;

export const MARKDOWN_COMPONENTS = {
    ul: ({ children, ...props }: MarkdownComponentProps) => {
        // Check if any li children contain suggestion content
        const hasSuggestion = React.Children.toArray(children).some(child => {
            if (
                React.isValidElement(child) &&
                child.props &&
                typeof child.props === 'object' &&
                'children' in child.props
            ) {
                const childProps = child.props as { children: React.ReactNode };
                // Check if this li element contains suggestion content
                return React.Children.toArray(childProps.children).some(isSuggestedPrompt);
            }
            return false;
        });

        return (
            <ul
                className={cn('leading-relaxed my-4', hasSuggestion ? 'pl-0' : 'list-disc pl-8 ')}
                {...props}
            >
                {children}
            </ul>
        );
    },
    ol: ({ children, ...props }: MarkdownComponentProps) => (
        <ol className="list-decimal leading-relaxed pl-8 my-4" {...props}>
            {children}
        </ol>
    ),
    li: ({ children, ...props }: MarkdownComponentProps) => {
        let childrenText = '';
        let isSuggestion = false;
        let questionText = '';

        // Check if this list item contains a suggestion
        if (Array.isArray(children)) {
            isSuggestion = children.some(isSuggestedPrompt);
            childrenText = extractText(children);
        } else if (children) {
            // Handle single child case
            isSuggestion = isSuggestedPrompt(children);
            childrenText = extractText([children]);
        }

        // Also check if the text content contains "SUGGESTION:" as a fallback
        if (!isSuggestion && childrenText.includes('SUGGESTION:')) {
            isSuggestion = true;
        }

        if (isSuggestion) {
            // Remove various forms of SUGGESTION: markers including markdown formatting
            questionText = childrenText
                .replace(/^\*\*SUGGESTION:\*\*\s*/, '') // **SUGGESTION:**
                .replace(/^\*SUGGESTION:\*\s*/, '') // *SUGGESTION:*
                .replace(/^SUGGESTION:\s*/, '') // SUGGESTION:
                .trim();

            return (
                <li className="my-1 break-words" {...props}>
                    <InteractiveSuggestion question={questionText} />
                </li>
            );
        }

        return (
            <li className="my-1" {...props}>
                {children}
            </li>
        );
    },
    h1: ({ children, ...props }: MarkdownComponentProps) => (
        <h1 className="text-4xl font-bold leading-tight mt-6 mb-4" {...props}>
            {children}
        </h1>
    ),
    h2: ({ children, ...props }: MarkdownComponentProps) => (
        <h2 className="text-3xl font-semibold leading-snug mt-6 mb-4" {...props}>
            {children}
        </h2>
    ),
    h3: ({ children, ...props }: MarkdownComponentProps) => (
        <h3 className="text-2xl font-semibold leading-snug mt-4 mb-2" {...props}>
            {children}
        </h3>
    ),
    h4: ({ children, ...props }: MarkdownComponentProps) => (
        <h4 className="text-xl font-semibold leading-snug mt-4 mb-2" {...props}>
            {children}
        </h4>
    ),
    p: ({ children, ...props }: MarkdownComponentProps) => (
        <p className="text-base leading-relaxed" {...props}>
            {children}
        </p>
    ),
    hr: ({ ...props }: MarkdownComponentProps) => <hr className="mt-4 mb-2" {...props} />,
    th: ({ children, className, ...props }: MarkdownComponentProps) => (
        <th className={cn('px-3 py-2 text-left', className)} {...props}>
            {children}
        </th>
    ),
    td: ({ children, className, ...props }: MarkdownComponentProps) => (
        <td className={cn('px-3 py-2', className)} {...props}>
            {children}
        </td>
    ),
    a: ({ children, ...props }: MarkdownComponentProps) => (
        <a
            target="_blank"
            className="inline-flex items-center text-blue-400 hover:text-blue-300 hover:underline"
            {...props}
        >
            {children}
            <SquareArrowOutUpRight size={18} className="ml-1" />
        </a>
    ),
};
