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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, X, Info, AlignLeft, List } from 'lucide-react';
import { toast } from 'sonner';

interface LeadFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    pageId: string;
    pageAccessToken: string;
    onSuccess: (form: any) => void;
    initialData?: any;
}

interface ContactField {
    type: string;
    label: string;
}

interface CustomQuestion {
    type: string;
    label: string;
    options?: string[];
}

const CONTACT_FIELD_OPTIONS: ContactField[] = [
    { type: 'FULL_NAME', label: 'Full Name' },
    { type: 'EMAIL', label: 'Email' },
    { type: 'PHONE', label: 'Phone Number' },
    { type: 'CITY', label: 'City' },
    { type: 'STATE', label: 'State/Province' },
    { type: 'COUNTRY', label: 'Country' },
    { type: 'ZIP', label: 'Zip/Postal Code' },
];

const QUESTION_TYPES = [
    { value: 'SHORT_ANSWER', label: 'Short Answer' },
    { value: 'PARAGRAPH', label: 'Paragraph' },
    { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
];

export function LeadFormModal({
    isOpen,
    onClose,
    pageId,
    pageAccessToken,
    onSuccess,
    initialData
}: LeadFormModalProps) {
    const [activeTab, setActiveTab] = useState('form-type');
    const [saving, setSaving] = useState(false);

    // Form Type Tab
    const [formName, setFormName] = useState('');

    // Intro Tab
    const [greetingHeadline, setGreetingHeadline] = useState('');
    const [introDescription, setIntroDescription] = useState('');
    const [introStyle, setIntroStyle] = useState<'PARAGRAPH' | 'LIST'>('PARAGRAPH');
    const [introListItems, setIntroListItems] = useState<string[]>(['']);

    // Questions Tab
    const [selectedContactFields, setSelectedContactFields] = useState<string[]>(['FULL_NAME', 'EMAIL']);
    const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
    const [questionsDescription, setQuestionsDescription] = useState('');

    // Privacy Policy Tab
    const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
    const [privacyPolicyLinkText, setPrivacyPolicyLinkText] = useState('Privacy Policy');
    const [addCustomDisclaimer, setAddCustomDisclaimer] = useState(false);
    const [disclaimerTitle, setDisclaimerTitle] = useState('Terms and Conditions');
    const [disclaimerBody, setDisclaimerBody] = useState('');
    const [consentCheckboxes, setConsentCheckboxes] = useState<Array<{ title: string; text: string; is_required: boolean }>>([
        { title: 'Terms of Service', text: 'I agree to the terms and conditions.', is_required: true }
    ]);

    // Ending Tab
    const [thankYouHeadline, setThankYouHeadline] = useState('Thank you!');
    const [thankYouDescription, setThankYouDescription] = useState('We\'ll be in touch soon.');

    useEffect(() => {
        if (initialData) {
            // Map form name with (Copy) suffix
            setFormName(`${initialData.name} (Copy)`);

            // Map privacy policy
            if (initialData.privacy_policy_url) {
                setPrivacyPolicyUrl(initialData.privacy_policy_url);
                setPrivacyPolicyLinkText('Privacy Policy');
            }

            // Map questions to contact fields and custom questions
            if (initialData.questions && Array.isArray(initialData.questions)) {
                const contactFieldTypes = ['FULL_NAME', 'EMAIL', 'PHONE', 'CITY', 'STATE', 'COUNTRY', 'ZIP'];
                const contactFields: string[] = [];
                const customQs: CustomQuestion[] = [];

                initialData.questions.forEach((q: any) => {
                    if (contactFieldTypes.includes(q.type)) {
                        contactFields.push(q.type);
                    } else if (q.type === 'CUSTOM') {
                        customQs.push({
                            type: q.conditional_questions_group_id ? 'MULTIPLE_CHOICE' : 'SHORT_ANSWER',
                            label: q.label || '',
                            options: q.options || []
                        });
                    }
                });

                setSelectedContactFields(contactFields.length > 0 ? contactFields : ['FULL_NAME', 'EMAIL']);
                setCustomQuestions(customQs);
            }

            // Note: Facebook API doesn't provide context_card, thank_you_page, custom_disclaimer,
            // or question_page_custom_headline when fetching individual forms.
            // These fields are only available when creating forms, not when reading them.
            // Users will need to re-enter these fields when duplicating.
        } else {
            resetForm();
        }
    }, [initialData, isOpen]);

    const resetForm = () => {
        setActiveTab('form-type');
        setFormName('');
        setGreetingHeadline('');
        setIntroDescription('');
        setIntroStyle('PARAGRAPH');
        setIntroListItems(['']);
        setSelectedContactFields(['FULL_NAME', 'EMAIL']);
        setCustomQuestions([]);
        setQuestionsDescription('');
        setPrivacyPolicyUrl('');
        setPrivacyPolicyLinkText('Privacy Policy');
        setAddCustomDisclaimer(false);
        setDisclaimerTitle('Terms and Conditions');
        setDisclaimerBody('');
        setConsentCheckboxes([{ title: 'Terms of Service', text: 'I agree to the terms and conditions.', is_required: true }]);
        setThankYouHeadline('Thank you!');
        setThankYouDescription('We\'ll be in touch soon.');
    };

    const toggleContactField = (fieldType: string) => {
        setSelectedContactFields(prev =>
            prev.includes(fieldType)
                ? prev.filter(f => f !== fieldType)
                : [...prev, fieldType]
        );
    };

    const addCustomQuestion = () => {
        setCustomQuestions([...customQuestions, { type: 'SHORT_ANSWER', label: '', options: [] }]);
    };

    const removeCustomQuestion = (index: number) => {
        setCustomQuestions(customQuestions.filter((_, i) => i !== index));
    };

    const updateCustomQuestion = (index: number, field: keyof CustomQuestion, value: any) => {
        const updated = [...customQuestions];
        if (field === 'options') {
            updated[index].options = value;
        } else if (field === 'type' && value === 'MULTIPLE_CHOICE') {
            updated[index].type = value;
            if (!updated[index].options) updated[index].options = [''];
        } else if (field === 'type') {
            updated[index].type = value as string;
            delete updated[index].options;
        } else {
            (updated[index] as any)[field] = value;
        }
        setCustomQuestions(updated);
    };

    const addOption = (questionIndex: number) => {
        const updated = [...customQuestions];
        if (!updated[questionIndex].options) updated[questionIndex].options = [];
        updated[questionIndex].options!.push('');
        setCustomQuestions(updated);
    };

    const removeOption = (questionIndex: number, optionIndex: number) => {
        const updated = [...customQuestions];
        if (updated[questionIndex].options) {
            updated[questionIndex].options = updated[questionIndex].options!.filter((_, i) => i !== optionIndex);
        }
        setCustomQuestions(updated);
    };

    const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
        const updated = [...customQuestions];
        if (updated[questionIndex].options) {
            updated[questionIndex].options![optionIndex] = value;
        }
        setCustomQuestions(updated);
    };

    const validateCurrentTab = (tabToValidate?: string): boolean => {
        const tab = tabToValidate || activeTab;
        switch (tab) {
            case 'form-type':
                if (!formName.trim()) {
                    toast.error('Please enter a form name');
                    return false;
                }
                return true;
            case 'intro':
                if (greetingHeadline.trim()) { // If headline is provided, description/list must also be valid
                    if (introStyle === 'PARAGRAPH' && !introDescription.trim()) {
                        toast.error('Intro description is required if greeting headline is provided');
                        return false;
                    }
                    if (introStyle === 'LIST' && introListItems.filter(i => i.trim()).length === 0) {
                        toast.error('At least one intro list item is required if greeting headline is provided');
                        return false;
                    }
                }
                return true;
            case 'questions':
                if (selectedContactFields.length === 0) {
                    toast.error('Please select at least one contact field');
                    return false;
                }
                const emptyCustomQuestion = customQuestions.find(q => !q.label?.trim());
                if (emptyCustomQuestion) {
                    toast.error('All custom questions must have a label');
                    return false;
                }
                const invalidMcq = customQuestions.find(q =>
                    q.type === 'MULTIPLE_CHOICE' && (!q.options || q.options.length < 2 || q.options.some(opt => !opt.trim()))
                );
                if (invalidMcq) {
                    toast.error('Multiple choice questions must have at least 2 valid options');
                    return false;
                }
                return true;
            case 'privacy':
                if (!privacyPolicyUrl.trim()) {
                    toast.error('Privacy policy URL is required');
                    return false;
                }
                if (addCustomDisclaimer) {
                    if (!disclaimerTitle.trim()) {
                        toast.error('Disclaimer title is required');
                        return false;
                    }
                    if (!disclaimerBody.trim()) {
                        toast.error('Disclaimer body text is required');
                        return false;
                    }
                    if (consentCheckboxes.length === 0) {
                        toast.error('At least one consent checkbox is required');
                        return false;
                    }
                    if (consentCheckboxes.some(c => !c.text.trim())) {
                        toast.error('All consent checkboxes must have text');
                        return false;
                    }
                }
                return true;
            case 'ending':
                return true;
            default:
                return true;
        }
    };

    const handleSave = async () => {
        const tabs = ['form-type', 'intro', 'questions', 'privacy', 'ending'];
        for (const tab of tabs) {
            if (!validateCurrentTab(tab)) {
                setActiveTab(tab);
                return;
            }
        }

        try {
            setSaving(true);

            const allLabels = new Set<string>();

            selectedContactFields.forEach(fieldType => {
                const field = CONTACT_FIELD_OPTIONS.find(f => f.type === fieldType);
                if (field) {
                    allLabels.add(field.label.trim().toLowerCase());
                }
            });

            for (const q of customQuestions) {
                const label = q.label.trim().toLowerCase();
                if (allLabels.has(label)) {
                    toast.error(`Question label "${q.label}" is already used. All labels must be unique.`);
                    setSaving(false);
                    return;
                }
                allLabels.add(label);
            }

            const questions = [
                ...selectedContactFields.map(fieldType => ({ type: fieldType })),
                ...customQuestions.map((q, i) => {
                    const baseQuestion = {
                        label: q.label.trim(),
                        key: `custom_question_${i}_${Date.now()}`
                    };

                    if (q.type === 'MULTIPLE_CHOICE') {
                        return {
                            ...baseQuestion,
                            type: 'CUSTOM', // Facebook uses 'CUSTOM' for both short answer and multiple choice
                            options: q.options?.map((opt, optIndex) => ({
                                value: opt.trim(),
                                key: `option_${optIndex}_${Date.now()}`
                            })) || []
                        };
                    } else {
                        // SHORT_ANSWER, PARAGRAPH, CONDITIONAL (fallback)
                        return {
                            ...baseQuestion,
                            type: 'CUSTOM'
                        };
                    }
                })
            ];

            const payload: any = {
                pageId,
                pageAccessToken,
                name: formName.trim(),
                privacy_policy_url: privacyPolicyUrl.trim(),
                privacy_policy_link_text: privacyPolicyLinkText.trim(),
                questions,
                questions_description: questionsDescription.trim(),
            };

            if (addCustomDisclaimer) {
                payload.custom_disclaimer = {
                    title: disclaimerTitle.trim(),
                    body: disclaimerBody.trim(),
                    checkboxes: consentCheckboxes.map(c => ({
                        text: c.title.trim() ? `${c.title.trim()}: ${c.text.trim()}` : c.text.trim(),
                        is_required: c.is_required
                    }))
                };
            }

            // Only add greeting and intro if both are provided (context_card requires title)
            if (greetingHeadline.trim()) {
                payload.greeting = greetingHeadline.trim();

                if (introStyle === 'PARAGRAPH' && introDescription.trim()) {
                    payload.intro_description = introDescription.trim();
                    payload.context_card_style = 'PARAGRAPH_STYLE';
                } else if (introStyle === 'LIST') {
                    const validItems = introListItems.filter(i => i.trim());
                    if (validItems.length > 0) {
                        payload.context_card_style = 'LIST_STYLE';
                        payload.context_card_content = validItems;
                    }
                }
            }

            if (thankYouHeadline.trim()) {
                payload.thank_you_headline = thankYouHeadline.trim();
            }
            if (thankYouDescription.trim()) {
                payload.thank_you_description = thankYouDescription.trim();
            }

            const response = await fetch('/api/socialmedia/facebook/lead-forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create lead form');
            }

            const data = await response.json();
            toast.success(`Form "${formName}" created successfully!`);
            onSuccess(data.result);
            onClose();
            resetForm();
        } catch (error) {
            console.error('Error creating lead form:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create lead form');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Duplicate & Edit Lead Form' : 'Create New Lead Form'}</DialogTitle>
                    <DialogDescription>
                        Create a comprehensive lead generation form with multiple sections.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="form-type">Form Details</TabsTrigger>
                        <TabsTrigger value="intro">Intro</TabsTrigger>
                        <TabsTrigger value="questions">Questions</TabsTrigger>
                        <TabsTrigger value="privacy">Privacy</TabsTrigger>
                        <TabsTrigger value="ending">Ending</TabsTrigger>
                    </TabsList>

                    {/* Form Type Tab */}
                    <TabsContent value="form-type" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="formName">Form Name *</Label>
                            <Input
                                id="formName"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Summer Campaign Lead Form"
                            />
                            <p className="text-xs text-muted-foreground">
                                This name will help you identify the form in your lead forms list.
                            </p>
                        </div>
                    </TabsContent>

                    {/* Intro Tab */}
                    <TabsContent value="intro" className="space-y-4 mt-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                            <p className="text-xs text-blue-900 dark:text-blue-100">
                                <Info className="size-3 inline mr-1" />
                                Both greeting headline and description must be provided together. Meta's API requires both fields.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="greeting">Greeting Headline</Label>
                            <Input
                                id="greeting"
                                value={greetingHeadline}
                                onChange={(e) => setGreetingHeadline(e.target.value)}
                                placeholder="e.g., Welcome! We'd love to hear from you"
                                maxLength={100}
                            />
                            <p className="text-xs text-muted-foreground">{greetingHeadline.length}/100 characters</p>
                        </div>



                        <div className="space-y-3 pt-2">
                            <Label>Description Format</Label>
                            <RadioGroup
                                value={introStyle}
                                onValueChange={(v) => setIntroStyle(v as 'PARAGRAPH' | 'LIST')}
                                className="flex space-x-4"
                            >
                                <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-accent/50 w-full has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/50">
                                    <RadioGroupItem value="PARAGRAPH" id="style-paragraph" />
                                    <Label htmlFor="style-paragraph" className="cursor-pointer flex items-center gap-2">
                                        <AlignLeft className="size-4" />
                                        Paragraph
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-accent/50 w-full has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/50">
                                    <RadioGroupItem value="LIST" id="style-list" />
                                    <Label htmlFor="style-list" className="cursor-pointer flex items-center gap-2">
                                        <List className="size-4" />
                                        List
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {introStyle === 'PARAGRAPH' ? (
                            <div className="space-y-2">
                                <Label htmlFor="introDesc">Description</Label>
                                <Textarea
                                    id="introDesc"
                                    value={introDescription}
                                    onChange={(e) => setIntroDescription(e.target.value)}
                                    placeholder="Describe what this form is for and why people should fill it out"
                                    rows={5}
                                    maxLength={500}
                                />
                                <p className="text-xs text-muted-foreground">{introDescription.length}/500 characters</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <Label>List Items</Label>
                                <div className="space-y-2">
                                    {introListItems.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <div className="size-1.5 rounded-full bg-primary shrink-0" />
                                            <Input
                                                value={item}
                                                onChange={(e) => {
                                                    const newItems = [...introListItems];
                                                    newItems[index] = e.target.value;
                                                    setIntroListItems(newItems);
                                                }}
                                                placeholder={`List item ${index + 1}`}
                                                className="flex-1"
                                                maxLength={80}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                                onClick={() => {
                                                    if (introListItems.length > 1) {
                                                        const newItems = introListItems.filter((_, i) => i !== index);
                                                        setIntroListItems(newItems);
                                                    }
                                                }}
                                                disabled={introListItems.length <= 1}
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {introListItems.length < 5 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIntroListItems([...introListItems, ''])}
                                        className="mt-2"
                                    >
                                        <Plus className="size-4 mr-2" />
                                        Add Item
                                    </Button>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                    Add up to 5 bullet points (max 80 characters each) to highlight key benefits.
                                </p>
                            </div>
                        )}
                    </TabsContent>

                    {/* Questions Tab */}
                    <TabsContent value="questions" className="space-y-4 mt-4">
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="questionsDescription">Description (Optional)</Label>
                                <Textarea
                                    id="questionsDescription"
                                    value={questionsDescription}
                                    onChange={(e) => setQuestionsDescription(e.target.value)}
                                    placeholder="Let people know how the information they give you will be used or shared."
                                    rows={2}
                                />
                                <p className="text-xs text-muted-foreground">
                                    This text will appear above the contact fields.
                                </p>
                            </div>

                            <Label>Contact Information *</Label>

                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md">
                                <p className="text-xs text-blue-900 dark:text-blue-100">
                                    <Info className="size-3 inline mr-1" />
                                    This information will be prefilled from the user's Facebook account.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm">Select information to collect:</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {CONTACT_FIELD_OPTIONS.map((field) => (
                                        <div key={field.type} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={field.type}
                                                checked={selectedContactFields.includes(field.type)}
                                                onCheckedChange={() => toggleContactField(field.type)}
                                            />
                                            <Label htmlFor={field.type} className="text-sm font-normal cursor-pointer">
                                                {field.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Custom Questions</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addCustomQuestion}
                                >
                                    <Plus className="size-4 mr-1" />
                                    Add Question
                                </Button>
                            </div>

                            {customQuestions.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No custom questions added.</p>
                            ) : (
                                <div className="space-y-3">
                                    {customQuestions.map((q, i) => (
                                        <div key={i} className="space-y-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-semibold">Question {i + 1}</Label>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                                                    onClick={() => removeCustomQuestion(i)}
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>

                                            <div className="grid gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Type</Label>
                                                    <Select
                                                        value={q.type}
                                                        onValueChange={(value) => updateCustomQuestion(i, 'type', value)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select question type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {QUESTION_TYPES.map((type) => (
                                                                <SelectItem key={type.value} value={type.value}>
                                                                    {type.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Question Text</Label>
                                                    <Input
                                                        value={q.label}
                                                        onChange={(e) => updateCustomQuestion(i, 'label', e.target.value)}
                                                        placeholder="e.g., What is your preferred contact method?"
                                                    />
                                                </div>

                                                {q.type === 'MULTIPLE_CHOICE' && (
                                                    <div className="space-y-2 mt-2 pl-2 border-l-2 border-primary/20">
                                                        <Label className="text-xs font-semibold">Options</Label>
                                                        {q.options?.map((opt, optIndex) => (
                                                            <div key={optIndex} className="flex items-center gap-2">
                                                                <div className="size-2 rounded-full border border-primary/50" />
                                                                <Input
                                                                    value={opt}
                                                                    onChange={(e) => updateOption(i, optIndex, e.target.value)}
                                                                    placeholder={`Option ${optIndex + 1}`}
                                                                    className="h-8 text-sm"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                                                    onClick={() => removeOption(i, optIndex)}
                                                                    disabled={q.options?.length !== undefined && q.options.length <= 2}
                                                                >
                                                                    <X className="size-3" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => addOption(i)}
                                                            className="mt-1 h-7 text-xs"
                                                        >
                                                            <Plus className="size-3 mr-1" />
                                                            Add Option
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Privacy Policy Tab */}
                    <TabsContent value="privacy" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="privacyUrl">Privacy Policy URL *</Label>
                            <Input
                                id="privacyUrl"
                                value={privacyPolicyUrl}
                                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                                placeholder="https://yourwebsite.com/privacy"
                                type="url"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="privacyLinkText">Privacy Policy Link Text</Label>
                            <Input
                                id="privacyLinkText"
                                value={privacyPolicyLinkText}
                                onChange={(e) => setPrivacyPolicyLinkText(e.target.value)}
                                placeholder="Privacy Policy"
                            />
                        </div>

                        <div className="border-t pt-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Custom Disclaimer</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Add custom terms and consent checkboxes.
                                    </p>
                                </div>
                                <Switch
                                    checked={addCustomDisclaimer}
                                    onCheckedChange={setAddCustomDisclaimer}
                                    className="data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700 border border-slate-300 dark:border-slate-600 shadow-sm"
                                />
                            </div>

                            {addCustomDisclaimer && (
                                <div className="space-y-4 pt-2 border rounded-md p-4 bg-muted/20">
                                    <div className="space-y-2">
                                        <Label htmlFor="disclaimerTitle">Disclaimer Title *</Label>
                                        <Input
                                            id="disclaimerTitle"
                                            value={disclaimerTitle}
                                            onChange={(e) => setDisclaimerTitle(e.target.value)}
                                            placeholder="Terms and Conditions"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="disclaimerBody">Disclaimer Text *</Label>
                                        <Textarea
                                            id="disclaimerBody"
                                            value={disclaimerBody}
                                            onChange={(e) => setDisclaimerBody(e.target.value)}
                                            placeholder="Enter your legal disclaimer text here..."
                                            rows={4}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Consent Checkboxes</Label>
                                        <div className="space-y-3">
                                            {consentCheckboxes.map((checkbox, index) => (
                                                <div key={index} className="flex flex-col gap-2 p-3 bg-card border rounded-md">
                                                    <div className="flex gap-2 items-start">
                                                        <div className="pt-2">
                                                            <Checkbox
                                                                checked={checkbox.is_required}
                                                                onCheckedChange={(checked) => {
                                                                    const updated = [...consentCheckboxes];
                                                                    updated[index].is_required = checked === true;
                                                                    setConsentCheckboxes(updated);
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-2">
                                                            <Input
                                                                value={checkbox.title}
                                                                onChange={(e) => {
                                                                    const updated = [...consentCheckboxes];
                                                                    updated[index].title = e.target.value;
                                                                    setConsentCheckboxes(updated);
                                                                }}
                                                                placeholder="Consent Title (e.g., Marketing)"
                                                                className="h-9 text-sm font-medium"
                                                            />
                                                            <Textarea
                                                                value={checkbox.text}
                                                                onChange={(e) => {
                                                                    const updated = [...consentCheckboxes];
                                                                    updated[index].text = e.target.value;
                                                                    setConsentCheckboxes(updated);
                                                                }}
                                                                placeholder="Consent Text (e.g., I agree to receive marketing emails...)"
                                                                rows={2}
                                                                className="text-sm"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {checkbox.is_required ? 'Required' : 'Optional'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() => {
                                                                const updated = consentCheckboxes.filter((_, i) => i !== index);
                                                                setConsentCheckboxes(updated);
                                                            }}
                                                        >
                                                            <X className="size-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setConsentCheckboxes([...consentCheckboxes, { title: '', text: '', is_required: false }])}
                                            className="mt-2"
                                        >
                                            <Plus className="size-4 mr-2" />
                                            Add Consent
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Ending Tab */}
                    <TabsContent value="ending" className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="thankYouHeadline">Thank You Headline</Label>
                            <Input
                                id="thankYouHeadline"
                                value={thankYouHeadline}
                                onChange={(e) => setThankYouHeadline(e.target.value)}
                                placeholder="Thank you!"
                                maxLength={100}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="thankYouDesc">Thank You Description</Label>
                            <Textarea
                                id="thankYouDesc"
                                value={thankYouDescription}
                                onChange={(e) => setThankYouDescription(e.target.value)}
                                placeholder="We'll be in touch soon."
                                rows={4}
                                maxLength={300}
                            />
                            <p className="text-xs text-muted-foreground">{thankYouDescription.length}/300 characters</p>
                        </div>

                        <div className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium text-sm mb-2">Preview</h4>
                            <div className="p-3 bg-background border rounded-md">
                                <h3 className="font-semibold">{thankYouHeadline || 'Thank you!'}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {thankYouDescription || 'We\'ll be in touch soon.'}
                                </p>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2">
                    {activeTab === 'ending' ? (
                        // Last tab: Show Cancel and Create Form buttons
                        <>
                            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                                {initialData ? 'Duplicate & Create' : 'Create Form'}
                            </Button>
                        </>
                    ) : (
                        // First 4 tabs: Show Previous and Next buttons
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const tabs = ['form-type', 'intro', 'questions', 'privacy', 'ending'];
                                    const currentIndex = tabs.indexOf(activeTab);
                                    if (currentIndex > 0) {
                                        setActiveTab(tabs[currentIndex - 1]);
                                    }
                                }}
                                disabled={activeTab === 'form-type'}
                            >
                                Previous
                            </Button>
                            <Button
                                onClick={() => {
                                    if (!validateCurrentTab()) return;
                                    const tabs = ['form-type', 'intro', 'questions', 'privacy', 'ending'];
                                    const currentIndex = tabs.indexOf(activeTab);
                                    if (currentIndex < tabs.length - 1) {
                                        setActiveTab(tabs[currentIndex + 1]);
                                    }
                                }}
                            >
                                Next
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
