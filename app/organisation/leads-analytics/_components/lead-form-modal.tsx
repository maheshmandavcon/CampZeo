'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LeadFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    pageId: string;
    pageAccessToken: string;
    onSuccess: (form: any) => void;
    initialData?: any;
}

export function LeadFormModal({
    isOpen,
    onClose,
    pageId,
    pageAccessToken,
    onSuccess,
    initialData
}: LeadFormModalProps) {
    const [name, setName] = useState('');
    const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
    const [questions, setQuestions] = useState<any[]>([
        { type: 'FULL_NAME', label: 'Full Name' },
        { type: 'EMAIL', label: 'Email' }
    ]);
    const [customQuestions, setCustomQuestions] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setName(`${initialData.name} (Copy)`);
            setPrivacyPolicyUrl(initialData.privacy_policy_url || '');
            // Simple mapping for initial data if needed
            // Facebook returns questions in a specific format
        } else {
            setName('');
            setPrivacyPolicyUrl('');
            setQuestions([
                { type: 'FULL_NAME', label: 'Full Name' },
                { type: 'EMAIL', label: 'Email' }
            ]);
            setCustomQuestions([]);
        }
    }, [initialData, isOpen]);

    const addCustomQuestion = () => {
        setCustomQuestions([...customQuestions, { type: 'CUSTOM', label: '' }]);
    };

    const removeCustomQuestion = (index: number) => {
        setCustomQuestions(customQuestions.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!name || !privacyPolicyUrl) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            setSaving(true);

            // Format questions for Meta API
            const formattedQuestions = [
                ...questions.map(q => ({ type: q.type })),
                ...customQuestions.map((q, i) => ({
                    type: 'CUSTOM',
                    label: q.label,
                    key: `custom_question_${i}`
                }))
            ];

            const response = await fetch('/api/socialmedia/facebook/lead-forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId,
                    pageAccessToken,
                    name,
                    privacy_policy_url: privacyPolicyUrl,
                    questions: formattedQuestions,
                    follow_up_action_url: privacyPolicyUrl // Fallback or user can define?
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create lead form');
            }

            const data = await response.json();
            toast.success('Lead form created successfully');
            onSuccess(data.result);
            onClose();
        } catch (error) {
            console.error('Error creating lead form:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create lead form');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Duplicate & Edit Lead Form' : 'Create New Lead Form'}</DialogTitle>
                    <DialogDescription>
                        Define the fields you want to collect from your leads.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="formName">Form Name *</Label>
                        <Input
                            id="formName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Summer Campaign Lead Form"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="privacyUrl">Privacy Policy URL *</Label>
                        <Input
                            id="privacyUrl"
                            value={privacyPolicyUrl}
                            onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                            placeholder="https://yourwebsite.com/privacy"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label>Standard Questions</Label>
                        <div className="flex flex-wrap gap-2">
                            {questions.map((q, i) => (
                                <div key={i} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                    {q.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Custom Questions</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                tabIndex={-1}
                                className="h-7 text-xs"
                                onClick={addCustomQuestion}
                            >
                                <Plus className="size-3 mr-1" />
                                Add Question
                            </Button>
                        </div>

                        {customQuestions.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No custom questions added.</p>
                        ) : (
                            <div className="space-y-2">
                                {customQuestions.map((q, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input
                                            value={q.label}
                                            onChange={(e) => {
                                                const newQuestions = [...customQuestions];
                                                newQuestions[i].label = e.target.value;
                                                setCustomQuestions(newQuestions);
                                            }}
                                            placeholder="Question label (e.g. What is your job title?)"
                                            className="h-9"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-red-500"
                                            onClick={() => removeCustomQuestion(i)}
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                        {initialData ? 'Duplicate & Create' : 'Create Form'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
