'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Copy, ArrowRight, Image as ImageIcon, Wand2, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ContentVariation {
    subject?: string;
    content: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    subject?: string;
    variations?: ContentVariation[];
    timestamp: Date;
}

interface AIContentAssistantProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsertContent: (content: string, subject?: string) => void;
    onInsertImage?: (imageUrl: string) => void;
    initialTab?: 'text' | 'image';
    context?: {
        platform?: string;
        existingContent?: string;
    };
}

export function AIContentAssistant({
    open,
    onOpenChange,
    onInsertContent,
    onInsertImage,
    initialTab = 'text',
    context,
}: AIContentAssistantProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [prompt, setPrompt] = useState('');
    const [imagePrompt, setImagePrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [generatedImagePrompt, setGeneratedImagePrompt] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // Quick suggestion prompts
    const suggestions = [
        'Create an engaging post',
        'Make it more professional',
        'Add emojis and make it fun',
        'Shorten this message',
        'Make it more persuasive',
        'Add a call-to-action',
    ];

    const platformSuggestions: Record<string, string[]> = {
        INSTAGRAM: ['Create a catchy caption', 'Add trending hashtags', 'Make it story-worthy'],
        LINKEDIN: ['Write a professional update', 'Share industry insights', 'Announce achievement'],
        FACEBOOK: ['Create an engaging post', 'Ask a question', 'Share a story'],
        TWITTER: ['Write a tweet thread', 'Create a viral tweet', 'Add trending topics'],
        EMAIL: ['Write a compelling subject line', 'Create email body', 'Add professional signature'],
        SMS: ['Keep it under 160 characters', 'Make it urgent', 'Add clear CTA'],
        WHATSAPP: ['Make it friendly and casual', 'Add emojis', 'Keep it conversational'],
    };

    const currentSuggestions = context?.platform
        ? platformSuggestions[context.platform] || suggestions
        : suggestions;

    const handleGenerateContent = async (customPrompt?: string) => {
        const userPrompt = customPrompt || prompt;
        if (!userPrompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        try {
            setLoading(true);

            // Add user message to chat
            const userMessage: Message = {
                role: 'user',
                content: userPrompt,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMessage]);
            setPrompt('');

            // Call API
            const response = await fetch('/api/ai/generate-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: userPrompt,
                    context: {
                        platform: context?.platform,
                        existingContent: context?.existingContent,
                    },
                    mode: context?.existingContent ? 'refine' : 'generate',
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate content');
            }

            // Add assistant message to chat
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.content,
                subject: data.subject,
                variations: data.variations,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error: any) {
            console.error('Error generating content:', error);
            toast.error(error.message || 'Failed to generate content');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateImage = async () => {
        if (!imagePrompt.trim()) {
            toast.error('Please enter an image description');
            return;
        }

        try {
            setImageLoading(true);
            setGeneratedImagePrompt('');

            // Create a minimum delay promise of 5 seconds (5000ms)
            const delayPromise = new Promise(resolve => setTimeout(resolve, 5000));

            const apiCallPromise = fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: imagePrompt,
                }),
            });

            // Wait for both the API call and the minimum delay
            const [response] = await Promise.all([apiCallPromise, delayPromise]);

            if (response.status === 429) {
                throw new Error('You have reached the image generation limit. Please try again later.');
            }

            const data = await response.json();

            if (data.imagePrompt) {
                setGeneratedImagePrompt(data.imagePrompt);
                toast.success('Image generated!');
            } else {
                throw new Error(data.error || 'Failed to generate image');
            }
        } catch (error: any) {
            console.error('Error generating image:', error);
            // Show more user-friendly error messages
            const errorMessage = error.message.includes('504')
                ? 'Generation timed out. Please try again.'
                : error.message;
            toast.error(errorMessage || 'Failed to generate image');
        } finally {
            setImageLoading(false);
        }
    };

    const handleInsert = (content: string, subject?: string) => {
        onInsertContent(content, subject);
        toast.success('Content inserted!');
        onOpenChange(false);
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
    };

    const isTextOnly = context?.platform === 'SMS' || context?.platform === 'EMAIL';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Made modal wider (max-w-4xl) and ensured height responsiveness */}
            <DialogContent className="w-[95vw] min-w-5xl h-[95vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
                <DialogHeader className="p-6 pb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Sparkles className="size-5 text-primary" />
                        AI Content Assistant
                    </DialogTitle>
                    <DialogDescription>
                        Generate engaging content for your {context?.platform || 'campaign'} post
                    </DialogDescription>
                </DialogHeader>

                <Tabs key={`${open}-${initialTab}`} defaultValue={initialTab} className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b shrink-0 bg-background/95 backdrop-blur z-10">
                        <TabsList className={`grid w-full mb-2 ${isTextOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            <TabsTrigger value="text">
                                <Wand2 className="size-4 mr-2" />
                                Generate Text
                            </TabsTrigger>
                            {!isTextOnly && (
                                <TabsTrigger value="image">
                                    <ImageIcon className="size-4 mr-2" />
                                    Generate Image
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <TabsContent value="text" className="flex-1 flex flex-col min-h-0 m-0">
                        {/* Chat History */}
                        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                            <div className="space-y-6 pb-4 max-h-[30vh]">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground p-8">
                                        <div className="bg-primary/10 p-4 rounded-full mb-4">
                                            <Sparkles className="size-8 text-primary" />
                                        </div>
                                        <h3 className="font-semibold text-lg mb-2">How can I help you?</h3>
                                        <p className="text-sm max-w-sm mx-auto">
                                            Start a conversation to generate post ideas, refine your captions, or create professional updates.
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((message, index) => (
                                        <div key={index} className={`flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start w-full'}`}>
                                            {message.role === 'user' ? (
                                                /* User Message Bubble */
                                                <div className="max-w-[85%] rounded-2xl p-4 bg-primary text-primary-foreground shadow-sm">
                                                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                                                </div>
                                            ) : (
                                                /* Assistant Message Container */
                                                <div className="w-full space-y-4">
                                                    {message.variations && message.variations.length > 0 ? (
                                                        <div className="w-full">
                                                            <div className="flex items-center justify-between mb-3 px-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Sparkles className="size-4 text-primary fill-primary/20" />
                                                                    <p className="text-sm font-medium text-muted-foreground">
                                                                        Here are a few variations for you:
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-xs text-muted-foreground hover:text-primary"
                                                                    onClick={() => handleGenerateContent(messages[index - 1]?.content)}
                                                                    disabled={loading}
                                                                >
                                                                    <RefreshCw className={`size-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                                                                    Regenerate
                                                                </Button>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                                                                {message.variations.map((variation, vIndex) => (
                                                                    <div
                                                                        key={vIndex}
                                                                        className="group relative bg-card hover:bg-accent/5 rounded-xl border border-border/50 hover:border-primary/50 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden"
                                                                    >
                                                                        {/* Header color accent */}
                                                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />

                                                                        <div className="p-4 flex-1 pl-5">
                                                                            {variation.subject && (
                                                                                <div className="mb-3">
                                                                                    <Badge variant="outline" className="mb-1.5 text-[10px] bg-primary/5 border-primary/20 text-primary h-5 px-1.5">TITLE</Badge>
                                                                                    <h4 className="font-medium text-sm leading-snug text-foreground/90 line-clamp-2">
                                                                                        {variation.subject}
                                                                                    </h4>
                                                                                </div>
                                                                            )}

                                                                            <div>
                                                                                {!variation.subject && <Badge variant="outline" className="mb-1.5 text-[10px] h-5 px-1.5">CONTENT</Badge>}
                                                                                <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
                                                                                    {variation.content}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="p-3 bg-muted/30 border-t flex justify-between items-center gap-2 pl-5">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                className="h-7 text-xs hover:bg-background text-muted-foreground"
                                                                                onClick={() => handleCopy(variation.content)}
                                                                            >
                                                                                <Copy className="size-3 mr-1.5" />
                                                                                Copy
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-7 text-xs bg-primary/90 hover:bg-primary shadow-sm"
                                                                                onClick={() => handleInsert(variation.content, variation.subject)}
                                                                            >
                                                                                <Check className="size-3 mr-1.5" />
                                                                                Use This
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* Fallback for simple message (no variations) */
                                                        <div className="max-w-[85%] rounded-2xl p-5 bg-card border shadow-sm">
                                                            {message.subject && (
                                                                <div className="mb-3 pb-3 border-b">
                                                                    <p className="font-bold text-xs uppercase text-muted-foreground mb-1">Subject</p>
                                                                    <p className="font-medium text-sm">{message.subject}</p>
                                                                </div>
                                                            )}
                                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                                            <div className="flex gap-2 mt-4 pt-2 justify-end">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 text-xs"
                                                                    onClick={() => handleCopy(message.content)}
                                                                >
                                                                    <Copy className="size-3 mr-1.5" />
                                                                    Copy
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 text-xs"
                                                                    onClick={() => handleInsert(message.content, message.subject)}
                                                                >
                                                                    <ArrowRight className="size-3 mr-1.5" />
                                                                    Insert
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                                {loading && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-muted/50 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                                            <div className="bg-primary/20 p-2 rounded-full">
                                                <Loader2 className="size-4 animate-spin text-primary" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">Generating content...</p>
                                                <p className="text-xs text-muted-foreground">This may take a moment</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-4 bg-background border-t shrink-0">
                            {/* Quick Suggestions - Scrollable */}
                            <div className="mb-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
                                <div className="flex gap-2 w-max">
                                    {currentSuggestions.map((suggestion, index) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-3 py-1.5 text-xs font-normal whitespace-nowrap"
                                            onClick={() => handleGenerateContent(suggestion)}
                                        >
                                            {suggestion}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 items-end">
                                <Textarea
                                    placeholder="Describe what you want to create..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleGenerateContent();
                                        }
                                    }}
                                    className="min-h-[80px] border border-primary/20 rounded-md resize-none"
                                />
                                <Button
                                    onClick={() => handleGenerateContent()}
                                    disabled={loading || !prompt.trim()}
                                    className="h-[80px] w-[80px] shrink-0 flex flex-col gap-1"
                                >
                                    {loading ? (
                                        <Loader2 className="size-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Wand2 className="size-5" />
                                            <span className="text-xs">Generate</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="image" className="flex-1  flex flex-col m-0 p-6 min-h-0 overflow-y-auto">
                        <div className="min-w-2xl   space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-medium mb-1">Image Description</h3>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Describe the image you want to generate in detail.
                                    </p>
                                    <Textarea
                                        placeholder="E.g., A minimalist workspace with a laptop, coffee cup, and a small plant, soft natural lighting, high resolution..."
                                        value={imagePrompt}
                                        onChange={(e) => setImagePrompt(e.target.value)}
                                        rows={3}
                                        className="border border-primary/20 rounded-md resize-none"
                                    />
                                </div>

                                <Button
                                    onClick={handleGenerateImage}
                                    disabled={imageLoading || !imagePrompt.trim()}
                                    className="w-full"
                                >
                                    {imageLoading ? (
                                        <>
                                            <Loader2 className="size-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="size-4 mr-2" />
                                            Generate Image
                                        </>
                                    )}
                                </Button>
                            </div>

                            {(generatedImagePrompt || imageLoading) && (
                                <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
                                    <h3 className="font-medium text-center">
                                        {imageLoading ? 'Generating Preview...' : 'Result'}
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="relative aspect-square w-full max-w-xl mx-auto overflow-hidden rounded-lg border bg-background shadow-sm flex items-center justify-center">
                                            {imageLoading ? (
                                                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-muted/20">
                                                    {/* Pixel Animation Grid */}
                                                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 gap-px opacity-90 p-4">
                                                        {Array.from({ length: 144 }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className="bg-primary/10 rounded-[1px] animate-pulse"
                                                                style={{
                                                                    animationDelay: `${(i % 5) * 0.1}s`,
                                                                    animationDuration: `${1 + Math.random()}s`,
                                                                    opacity: Math.random() * 0.5 + 0.2
                                                                }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Center loading text/icon */}
                                                    <div className="relative z-10 flex flex-col items-center gap-3 bg-background/80 backdrop-blur-sm p-6 rounded-2xl border shadow-sm">
                                                        <Loader2 className="size-8 animate-spin text-primary" />
                                                        <p className="text-sm font-medium text-muted-foreground animate-pulse">
                                                            Rendering pixels...
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : generatedImagePrompt.startsWith('http') ? (
                                                <img
                                                    src={generatedImagePrompt}
                                                    alt="Generated content"
                                                    className="object-contain w-full h-full"
                                                />
                                            ) : (
                                                <div className="text-center p-4">
                                                    <p className="text-sm text-muted-foreground">{generatedImagePrompt}</p>
                                                </div>
                                            )}
                                        </div>

                                        {!imageLoading && generatedImagePrompt.startsWith('http') && (
                                            <div className="flex justify-center gap-3">
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => setGeneratedImagePrompt('')}
                                                >
                                                    <RefreshCw className="size-4 mr-2" />
                                                    Try Again
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        if (onInsertImage) {
                                                            onInsertImage(generatedImagePrompt);
                                                            toast.success('Image inserted!');
                                                            onOpenChange(false);
                                                        }
                                                    }}
                                                >
                                                    <Check className="size-4 mr-2" />
                                                    Use This Image
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
