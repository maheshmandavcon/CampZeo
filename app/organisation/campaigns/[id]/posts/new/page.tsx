
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import {
    ArrowLeft,
    Loader2,
    Save,
    Eye,
    Mail,
    MessageSquare,
    Phone,
    Send,
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    Upload,
    X,
    FileText,
    Image as ImageIcon,
    Video,
    Wand2,
    Sparkles,
    Rocket,
    Plus,
    Search as SearchIcon, // Renamed to avoid potential conflict if Search is imported
    Check
} from 'lucide-react';
import { openNativeBoostPopup } from '@/lib/meta-boost-utils';
import { useUser } from '@clerk/nextjs';
import { PostPreview } from './_components/post-preview';
import { WYSIWYGPreview } from '../_components/WYSIWYGPreview';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { MetaBoostSection, MetaBoostOptions } from '../_components/MetaBoostSection';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AIContentAssistant } from '@/components/ai-content-assistant';
import { uploadToServer, deleteFromDriveImmediate } from '@/lib/upload-helper';
import { useMediaCleanup } from '@/hooks/use-media-cleanup';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isVideoUrl, getMediaPreviewUrl as getPreviewUrl } from '@/lib/media-utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";


export default function NewPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { user } = useUser();
    const router = useRouter();
    const resolvedParams = React.use(params);
    const campaignId = resolvedParams.id;
    const { trackUpload, markAsSubmitted } = useMediaCleanup();
    // const balance :any  ;

    // Form state
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [mediaUrls, setMediaUrls] = useState<string[]>([]);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isReel, setIsReel] = useState(false);

    // Platform specific fields
    const [youtubeTags, setYoutubeTags] = useState('');
    const [youtubePrivacy, setYoutubePrivacy] = useState('public');
    const [youtubeContentType, setYoutubeContentType] = useState('VIDEO'); // VIDEO, SHORT, PLAYLIST
    const [youtubePlaylistTitle, setYoutubePlaylistTitle] = useState('');
    const [pinterestBoardId, setPinterestBoardId] = useState('');
    const [pinterestLink, setPinterestLink] = useState('');
    const [senderEmail, setSenderEmail] = useState('');
    const [scheduledPostTime, setScheduledPostTime] = useState('');
    const [savingBoost, setSavingBoost] = useState(false);
    const [saving, setSaving] = useState(false);
    const [organisationPlatforms, setOrganisationPlatforms] = useState<string[]>([]);
    const [loadingPlatforms, setLoadingPlatforms] = useState(true);
    const [campaignContacts, setCampaignContacts] = useState<any[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [contentType, setContentType] = useState('POST'); // For Facebook/Instagram: POST or REEL
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
    const [campaign, setCampaign] = useState<any>(null);
    const [wallet, setWallet] = useState<any>(null);
    const [twilioStatus, setTwilioStatus] = useState<string>("NONE");

    const formatDateTimeLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Fetch campaign contacts
    useEffect(() => {
        const fetchCampaignContacts = async () => {
            try {
                setLoadingContacts(true);
                const response = await fetch(`/api/campaigns/${campaignId}`);
                if (!response.ok) {
                    console.error('Failed to fetch campaign');
                    return;
                }
                const data = await response.json();
                setCampaign(data.campaign);
                setCampaignContacts(data.campaign.contacts || []);
            } catch (error) {
                console.error('Error fetching campaign contacts:', error);
            } finally {
                setLoadingContacts(false);
            }
        };

        fetchCampaignContacts();
    }, [campaignId]);


    const [facebookPages, setFacebookPages] = useState<any[]>([]);
    const [loadingFacebookPages, setLoadingFacebookPages] = useState(false);
    const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string>('');
    const [selectedFacebookPageAccessToken, setSelectedFacebookPageAccessToken] = useState<string>('');
    const [selectedInstagramBusinessId, setSelectedInstagramBusinessId] = useState<string>('');

    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); 
    const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
    const [totalUploadCount, setTotalUploadCount] = useState(0);
    const [templates, setTemplates] = useState<any[]>([]);
    const [pinterestBoards, setPinterestBoards] = useState<{ id: string; name: string }[]>([]);
    const [loadingPinterestBoards, setLoadingPinterestBoards] = useState(false);
    const [youtubePlaylists, setYoutubePlaylists] = useState<{ id: string; title: string }[]>([]);
    const [loadingYoutubePlaylists, setLoadingYoutubePlaylists] = useState(false);

    const [selectedYoutubePlaylistId, setSelectedYoutubePlaylistId] = useState<string>('');
    const [boostOptions, setBoostOptions] = useState<MetaBoostOptions>({
        enabled: false,
        adAccountId: '',
        budget: 5,
        duration: 7,
        objective: 'OUTCOME_ENGAGEMENT',
        balance: ''
    });
    const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
    const coverUploadRef = useRef<HTMLInputElement>(null);
    // New Board State
    const [isCreatingBoard, setIsCreatingBoard] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardDescription, setNewBoardDescription] = useState('');
    const [creatingBoard, setCreatingBoard] = useState(false);
    const [socialStatus, setSocialStatus] = useState<any>(null); // New state for social status
    const [selectedLinkedInUrn, setSelectedLinkedInUrn] = useState<string>(''); // For LinkedIn organization selection
    const [leadForms, setLeadForms] = useState<any[]>([]);
    const [loadingLeadForms, setLoadingLeadForms] = useState(false);
    const [selectedLeadFormId, setSelectedLeadFormId] = useState<string>('');
    const [hasPaidPlan, setHasPaidPlan] = useState(false); // Default to false (Secure by default - no flash)
    const [isTrial, setIsTrial] = useState(false);

    // AI Assistant state
    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [aiAssistantTab, setAiAssistantTab] = useState<'text' | 'image'>('text');

    // Send Now Dialog State
    const [showSendNowDialog, setShowSendNowDialog] = useState(false);
    const [sendNowStep, setSendNowStep] = useState<'initial' | 'select_contacts'>('initial');
    const [selectedSendContacts, setSelectedSendContacts] = useState<string[]>([]);
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showSocialPublishConfirm, setShowSocialPublishConfirm] = useState(false);
    // Meta ad account balance/payment status
    const [balanceLow, setBalanceLow] = useState(false);
    const [metaHasPaymentMethod, setMetaHasPaymentMethod] = useState<boolean | null>(null);

    // Helper for inserting variables
    const insertVariable = (variable: string) => {
        const textarea = document.getElementById('message') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        const newText = before + `{{${variable}}}` + after;
        setMessage(newText);

        // Reset cursor position
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
            textarea.focus();
        }, 0);
    };

    const fetchAccounts = async () => {
        try {
            const res = await fetch('/api/socialmedia/meta-ads/accounts');
            if (res.ok) {
                const data = await res.json();
                if (data.accounts?.length > 0) {
                    const firstAccount = data.accounts[0];
                    const balance: any = firstAccount.balance;
                    // Legacy low-balance flag used to disable quick-boost when no funds
                    if (balance === "0") {
                        setBalanceLow(true);
                    } else {
                        setBalanceLow(false);
                    }

                    // Also hydrate hasPaymentMethod via the dedicated balance endpoint
                    try {
                        const balanceRes = await fetch(
                            `/api/meta/adaccount/balance?adAccountId=${encodeURIComponent(firstAccount.id)}`
                        );
                        if (balanceRes.ok) {
                            const balJson = await balanceRes.json();
                            setMetaHasPaymentMethod(!!balJson.has_payment_method);
                        } else {
                            setMetaHasPaymentMethod(null);
                        }
                    } catch (err) {
                        console.error('Error fetching Meta ad account balance:', err);
                        setMetaHasPaymentMethod(null);
                    }
                }
            } else {
                toast.error("Failed to fetch ad accounts balance. Please ensure Facebook is connected with Ads permissions.");
            }
        } catch (error) {
            console.error("Error fetching ad accounts:", error);
        }
    };
    // Fetch organisation platforms
    useEffect(() => {
        const fetchOrgPlatforms = async () => {
            try {
                setLoadingPlatforms(true);
                const response = await fetch('/api/Organisation/GetPlatforms');
                if (!response.ok) {
                    // If API fails, show all platforms
                    setOrganisationPlatforms(['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST']);
                    return;
                }
                const data = await response.json();
                const platforms = data.platforms || [];
                setOrganisationPlatforms(platforms);
            } catch (error) {
                console.error('Error fetching organisation platforms:', error);
                // Default to standard platforms on error
                setOrganisationPlatforms(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST']);
            } finally {
                setLoadingPlatforms(false);
            }
        };

        const fetchSocialStatus = async () => {
            try {
                const res = await fetch("/api/user/social-status");
                if (res.ok) {
                    const data = await res.json();
                    setSocialStatus(data);
                }
            } catch (error) {
                console.error("Failed to fetch social status", error);
            }
        };

        const fetchSubscriptionStatus = async () => {
            try {
                const res = await fetch("/api/subscription/current");
                if (res.ok) {
                    const data = await res.json();
                    // Paid plan = has active or canceling subscription AND not on trial
                    const paidStatuses = ['ACTIVE', 'active', 'CANCELING', 'COMPLETED'];
                    const hasPaidPlan = !!data.subscription &&
                        paidStatuses.includes(data.subscription.status) &&
                        !data.trial?.isActive;
                    setHasPaidPlan(hasPaidPlan);
                    setIsTrial(!!data.trial?.isActive);
                }
            } catch (error) {
                console.error("Failed to fetch subscription status", error);
            }
        };

        const fetchTwilioStatus = async () => {
            try {
                const res = await fetch('/api/twilio/request-access');
                if (res.ok) {
                    const data = await res.json();
                    if (data.requests?.length > 0) {
                        setTwilioStatus(data.requests[0].status);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch twilio status", error);
            }
        };

        const fetchWallet = async () => {
            try {
                const res = await fetch('/api/wallet/balance');
                if (res.ok) {
                    const data = await res.json();
                    setWallet(data.wallet);
                }
            } catch (error) {
                console.error("Failed to fetch wallet", error);
            }
        };

        fetchOrgPlatforms();
        fetchSocialStatus();
        fetchSubscriptionStatus();
        fetchTwilioStatus();
        fetchWallet();
    }, []);


    // Fetch Pinterest boards
    useEffect(() => {
        if (selectedPlatform === 'PINTEREST') {
            const fetchBoards = async () => {
                try {
                    setLoadingPinterestBoards(true);
                    const response = await fetch('/api/socialmedia/pinterest/boards');
                    if (response.ok) {
                        const data = await response.json();
                        setPinterestBoards(data.boards || []);
                        // If only one board, select it
                        if (data.boards && data.boards.length === 1) {
                            setPinterestBoardId(data.boards[0].id);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Pinterest boards:', error);
                    toast.error('Failed to fetch Pinterest boards');
                } finally {
                    setLoadingPinterestBoards(false);
                }
            };

            fetchBoards();
        } else if (selectedPlatform === 'YOUTUBE') {
            const fetchPlaylists = async () => {
                try {
                    setLoadingYoutubePlaylists(true);
                    const response = await fetch('/api/youtube/playlists');
                    if (response.ok) {
                        const data = await response.json();
                        setYoutubePlaylists(data.playlists || []);
                    }
                } catch (error) {
                    console.error('Error fetching YouTube playlists:', error);
                    toast.error('Failed to fetch YouTube playlists');
                } finally {
                    setLoadingYoutubePlaylists(false);
                }
            };

            fetchPlaylists();
        } else if (selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') {
            const fetchPages = async () => {
                try {
                    setLoadingFacebookPages(true);
                    const response = await fetch('/api/socialmedia/facebook/pages');
                    if (response.ok) {
                        // fetchAccounts();
                        const data = await response.json();
                        setFacebookPages(data.pages || []);

                        // If only one page, select it
                        if (data.pages && data.pages.length === 1) {
                            setSelectedFacebookPageId(data.pages[0].id);
                            setSelectedFacebookPageAccessToken(data.pages[0].access_token);
                        }
                    } else {
                        console.error('Failed to fetch Facebook pages');
                    }
                } catch (error) {
                    console.error('Error fetching Facebook pages:', error);
                    toast.error('Failed to fetch Facebook pages');
                } finally {
                    setLoadingFacebookPages(false);
                }
            };
            fetchPages();
        }
    }, [selectedPlatform]);

    // Fetch Lead Forms when Facebook Page changes
    useEffect(() => {
        if ((selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && selectedFacebookPageId && selectedFacebookPageAccessToken) {
            const fetchLeadForms = async () => {
                try {
                    setLoadingLeadForms(true);
                    const response = await fetch(`/api/socialmedia/facebook/lead-forms?pageId=${selectedFacebookPageId}&pageAccessToken=${selectedFacebookPageAccessToken}`);
                    if (response.ok) {
                        const data = await response.json();
                        setLeadForms(data.forms || []);
                    }
                } catch (error) {
                    console.error('Error fetching lead forms:', error);
                    toast.error('Failed to fetch lead forms');
                } finally {
                    setLoadingLeadForms(false);
                }
            };
            fetchLeadForms();
        } else {
            setLeadForms([]);
            setSelectedLeadFormId('');
        }
    }, [selectedFacebookPageId, selectedFacebookPageAccessToken, selectedPlatform]);

    // Get preview content with variables replaced
    const getPreviewContent = () => {
        // Use first contact from campaign for preview, or fallback to placeholder
        const sampleContact = campaignContacts.length > 0 ? campaignContacts[0] : null;

        return message
            .replace(/{{name}}/g, sampleContact?.contactName || 'John Doe')
            .replace(/{{email}}/g, sampleContact?.contactEmail || 'john@example.com')
            .replace(/{{phone}}/g, sampleContact?.contactMobile || '+1234567890')
            .replace(/{{company}}/g, 'Acme Corp'); // Company field not in contact model
    };

    // Get platform icon
    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'EMAIL':
                return Mail;
            case 'SMS':
                return MessageSquare;
            case 'WHATSAPP':
                return Phone;
            case 'FACEBOOK':
                return Facebook;
            case 'INSTAGRAM':
                return Instagram;
            case 'LINKEDIN':
                return Linkedin;
            case 'YOUTUBE':
                return Youtube;
            default:
                return Send;
        }
    };

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileInput = e.target;
        const files = Array.from(fileInput.files || []);
        if (files.length === 0) return;

        // Limit to 10 images
        if (mediaUrls.length + files.length > 10) {
            toast.error('You can upload a maximum of 10 media files');
            return;
        }

        try {
            setUploadingMedia(true);
            setUploadProgress(0); 
            setTotalUploadCount(files.length);
            setCurrentUploadIndex(0);

            const newUrls: string[] = [];
            let currentVideos = mediaUrls.filter(url => isVideoUrl(url)).length;
            let newlyAddedVideos = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setCurrentUploadIndex(i);
                
                const isVideo = file.type.startsWith('video/');

                if (selectedPlatform === 'LINKEDIN' && isVideo) {
                    if (currentVideos + newlyAddedVideos >= 1) {
                        toast.error('LinkedIn only allows one video per post. Subsequent videos were skipped.');
                        continue;
                    }
                    newlyAddedVideos++;
                }

                // Use client-side upload with organization and campaign context
                const orgId = campaign?.organisationId || campaign?.organisation?.id;
                
                const newBlob = await uploadToServer(
                    file, 
                    orgId, 
                    campaignId,
                    selectedPlatform,
                    isReel,
                    (fileProgress: number) => {
                        // Calculate total progress: ((completed_files * 100) + current_file_progress) / total_files
                        const totalProgress = Math.round(((i * 100) + fileProgress) / files.length);
                        setUploadProgress(totalProgress);
                    }
                );

                console.log(`[Drive] Media tracked: ${newBlob.url}`);
                trackUpload(newBlob.url);
                newUrls.push(newBlob.url);
                
                // Ensure progress hits the "completed file" mark precisely
                setUploadProgress(Math.round(((i + 1) * 100) / files.length));
            }

            const updatedMediaUrls = [...mediaUrls, ...newUrls];
            setMediaUrls(updatedMediaUrls);

            // Auto-detect Content Type for Instagram/Facebook
            if (selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'FACEBOOK') {
                const totalMedia = updatedMediaUrls.length;
                const videoCount = updatedMediaUrls.filter(url => isVideoUrl(url)).length;
                const imageCount = totalMedia - videoCount;

                if (videoCount === 1 && imageCount === 0) {
                    // ✅ Only 1 video → Reel
                    if (contentType !== 'REEL') {
                        setContentType('REEL');
                        setIsReel(true);
                        // toast.success('Single video detected: Switched to Reel mode');
                    }
                } else {
                    // ✅ Everything else → Standard Post
                    if (contentType === 'REEL') {
                        setContentType('POST');
                        setIsReel(false);
                        //toast.info('Switched back to Standard Post (Reels require a single video)');
                    }
                }
            }
        } catch (error) {
            console.error('Error uploading media:', error);
            toast.error('Failed to upload media');
        } finally {
            setUploadingMedia(false);
            setUploadProgress(0);
            if (fileInput) fileInput.value = '';
        }
    };

    const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileInput = e.target;
        const files = Array.from(fileInput.files || []);
        if (files.length === 0) return;

        try {
            setUploadingMedia(true);
            setUploadProgress(0);
            setTotalUploadCount(1);
            setCurrentUploadIndex(0);

            const file = files[0];

            const orgId = campaign?.organisationId || campaign?.organisation?.id;
            const newBlob = await uploadToServer(
                file, 
                orgId, 
                campaignId,
                selectedPlatform,
                isReel,
                (progress:any) => setUploadProgress(progress)
            );

            console.log(`[Drive] Thumbnail tracked: ${newBlob.url}`);
            trackUpload(newBlob.url);
            setThumbnailUrl(newBlob.url);
            toast.success('Thumbnail uploaded successfully');
        } catch (error) {
            console.error('Error uploading thumbnail:', error);
            toast.error(`Failed to upload thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploadingMedia(false);
            setUploadProgress(0);
            if (fileInput) fileInput.value = '';
        }
    };

    const removeMedia = async (index: number) => {
        const urlToRemove = mediaUrls[index];
        const updatedUrls = mediaUrls.filter((_, i) => i !== index);
        setMediaUrls(updatedUrls);

        // Immediate cleanup for manually removed files
        if (urlToRemove) {
            console.log(`[Drive] Manual removal: cleaning up ${urlToRemove}`);
            deleteFromDriveImmediate([urlToRemove]).catch(err => {
                console.error('[Drive] Manual cleanup failed:', err);
            });
        }

        // Auto-detect Content Type for Instagram/Facebook
        if (selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'FACEBOOK') {
            const totalMedia = updatedUrls.length;
            const videoCount = updatedUrls.filter(url => isVideoUrl(url)).length;
            const imageCount = totalMedia - videoCount;

            if (videoCount === 1 && imageCount === 0) {
                if (contentType !== 'REEL') {
                    setContentType('REEL');
                    setIsReel(true);
                    //toast.success('Single video remaining: Switched to Reel mode');
                }
            } else {
                if (contentType === 'REEL') {
                    setContentType('POST');
                    setIsReel(false);
                    // toast.info('Switched back to Standard Post');
                }
            }
        }
    };

    // Create new Pinterest board
    const handleCreateBoard = async () => {
        if (!newBoardName.trim()) {
            toast.error('Board name is required');
            return;
        }

        try {
            setCreatingBoard(true);
            const response = await fetch('/api/socialmedia/pinterest/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newBoardName,
                    description: newBoardDescription,
                    privacy: 'PUBLIC' // Default to public
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create board');
            }

            const data = await response.json();
            const newBoard = data.board;

            // Add new board to list and select it
            setPinterestBoards(prev => [...prev, newBoard]);
            setPinterestBoardId(newBoard.id);

            // Reset and close modal
            setNewBoardName('');
            setNewBoardDescription('');
            setIsCreatingBoard(false);

            toast.success('Board created successfully');
        } catch (error) {
            console.error('Error creating board:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create board');
        } finally {
            setCreatingBoard(false);
        }
    };
    const filteredContacts = campaignContacts.filter((contact: any) => {
        const query = contactSearchQuery.toLowerCase();
        return (
            contact.contactName?.toLowerCase().includes(query) ||
            contact.contactEmail?.toLowerCase().includes(query) ||
            contact.contactMobile?.toLowerCase().includes(query) ||
            contact.contactWhatsApp?.toLowerCase().includes(query)
        );
    });

    const toggleSendContact = (contactId: string) => {
        setSelectedSendContacts(prev =>
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        );
    };

    const toggleAllContacts = () => {
        if (filteredContacts.length === 0) return;
        const visibleIds = filteredContacts.map((c: any) => String(c.id));
        const allVisibleSelected = visibleIds.every(id => selectedSendContacts.includes(id));

        if (allVisibleSelected) {
            setSelectedSendContacts(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedSendContacts(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const executeCreateAndSend = async (targetContactIds?: string[]) => {
        try {
            setSaving(true);
            setIsSending(true);

            // Twilio credit check
            if (selectedPlatform === 'SMS' || selectedPlatform === 'WHATSAPP') {
                if (twilioStatus !== "APPROVED") {
                    toast.error(`You need admin approval to send ${selectedPlatform} messages. Please check your billing settings.`);
                    setSaving(false);
                    setIsSending(false);
                    return;
                }

                const contactsCount = targetContactIds && targetContactIds.length > 0
                    ? targetContactIds.length
                    : campaignContacts.length;

                const available = selectedPlatform === 'SMS'
                    ? (wallet?.smsCreditsAvailable || 0)
                    : (wallet?.whatsappCreditsAvailable || 0);

                if (contactsCount > available) {
                    toast.error(`You have requested ${contactsCount} ${selectedPlatform}, but only ${available} credits are available. Please add credits and try again.`);
                    setSaving(false);
                    setIsSending(false);
                    setShowSendNowDialog(false);
                    return;
                }
            }

            // 1. Create Post
            const response = await fetch(`/api/campaigns/${campaignId}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject || null,
                    message: message || null,
                    type: selectedPlatform,
                    senderEmail: selectedPlatform === 'EMAIL' ? senderEmail : null,
                    scheduledPostTime: null, // Ensure no schedule
                    mediaUrls: mediaUrls,
                    // Social fields (mostly unused for Email/SMS but good to keep)
                    youtubeTags: youtubeTags ? youtubeTags.split(',').map(t => t.trim()) : [],
                    youtubePrivacy,
                    youtubeContentType,
                    youtubePlaylistTitle,
                    youtubePlaylistId: selectedYoutubePlaylistId,
                    pinterestBoardId,
                    pinterestLink,
                    isReel,
                    contentType,
                    thumbnailUrl,
                    facebookPageId: selectedFacebookPageId,
                    facebookPageAccessToken: selectedFacebookPageAccessToken,
                    instagramBusinessId: selectedInstagramBusinessId,
                    linkedInUrn: selectedLinkedInUrn === 'personal' ? null : selectedLinkedInUrn
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create post');
            }

            const data = await response.json();
            const postId = data.post.id;

            // 2. Send Post
            // If targetContactIds is provided, use it. Otherwise send to ALL campaign contacts.
            const contactsToSend = targetContactIds && targetContactIds.length > 0
                ? targetContactIds
                : campaignContacts.map(c => c.id);

            if (contactsToSend.length === 0) {
                toast.error('No contacts available to send to.');
                // But post was created. redirect.
                router.push(`/organisation/campaigns/${campaignId}/posts`);
                return;
            }

            const sendResponse = await fetch(`/api/campaigns/${campaignId}/posts/${postId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactIds: contactsToSend })
            });

            if (!sendResponse.ok) {
                const errorData = await sendResponse.json().catch(() => ({}));
                // Post created but send failed.
                const sendErrorMsg = errorData.error || 'Unknown error';
                if (sendErrorMsg.toLowerCase().includes('credit')) {
                    toast.warning(`Post created but failed to send: ${sendErrorMsg}`, {
                        action: {
                            label: 'Add Credits',
                            onClick: () => router.push('/organisation/billing')
                        },
                    });
                } else {
                    toast.warning(`Post created but failed to send: ${sendErrorMsg}`);
                }
            } else {
                const sendData = await sendResponse.json();
                toast.success(`Post sent successfully! Sent: ${sendData.sent}, Failed: ${sendData.failed}`);
            }

            router.push(`/organisation/campaigns/${campaignId}/posts`);

        } catch (error) {
            console.error('Error creating/sending post:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to create post';
            if (errorMessage.toLowerCase().includes('credit')) {
                toast.error(errorMessage, {
                    action: {
                        label: 'Add Credits',
                        onClick: () => router.push('/organisation/billing')
                    },
                });
            } else {
                toast.error(errorMessage);
            }
        } finally {
            setSaving(false);
            setIsSending(false);
            setShowSendNowDialog(false);
        }
    };

    // Handle form submit
    const handleSubmit = async (e?: React.FormEvent, skipSocialCheck = false) => {
        if (e) e.preventDefault();

        // Validation
        if (!selectedPlatform) {
            toast.error('Please select a platform');
            return;
        }

        if (selectedPlatform === 'LINKEDIN') {
            const videoCount = mediaUrls.filter(url => isVideoUrl(url)).length;
            if (videoCount > 1) {
                toast.error('LinkedIn only allows one video per post. Please remove extra videos.');
                return;
            }
        }

        // SMS validation
        if (selectedPlatform === 'SMS') {
            if (!message) {
                toast.error('Please enter a message for SMS');
                return;
            }
        }
        // Email validation
        if (selectedPlatform === 'EMAIL') {
            if (!senderEmail) {
                toast.error('Please enter sender email');
                return;
            }
            if (!subject) {
                toast.error('Please enter a subject');
                return;
            }
            if (!message) {
                toast.error('Please enter a message');
                return;
            }
        }

        // Social Media validation
        const isSocialPlatform = selectedPlatform && !['EMAIL', 'SMS', 'WHATSAPP'].includes(selectedPlatform); // Added WHATSAPP to check

        if (isSocialPlatform) {
            if (!subject && selectedPlatform !== 'SMS') {
                toast.error('Please enter a title');

            }
        }
        // INTERCEPTION LOGIC
        // If it's Email/SMS/WhatsApp AND no schedule is set, prompt user.
        if (['EMAIL', 'SMS', 'WHATSAPP'].includes(selectedPlatform) && !scheduledPostTime) {
            setShowSendNowDialog(true);
            setSendNowStep('initial');
            return;
        }

        if (isSocialPlatform && !scheduledPostTime && !skipSocialCheck) {
            setShowSocialPublishConfirm(true);
            return;
        }

        // Media validation
        if ((selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'YOUTUBE' || selectedPlatform === 'PINTEREST') && mediaUrls.length === 0) {
            toast.error(`Instagram, YouTube, and Pinterest posts require media`);
            return;
        }

        // YouTube specific validation
        if (selectedPlatform === 'YOUTUBE' && mediaUrls.length > 0 && !mediaUrls[0].match(/\.(mp4|mov|webm)$/i)) {
            toast.error('YouTube requires a video file');
            return;
        }

        // Page validation
        if ((selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && !selectedFacebookPageId && organisationPlatforms.includes(selectedPlatform)) {
            toast.error('Please select a Facebook Page');
            return;
        }

        // Pinterest board validation
        if (selectedPlatform === 'PINTEREST' && !pinterestBoardId) {
            toast.error('Please select a Pinterest board');
            return;
        }

        // Campaign duration validation
        if (scheduledPostTime && campaign) {
            const scheduledDate = new Date(scheduledPostTime);
            const now = new Date();
            const campaignStart = new Date(campaign.startDate);
            const campaignEnd = new Date(campaign.endDate);

            // User's logic: must be within campaign and not in the past
            // Add a 1-minute grace period to 'now' to allow selecting the current minute
            const submissionTime = new Date();
            submissionTime.setSeconds(0, 0);
            if (!scheduledDate && new Date(scheduledDate) < submissionTime) {
                if (new Date(scheduledDate) < submissionTime) {
                    toast.error('Scheduled time cannot be in the past');
                } else {
                    toast.error(`Scheduled time must be after campaign start (${campaignStart.toLocaleString()})`);
                }
                return;
            }

            if (scheduledDate > campaignEnd) {
                toast.error(`Scheduled time must be before campaign end (${campaignEnd.toLocaleString()})`);
                return;
            }
        }

        try {
            setSaving(true);

            const response = await fetch(`/api/campaigns/${campaignId}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject || null,
                    message: message || null,
                    type: selectedPlatform, // Send single type
                    senderEmail: selectedPlatform === 'EMAIL' ? senderEmail : null,
                    scheduledPostTime: scheduledPostTime ? new Date(scheduledPostTime).toISOString() : null,
                    mediaUrls: mediaUrls, // Send array
                    youtubeTags: youtubeTags ? youtubeTags.split(',').map(t => t.trim()) : [],
                    youtubePrivacy,
                    youtubeContentType, // NEW: YouTube content type (VIDEO, SHORT, PLAYLIST)
                    youtubePlaylistTitle, // NEW: Playlist title if creating playlist
                    youtubePlaylistId: selectedYoutubePlaylistId, // NEW: Existing Playlist ID
                    pinterestBoardId,
                    pinterestLink,
                    isReel, // Send isReel flag
                    contentType, // NEW: Facebook/Instagram content type (POST, REEL)
                    thumbnailUrl, // Send thumbnail
                    facebookPageId: selectedFacebookPageId, // NEW: Selected Facebook Page
                    facebookPageAccessToken: selectedFacebookPageAccessToken, // NEW: Selected Facebook Page Access Token
                    instagramBusinessId: selectedInstagramBusinessId, // NEW: Linked Instagram ID
                    linkedInUrn: selectedLinkedInUrn === 'personal' ? null : selectedLinkedInUrn, // NEW: Selected LinkedIn Author URN
                    leadFormId: selectedLeadFormId && selectedLeadFormId !== 'none' ? selectedLeadFormId : null,
                    metaBoost: boostOptions.enabled ? boostOptions : undefined, // NEW: Meta Boost options
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create post');
            }

            markAsSubmitted();
            toast.success('Post created successfully');
            router.push(`/organisation/campaigns/${campaignId}/posts`);
        } catch (error) {
            console.error('Error creating post:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create post');
        } finally {
            setSaving(false);
        }
    };

    // Handle Quick Boost
    const handleQuickBoost = async () => {
        if (!selectedPlatform || !['FACEBOOK', 'INSTAGRAM'].includes(selectedPlatform)) {
            toast.error("Quick Boost is only available for Facebook and Instagram.");
            return;
        }

        if (!message && !subject) {
            toast.error('Please enter a message or title');
            return;
        }

        if (!selectedFacebookPageId) {
            toast.error('Please select a Facebook Page');
            return;
        }

        try {
            setSavingBoost(true);

            const response = await fetch(`/api/campaigns/${campaignId}/posts/quick-boost`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject || null,
                    message: message || null,
                    type: selectedPlatform,
                    mediaUrls: mediaUrls,
                    isReel,
                    contentType,
                    thumbnailUrl,
                    facebookPageId: selectedFacebookPageId,
                    facebookPageAccessToken: selectedFacebookPageAccessToken,
                    instagramBusinessId: selectedInstagramBusinessId,
                    metaBoost: boostOptions.enabled ? boostOptions : undefined,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to prepare boost');
            }

            const data = await response.json();
            const post = data.post;
            markAsSubmitted();

            // Use utility to open popup
            const adAccountId = post.metadata?.metaBoost?.adAccountId || localStorage.getItem('last_meta_ad_account_id') || '';
            const pageId = post.metadata?.facebookPageId || selectedFacebookPageId;
            const postId = post.metadata?.facebookPostId || post.metadata?.platformPostId || post.liveLink;

            if (pageId && postId) {
                openNativeBoostPopup(adAccountId, pageId, postId);
                toast.success('Post scheduled and Boost Centre opened!');
                router.push(`/organisation/campaigns/${campaignId}/posts`);
            } else {
                toast.error("Post created but failed to retrieve IDs for boosting. You can boost it from the posts list.");
                router.push(`/organisation/campaigns/${campaignId}/posts`);
            }
        } catch (error) {
            console.error('Error in Quick Boost:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to prepare boost');
        } finally {
            setSavingBoost(false);
        }
    };

    // Handle platform selection toggle
    const togglePlatform = (platform: string) => {
        setSelectedPlatform(prev => prev === platform ? null : platform);
    };

    // Reset other fields when changing YouTube content type
    useEffect(() => {
        if (selectedPlatform === 'YOUTUBE') {
            // Default to public for all types unless user changes it
            setYoutubePrivacy('public');
        }
    }, [youtubeContentType, selectedPlatform]);

    // Fetch templates when platform changes
    useEffect(() => {
        if (selectedPlatform) {
            fetchTemplates(selectedPlatform);
        } else {
            setTemplates([]);
            setSelectedTemplateId('none');
        }
    }, [selectedPlatform]);

    // Fetch templates for selected platform
    const fetchTemplates = async (platform: string) => {
        try {
            setLoadingTemplates(true);
            const response = await fetch(`/api/templates?platform=${platform}&isActive=true`);
            if (!response.ok) {
                setTemplates([]);
                return;
            }
            const data = await response.json();
            setTemplates(data.success ? data.data : []);
        } catch (error) {
            console.error('Error fetching templates:', error);
            setTemplates([]);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // Handle template selection
    // Handle template selection
    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplateId(templateId);

        if (!templateId || templateId === 'none') {
            // Clear the form if "none" is selected
            return;
        }

        const template = templates.find(t => t.id.toString() === templateId);
        if (!template) return;

        // Fill form with template data
        setSubject(template.subject || '');
        setMessage(template.content || '');

        // Prefill media
        if (template.mediaUrls && Array.isArray(template.mediaUrls)) {
            setMediaUrls(template.mediaUrls);
        }

        // Handle metadata settings
        if (template.metadata && typeof template.metadata === 'object') {
            const meta = template.metadata as any;

            // Map YouTube Content Type (VIDEO, SHORT, PLAYLIST)
            if (meta.postType && selectedPlatform === 'YOUTUBE') {
                setYoutubeContentType(meta.postType);
                if (meta.postType === 'SHORT') {
                    setIsReel(true); // Shorts are similar to reels
                }
            }

            // Map YouTube Playlist Title
            if (meta.playlistTitle) {
                setYoutubePlaylistTitle(meta.playlistTitle);
            }

            // Map Facebook/Instagram Content Type
            if (meta.postType && (selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM')) {
                setContentType(meta.postType); // POST or REEL

                setIsReel(meta.postType === 'REEL');
            }

            // Map YouTube Privacy
            if (meta.youtubePrivacy) {
                setYoutubePrivacy(meta.youtubePrivacy);
            }

            // Map YouTube Tags
            if (meta.youtubeTags) {
                setYoutubeTags(meta.youtubeTags);
            }

            // Map Thumbnail
            if (meta.thumbnailUrl) {
                setThumbnailUrl(meta.thumbnailUrl);
            }
        }

        toast.success('Template loaded! You can now edit the content.');
    };

    return (
        <div className="p-6 overflow-hidden  mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    className='cursor-pointer'
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="size-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">New Post</h1>
                    <p className="text-muted-foreground mt-1">
                        Create a new post for this campaign
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Post Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Post Details</CardTitle>
                            <CardDescription>
                                Create content for your campaign
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Platform Selection */}
                            <div className="space-y-3">
                                <Label>Select Platform *</Label>
                                {loadingPlatforms ? (
                                    <div className="flex items-center gap-2 p-4">
                                        <Loader2 className="size-4 animate-spin" />
                                        <span className="text-sm text-muted-foreground">Loading platforms...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap gap-3">
                                            {['EMAIL', 'SMS', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST'].map((platform) => {
                                                // Check if assigned to organization
                                                const isAssigned = organisationPlatforms.includes(platform);

                                                // Twilio platforms require APPROVED status and NOT being on trial
                                                const isTwilioPlatform = ['SMS', 'WHATSAPP'].includes(platform);
                                                const isAdminLocked = isTwilioPlatform && twilioStatus !== 'APPROVED';
                                                const isTrialLocked = isTwilioPlatform && isTrial;
                                                const isSuspended = isTwilioPlatform && !isAssigned;
                                                const isCreditLocked = isTwilioPlatform && (
                                                    (platform === 'SMS' && (wallet?.smsCreditsAvailable || 0) <= 0) ||
                                                    (platform === 'WHATSAPP' && (wallet?.whatsappCreditsAvailable || 0) <= 0)
                                                );
                                                const isLocked = isAdminLocked || isTrialLocked || isSuspended || isCreditLocked;

                                                // Check if user has connected account
                                                let isConnected = false;
                                                if (['EMAIL', 'SMS', 'WHATSAPP'].includes(platform)) {
                                                    isConnected = isAssigned;
                                                } else {
                                                    const status = socialStatus?.[platform.toLowerCase()];
                                                    isConnected = isAssigned && !!status?.connected;
                                                }

                                                const isSelected = selectedPlatform === platform;
                                                const Icon = getPlatformIcon(platform);

                                                // Always show SMS/WhatsApp regardless of assignment so users can see lock status
                                                if (!isAssigned && !isTwilioPlatform) return null;

                                                const platformButton = (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (isLocked) {
                                                                if (isTrialLocked) {
                                                                    toast('Not available for free trials', {
                                                                        description: 'SMS and WhatsApp campaigns are restricted to paid plans. Please upgrade to use these features.',
                                                                        action: {
                                                                            label: 'Upgrade Now',
                                                                            onClick: () => router.push('/organisation/billing')
                                                                        }
                                                                    });
                                                                } else if (isSuspended) {
                                                                    toast('Platform Suspended', {
                                                                        description: `Your ${platform} access has been suspended. Please contact us or check billing.`,
                                                                        action: {
                                                                            label: 'Contact Support',
                                                                            onClick: () => window.location.href="mailto:surya@mandavconsultancy.com"
                                                                        }
                                                                    });
                                                                } else if (isAdminLocked) {
                                                                    toast('Admin Approval Required', {
                                                                        description: 'SMS and WhatsApp are available via Twilio after admin approval and credit purchase.',
                                                                        action: {
                                                                            label: 'Go to Billing',
                                                                            onClick: () => router.push('/organisation/billing')
                                                                        }
                                                                    });
                                                                } else if (isCreditLocked) {
                                                                    toast('No Credits Available', {
                                                                        description: `You have 0 ${platform} credits. Please purchase a pack to send ${platform} messages.`,
                                                                        action: {
                                                                            label: 'Add Credits',
                                                                            onClick: () => router.push('/organisation/billing')
                                                                        }
                                                                    });
                                                                }
                                                                return;
                                                            }
                                                            if (!isConnected) {
                                                                toast('Platform not connected', {
                                                                    description: 'You need to connect this platform in your account settings.',
                                                                    action: {
                                                                        label: 'Connect',
                                                                        onClick: () => router.push('/organisation/settings')
                                                                    }
                                                                });
                                                                return;
                                                            }
                                                            togglePlatform(platform);
                                                        }}
                                                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all min-w-[100px] ${isLocked
                                                            ? 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-50 cursor-not-allowed'
                                                            : isSelected
                                                                ? 'border-primary bg-primary/10 shadow-sm'
                                                                : 'border-border hover:border-primary/50 hover:bg-muted/50 cursor-pointer'
                                                            } ${!isConnected && !isLocked ? 'opacity-50 grayscale' : ''}`}
                                                    >
                                                        <Icon className={`size-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                                        <span className={`text-xs font-medium ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                                            {platform}
                                                        </span>
                                                        {isLocked && (
                                                            <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 leading-tight text-center">
                                                                {isTrialLocked ? "Trial Restricted" : isSuspended ? "Suspended" : isAdminLocked ? "Admin Approval" : "No Credits"}
                                                            </span>
                                                        )}
                                                    </button>
                                                );

                                                return (
                                                    <div key={platform} className="relative group">
                                                        {isLocked ? (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="inline-block">
                                                                            {platformButton}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-popover text-popover-foreground border shadow-md p-3 w-64 space-y-2">
                                                                        <p className="text-sm font-semibold">{isTrialLocked ? "Trial Restriction Active" : isSuspended ? "Addon Suspended" : isAdminLocked ? "Admin Approval Required" : "No Credits Available"}</p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {isTrialLocked
                                                                                ? "SMS and WhatsApp campaigns are not available during the free trial period. Please upgrade to a paid plan to unlock these channels."
                                                                                : isSuspended
                                                                                    ? `Your access to ${platform} has been temporarily suspended by the administrator.`
                                                                                : isAdminLocked
                                                                                    ? "SMS and WhatsApp messaging requires admin approval and credit purchase."
                                                                                    : `You have 0 ${platform} credits. Please purchase a pack to use this channel.`}
                                                                        </p>
                                                                        <Button
                                                                            size="sm"
                                                                            className="w-full text-xs h-8"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                if (isSuspended) {
                                                                                    window.location.href="mailto:surya@mandavconsultancy.com";
                                                                                } else {
                                                                                    router.push('/organisation/billing');
                                                                                }
                                                                            }}
                                                                        >
                                                                            {isTrialLocked ? "Upgrade Plan" : isSuspended ? "Contact Support" : isAdminLocked ? "Purchase Pack / Request Access" : "Add Credits"}
                                                                        </Button>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        ) : (
                                                            platformButton
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Select a platform to configure your post
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Other Platforms Form */}
                            {selectedPlatform && selectedPlatform !== 'EMAIL' && (
                                <div className="space-y-4">
                                    {/* Template Selection */}
                                    {!loadingTemplates && templates.length > 0 && (
                                        <div className="space-y-2 p-4 bg-muted/20 rounded-lg border border-dashed">
                                            <Label htmlFor="template" className="text-xs font-semibold uppercase text-muted-foreground">Quick Start with Template</Label>
                                            <Select value={selectedTemplateId || "none"} onValueChange={handleTemplateSelect}>
                                                <SelectTrigger id="template" className="bg-background border border-2 border-gray-200">
                                                    <SelectValue placeholder="Select a template..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None - Start from scratch</SelectItem>
                                                    {templates.map((template) => (
                                                        <SelectItem key={template.id} value={template.id.toString()}>
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="size-4 text-primary" />
                                                                <span>{template.name}</span>
                                                                {template.category && (
                                                                    <span className="text-xs text-muted-foreground ml-2 px-1.5 py-0.5 rounded-full bg-muted">
                                                                        {template.category}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-muted-foreground">
                                                Selecting a template will populate the fields below. You can still edit them.
                                            </p>
                                        </div>
                                    )}
                                    {/* Title Field for Social Media & WhatsApp */}
                                    {selectedPlatform !== 'SMS' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="subject">Title *</Label>
                                            <Input
                                                id="subject"
                                                placeholder="Enter post title"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                required={selectedPlatform !== 'SMS' && selectedPlatform !== 'EMAIL'}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                This will be displayed as the bold header of your post
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="message">Message *</Label>
                                        <div className="relative">
                                            <Textarea
                                                id="message"
                                                placeholder="Enter your message"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows={6}
                                                required={true}
                                                maxLength={160}
                                                className="pr-12 border border-2 border-gray-300 rounded-2xl"
                                            />
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="absolute bottom-2 right-2 size-8 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 shadow-lg"
                                                onClick={() => setShowAIAssistant(true)}
                                                title="Generate content with AI"
                                            >
                                                <Sparkles className="size-4" />
                                            </Button>
                                        </div>
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>
                                                {message.length} characters
                                            </span>
                                            <span>
                                                {selectedPlatform === 'SMS' && `Limit: 160 | `}
                                                {selectedPlatform === 'TWITTER' && `Limit: 280 | `}
                                                {selectedPlatform === 'INSTAGRAM' && `Limit: 2200`}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedPlatform === 'SMS' && 'SMS messages are limited to 160 characters. '}
                                            {selectedPlatform === 'WHATSAPP' && 'WhatsApp messages support rich formatting. '}
                                            {selectedPlatform === 'FACEBOOK' && 'Create engaging content for your Facebook audience. '}
                                            {selectedPlatform === 'INSTAGRAM' && 'Share visual content with your Instagram followers. '}
                                            {selectedPlatform === 'LINKEDIN' && 'Professional content for your LinkedIn network. '}
                                            {selectedPlatform === 'YOUTUBE' && 'Video description or community post. '}
                                        </p>
                                    </div>

                                </div>
                            )}

                            {/* Email Form */}
                            {selectedPlatform === 'EMAIL' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="senderEmail">Sender Email *</Label>
                                        <Input
                                            id="senderEmail"
                                            type="email"
                                            placeholder="sender@example.com"
                                            value={senderEmail}
                                            onChange={(e) => setSenderEmail(e.target.value)}
                                            required={selectedPlatform === 'EMAIL'}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="subject">Subject *</Label>
                                        <Input
                                            id="subject"
                                            placeholder="Enter email subject"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            required={selectedPlatform === 'EMAIL'}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message">Message *</Label>
                                        <div className="relative ">
                                            <Textarea
                                                id="message"
                                                placeholder="Enter your email message (HTML supported)"
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                rows={10}
                                                required={selectedPlatform === 'EMAIL'}
                                                className="pr-12 border border-2 border-gray-300 rounded-2xl whitespace-pre-wrap"
                                            />
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="absolute bottom-2 right-2 size-8 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 shadow-lg"
                                                onClick={() => setShowAIAssistant(true)}
                                                title="Generate content with AI"
                                            >
                                                <Sparkles className="size-4" />
                                            </Button>

                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <p className="text-xs text-muted-foreground w-full">
                                                Insert variables:
                                            </p>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('name')}
                                            >
                                                {'{{name}}'}
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('email')}
                                            >
                                                {'{{email}}'}
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('phone')}
                                            >
                                                {'{{phone}}'}
                                            </Button>
                                            <Button
                                                className='cursor-pointer'
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => insertVariable('company')}
                                            >
                                                {'{{company}}'}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Variables will be replaced with actual contact data when sent
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="scheduledPostTime">Schedule Email (Optional)</Label>
                                        <Input
                                            id="scheduledPostTime"
                                            type="datetime-local"
                                            value={scheduledPostTime}
                                            onChange={(e) => setScheduledPostTime(e.target.value)}
                                            min={(() => {
                                                const now = new Date();
                                                const start = campaign?.startDate ? new Date(campaign.startDate) : now;
                                                const minDate = start > now ? start : now;
                                                return formatDateTimeLocal(minDate);
                                            })()}
                                            max={campaign?.endDate ? formatDateTimeLocal(new Date(campaign.endDate)) : undefined}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Leave empty to send immediately
                                        </p>
                                    </div>




                                    {/* Email Attachments */}
                                    <div className="space-y-2 pt-4 border-t">
                                        <div className="flex items-center justify-between mb-1">
                                            <Label className="text-xs">
                                                Attachments (Docs, Images, etc.)
                                            </Label>
                                            <span className="text-[10px] text-muted-foreground">{mediaUrls.length}/10</span>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {mediaUrls.map((url, index) => (
                                                <div key={index} className="relative rounded-md overflow-hidden border bg-muted/50 size-20 group">
                                                    {url.match(/\.(mp4|mov|webm)$/i) ? (
                                                        <div className="flex items-center justify-center h-full">
                                                            <Video className="size-6 text-muted-foreground" />
                                                        </div>
                                                    ) : url.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i) ? (
                                                        <div className="flex items-center justify-center h-full">
                                                            <FileText className="size-6 text-muted-foreground" />
                                                        </div>
                                                    ) : (
                                                        <Image
                                                            src={getPreviewUrl(url)}
                                                            alt={`Attachment ${index + 1}`}
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMedia(index)}
                                                        className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            ))}

                                            {mediaUrls.length < 10 && (
                                                <label htmlFor="email-attachment-upload" className="flex flex-col items-center justify-center size-20 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                                    <div className="flex flex-col items-center">
                                                        <Upload className="size-4 text-muted-foreground mb-0.5" />
                                                        <span className="text-[10px] text-muted-foreground">Add</span>
                                                    </div>
                                                    <input
                                                        id="email-attachment-upload"
                                                        type="file"
                                                        className="hidden"
                                                        accept="*/*"
                                                        onChange={handleFileUpload}
                                                        disabled={uploadingMedia}
                                                        multiple
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Other Platforms Form */}
                            {selectedPlatform && selectedPlatform !== 'EMAIL' && (
                                <div className="space-y-4">


                                    {/* Media Upload */}
                                    {/* Media Upload */}
                                    {['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'PINTEREST', 'EMAIL', 'WHATSAPP'].includes(selectedPlatform) && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <Label className="text-xs">
                                                    {selectedPlatform === 'YOUTUBE' ? 'Video *' :
                                                        selectedPlatform === 'EMAIL' ? 'Attachments (Docs, Images, etc.)' :
                                                            selectedPlatform === 'WHATSAPP' ? 'Media (Images, Video, PDF)' :
                                                                'Media (Photo/Video)'}
                                                    {(selectedPlatform === 'INSTAGRAM' || selectedPlatform === 'PINTEREST') && ' *'}
                                                </Label>
                                                <span className="text-[10px] text-muted-foreground">{mediaUrls.length}/10</span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {mediaUrls.map((url, index) => (
                                                    <div key={index} className="relative rounded-md overflow-hidden border bg-muted/50 size-20 group">
                                                        {url.match(/\.(mp4|mov|webm)$/i) ? (
                                                            <div className="flex items-center justify-center h-full">
                                                                <Video className="size-6 text-muted-foreground" />
                                                            </div>
                                                        ) : url.match(/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i) ? (
                                                            <div className="flex items-center justify-center h-full">
                                                                <FileText className="size-6 text-muted-foreground" />
                                                            </div>
                                                        ) : (
                                                            <Image
                                                                src={getPreviewUrl(url)}
                                                                alt={`Media ${index + 1}`}
                                                                fill
                                                                className="object-cover"
                                                                unoptimized
                                                            />
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeMedia(index)}
                                                            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        >
                                                            <X className="size-3" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {mediaUrls.length < 10 && (
                                                    <div className="flex gap-2">
                                                        <label htmlFor="media-upload" className="flex flex-col items-center justify-center size-20 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                                                            {uploadingMedia ? (
                                                                <div className="flex flex-col items-center">
                                                                    <Loader2 className="size-4 text-muted-foreground animate-spin mb-0.5" />
                                                                    <span className="text-[10px] text-muted-foreground text-center line-clamp-2 px-1">
                                                                        {totalUploadCount > 1 
                                                                            ? `File ${currentUploadIndex + 1}/${totalUploadCount}\n(${uploadProgress}%)` 
                                                                            : `${uploadProgress}%`}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col items-center">
                                                                    <Upload className="size-4 text-muted-foreground mb-0.5" />
                                                                    <span className="text-[10px] text-muted-foreground">Add</span>
                                                                </div>
                                                            )}
                                                            <input
                                                                id="media-upload"
                                                                type="file"
                                                                className="hidden"
                                                                accept={
                                                                    selectedPlatform === 'YOUTUBE' ? 'video/*' :
                                                                        selectedPlatform === 'EMAIL' ? '*/*' :
                                                                            selectedPlatform === 'WHATSAPP' ? 'image/*,video/*,application/pdf' :
                                                                                'image/*,video/*'
                                                                }
                                                                onChange={handleFileUpload}
                                                                disabled={uploadingMedia}
                                                                multiple
                                                            />
                                                        </label>

                                                        {/* AI Image Generation Shortcut */}
                                                        {selectedPlatform !== 'SMS' && selectedPlatform !== 'EMAIL' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setAiAssistantTab('image');
                                                                    setShowAIAssistant(true);
                                                                }}
                                                                className="flex flex-col items-center justify-center size-20 border-2 border-dashed border-primary/30 rounded-md cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-colors group"
                                                            >
                                                                <div className="flex flex-col items-center">
                                                                    <Wand2 className="size-4 text-primary mb-0.5 group-hover:scale-110 transition-transform" />
                                                                    <span className="text-[10px] text-primary font-medium">AI Image</span>
                                                                </div>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Facebook & Instagram Page Selection */}
                                    {(selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && (
                                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <Label className="text-sm font-medium flex items-center gap-2">
                                                <Facebook className="size-4 text-blue-600" />
                                                Select Facebook Page
                                            </Label>
                                            {loadingFacebookPages ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="size-3 animate-spin" />
                                                    Loading pages...
                                                </div>
                                            ) : facebookPages.length === 0 ? (
                                                <p className="text-xs text-red-500">No Facebook Pages found. Make sure you&apos;ve connected your account and granted permissions.</p>
                                            ) : (
                                                <Select
                                                    value={selectedFacebookPageId}
                                                    onValueChange={(val) => {
                                                        setSelectedFacebookPageId(val);
                                                        const page = facebookPages.find(p => p.id === val);
                                                        if (page) {
                                                            setSelectedFacebookPageAccessToken(page.access_token);
                                                            if (page.instagram_business_account?.id) {
                                                                setSelectedInstagramBusinessId(page.instagram_business_account.id);
                                                            } else {
                                                                setSelectedInstagramBusinessId('');
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className=''>
                                                        <SelectValue placeholder="Select a page to post to" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {facebookPages.map((page) => (
                                                            <SelectItem key={page.id} value={page.id}>
                                                                {page.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            <p className="text-[10px] text-muted-foreground">
                                                Posts will be published to the selected page.
                                            </p>
                                        </div>
                                    )}

                                    {/* Lead Form Selection */}
                                    {(selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && selectedFacebookPageId && (
                                        <div className="space-y-3 rounded-lg border bg-blue-50/30 p-4 border-blue-100">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-medium flex items-center gap-2">
                                                    <FileText className="size-4 text-blue-600" />
                                                    Attach Lead Form (Optional)
                                                </Label>
                                            </div>

                                            {loadingLeadForms ? (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="size-3 animate-spin" />
                                                    Loading forms...
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <Select
                                                            value={selectedLeadFormId}
                                                            onValueChange={setSelectedLeadFormId}
                                                        >
                                                            <SelectTrigger className="bg-white">
                                                                <SelectValue placeholder="Select a lead form" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">No lead form</SelectItem>
                                                                {leadForms.map((form) => (
                                                                    <SelectItem key={form.id} value={form.id}>
                                                                        {form.name} ({form.status})
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-muted-foreground">
                                                Lead forms allow you to collect contact information directly from the post.
                                                Manage your lead forms in <strong>Leads Management</strong>.
                                            </p>
                                        </div>
                                    )}

                                    {/* Facebook & Instagram Content Type Selection */}
                                    {(selectedPlatform === 'FACEBOOK' || selectedPlatform === 'INSTAGRAM') && (
                                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <Label className="text-sm font-medium">Content Type</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {['POST', 'REEL'].map((type) => (
                                                    <button
                                                        key={type}
                                                        type="button"
                                                        onClick={() => {
                                                            setContentType(type);
                                                            setIsReel(type === 'REEL');
                                                        }}
                                                        className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${contentType === type
                                                            ? 'border-primary bg-primary/10 text-primary cursor-pointer'
                                                            : 'border-border bg-background hover:bg-muted cursor-pointer'
                                                            }`}
                                                    >
                                                        {type === 'POST' ? 'Standard Post' : 'Reel / Short Video'}
                                                    </button>
                                                ))}
                                            </div>

                                            {contentType === 'REEL' && (
                                                <div className="space-y-2 pt-2">
                                                    <Label className="text-sm font-medium">Cover Image (Optional)</Label>
                                                    <div className="flex items-center gap-3">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => document.getElementById('reel-cover-upload')?.click()}
                                                            disabled={uploadingMedia}
                                                            className="gap-2 w-full cursor-pointer"
                                                        >
                                                            <ImageIcon className="size-4" />
                                                            {uploadingMedia ? `Uploading... ${uploadProgress}%` : "Upload Cover"}
                                                        </Button>
                                                        <input
                                                            id="reel-cover-upload"
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleThumbnailUpload}
                                                            className="hidden"
                                                        />
                                                    </div>
                                                    {thumbnailUrl && (
                                                        <div className="relative aspect-[9/16] w-20 overflow-hidden rounded border bg-muted">
                                                            <Image src={getPreviewUrl(thumbnailUrl)} alt="Cover" fill className="object-cover" unoptimized />
                                                            <button
                                                                type="button"
                                                                onClick={() => setThumbnailUrl(null)}
                                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 cursor-pointer"
                                                            >
                                                                <X className="size-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-muted-foreground">
                                                        Recommended for vertical videos (9:16) under 90 seconds.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* YouTube Specific Fields */}
                                    {selectedPlatform === 'YOUTUBE' && (
                                        <div className="space-y-4 pt-4 border-t">
                                            <h3 className="font-medium flex items-center gap-2">
                                                <Youtube className="size-4 text-red-600" />
                                                YouTube Settings
                                            </h3>

                                            {/* Content Type Selection */}
                                            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                                <Label className="text-sm font-medium">Content Type</Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['VIDEO', 'SHORT', 'PLAYLIST'].map((type) => (
                                                        <button
                                                            key={type}
                                                            type="button"
                                                            onClick={() => setYoutubeContentType(type)}
                                                            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${youtubeContentType === type
                                                                ? 'border-primary bg-primary/10 text-primary cursor-pointer'
                                                                : 'border-border bg-background hover:bg-muted cursor-pointer'
                                                                }`}
                                                        >
                                                            {type === 'VIDEO' ? 'Standard Video' : type === 'SHORT' ? 'YouTube Short' : 'Playlist'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {/* Playlist Options */}
                                                {youtubeContentType === 'PLAYLIST' && (
                                                    <div className="space-y-3 pt-2">
                                                        {loadingYoutubePlaylists ? (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Loader2 className="size-3 animate-spin" />
                                                                Loading playlists...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="border rounded-md">
                                                                    <Select
                                                                        value={isCreatingPlaylist ? 'create_new' : (selectedYoutubePlaylistId || 'select')}
                                                                        onValueChange={(val) => {
                                                                            if (val === 'create_new') {
                                                                                setIsCreatingPlaylist(true);
                                                                                setSelectedYoutubePlaylistId('');
                                                                                return;
                                                                            }
                                                                            if (val === 'select') {
                                                                                setSelectedYoutubePlaylistId('');
                                                                                return;
                                                                            }
                                                                            setIsCreatingPlaylist(false);
                                                                            setSelectedYoutubePlaylistId(val);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger id="youtubePlaylist">
                                                                            <SelectValue placeholder="Select a playlist" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="select" disabled>Select a playlist...</SelectItem>
                                                                            <SelectItem value="create_new" className="text-primary font-medium cursor-pointer bg-primary/5 focus:bg-primary/10">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Plus className="size-4" />
                                                                                    Create New Playlist
                                                                                </div>
                                                                            </SelectItem>
                                                                            {youtubePlaylists.map(playlist => (
                                                                                <SelectItem key={playlist.id} value={playlist.id}>
                                                                                    {playlist.title}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </>
                                                        )}

                                                        {isCreatingPlaylist && (
                                                            <div className="space-y-2 pt-2 border-l-2 border-primary pl-4 ml-1">
                                                                <Label htmlFor="playlistTitle">New Playlist Title</Label>
                                                                <Input
                                                                    id="playlistTitle"
                                                                    placeholder="Enter playlist title"
                                                                    value={youtubePlaylistTitle}
                                                                    onChange={(e) => setYoutubePlaylistTitle(e.target.value)}
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                    A new playlist will be created with this title
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="youtubeTags">Tags (comma separated)</Label>
                                                    <Input
                                                        id="youtubeTags"
                                                        placeholder="tutorial, tech, campzeo"
                                                        value={youtubeTags}
                                                        onChange={(e) => setYoutubeTags(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="youtubePrivacy">Privacy Status</Label>
                                                    <div className=" rounded-md">
                                                        <Select value={youtubePrivacy} onValueChange={setYoutubePrivacy}>
                                                            <SelectTrigger id="youtubePrivacy">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="public">Public</SelectItem>
                                                                <SelectItem value="private">Private</SelectItem>
                                                                <SelectItem value="unlisted">Unlisted</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2 pt-2">
                                                <Label className="text-sm font-medium">Custom Thumbnail</Label>
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => document.getElementById('yt-thumbnail-upload')?.click()}
                                                        disabled={uploadingMedia}
                                                        className="gap-2 cursor-pointer"
                                                    >
                                                        <ImageIcon className="size-4" />
                                                        {uploadingMedia ? `Uploading... ${uploadProgress}%` : "Upload Thumbnail"}
                                                    </Button>
                                                    <input
                                                        id="yt-thumbnail-upload"
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleThumbnailUpload}
                                                        className="hidden"
                                                    />
                                                    {thumbnailUrl && (
                                                        <div className="relative aspect-video w-32 overflow-hidden rounded border bg-muted group cursor-pointer">
                                                            <Image src={getPreviewUrl(thumbnailUrl)} alt="Thumbnail" fill className="object-cover" unoptimized />
                                                            <button
                                                                type="button"
                                                                onClick={() => setThumbnailUrl(null)}
                                                                className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X className="size-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pinterest Specific Fields */}
                                    {selectedPlatform === 'PINTEREST' && (
                                        <div className="space-y-4 pt-4 border-t">
                                            <h3 className="font-medium flex items-center gap-2">
                                                <div className="p-1 bg-red-600 rounded-full">
                                                    <span className="text-white text-[10px] font-bold">P</span>
                                                </div>
                                                Pinterest Settings
                                            </h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-2 ">
                                                    <Label htmlFor="pinterestBoard">Select Board</Label>
                                                    {loadingPinterestBoards ? (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Loader2 className="size-3 animate-spin" />
                                                            Loading boards...
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className=" rounded-md">
                                                                <Select
                                                                    value={pinterestBoardId}
                                                                    onValueChange={(val) => {
                                                                        if (val === 'create_new') {
                                                                            setIsCreatingBoard(true);
                                                                            return;
                                                                        }
                                                                        setPinterestBoardId(val);

                                                                    }}
                                                                >
                                                                    <SelectTrigger id="pinterestBoard">
                                                                        <SelectValue placeholder="Select a board" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="create_new" className="text-primary font-medium cursor-pointer bg-primary/5 focus:bg-primary/10">
                                                                            <div className="flex items-center gap-2">
                                                                                <Plus className="size-4" />
                                                                                Create New Board
                                                                            </div>
                                                                        </SelectItem>
                                                                        {pinterestBoards.map(board => (
                                                                            <SelectItem key={board.id} value={board.id}>
                                                                                {board.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <Dialog open={isCreatingBoard} onOpenChange={setIsCreatingBoard}>
                                                                <DialogContent>
                                                                    <DialogHeader>
                                                                        <DialogTitle>Create New Pinterest Board</DialogTitle>
                                                                        <DialogDescription>
                                                                            Create a new board to organize your pins.
                                                                        </DialogDescription>
                                                                    </DialogHeader>
                                                                    <div className="space-y-4 py-4">
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="boardName">Board Name</Label>
                                                                            <Input
                                                                                id="boardName"
                                                                                value={newBoardName}
                                                                                onChange={(e) => setNewBoardName(e.target.value)}
                                                                                placeholder="e.g., Summer Inspiration"
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="boardDesc">Description (Optional)</Label>
                                                                            <Textarea
                                                                                className='border border-primary/20 rounded-md resize-none'
                                                                                id="boardDesc"
                                                                                value={newBoardDescription}
                                                                                onChange={(e) => setNewBoardDescription(e.target.value)}
                                                                                placeholder="What's this board about?"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-end gap-3">
                                                                        <Button className='cursor-pointer' variant="outline" onClick={() => setIsCreatingBoard(false)}>Cancel</Button>
                                                                        <Button className='cursor-pointer' onClick={handleCreateBoard} disabled={creatingBoard || !newBoardName.trim()}>
                                                                            {creatingBoard && <Loader2 className="size-4 mr-2 animate-spin" />}
                                                                            Create Board
                                                                        </Button>
                                                                    </div>
                                                                </DialogContent>
                                                            </Dialog>
                                                        </>
                                                    )}
                                                    <div className="space-y-2">
                                                        <Label htmlFor="pinterestLink">Destination Link (Optional)</Label>
                                                        <Input
                                                            id="pinterestLink"
                                                            placeholder="https://example.com"
                                                            value={pinterestLink}
                                                            onChange={(e) => setPinterestLink(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* LinkedIn Organization Selection */}
                                    {selectedPlatform === 'LINKEDIN' && (
                                        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                                            <Label className="text-sm font-medium flex items-center gap-2">
                                                <Linkedin className="size-4 text-blue-700" />
                                                Post As
                                            </Label>
                                            <Select
                                                value={selectedLinkedInUrn}
                                                onValueChange={setSelectedLinkedInUrn}
                                            >
                                                <SelectTrigger className=''>
                                                    <SelectValue placeholder="Select author" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={socialStatus?.linkedin?.urn || 'personal'}>
                                                        Personal Profile ({user?.fullName || 'You'})
                                                    </SelectItem>
                                                    {socialStatus?.linkedin?.organizations?.map((org: any) => (
                                                        <SelectItem key={org.id} value={org.id}>
                                                            {org.name} (Organization)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] text-muted-foreground">
                                                Select whether to post to your personal profile or a managed company page.
                                            </p>
                                        </div>
                                    )}

                                    {/* Meta Boost Section */}
                                    <MetaBoostSection
                                        platform={selectedPlatform || ''}
                                        options={boostOptions}
                                        onChange={setBoostOptions}
                                        fbPageId={selectedFacebookPageId}
                                        facebookAppId={process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}
                                    />

                                    {/* Schedule Field */}
                                    {selectedPlatform && (
                                        <div className="space-y-2">
                                            <Label htmlFor="scheduledPostTime">Schedule Post (Optional)</Label>
                                            <Input
                                                id="scheduledPostTime"
                                                type="datetime-local"
                                                value={scheduledPostTime}
                                                onChange={(e) => setScheduledPostTime(e.target.value)}
                                                min={(() => {
                                                    const now = new Date();
                                                    const start = campaign?.startDate ? new Date(campaign.startDate) : now;
                                                    const minDate = start > now ? start : now;
                                                    return formatDateTimeLocal(minDate);
                                                })()}
                                                max={campaign?.endDate ? formatDateTimeLocal(new Date(campaign.endDate)) : undefined}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Leave empty to send immediately
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* WYSIWYG Live Preview */}
                    {selectedPlatform && (
                        <WYSIWYGPreview
                            platform={selectedPlatform}
                            subject={subject}
                            message={message}
                            mediaUrls={mediaUrls}
                            thumbnailUrl={thumbnailUrl}
                            isReel={isReel || youtubeContentType === 'SHORT'}
                            onSubjectChange={setSubject}
                            onMessageChange={setMessage}
                            user={{
                                name: user?.fullName || user?.firstName || 'Your Brand',
                                image: user?.imageUrl
                            }}
                        />
                    )}

                    <div className="flex  justify-end gap-4">
                        <Button
                            className='cursor-pointer'
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        {/* {['FACEBOOK', 'INSTAGRAM'].includes(selectedPlatform || '') && (
                            <Button
                                className='cursor-pointer text-blue-600 border-blue-200 hover:bg-blue-50'
                                type="button"
                                variant="outline"
                                onClick={handleQuickBoost}
                                disabled={saving || savingBoost || !selectedPlatform || uploadingMedia || !['FACEBOOK', 'INSTAGRAM'].includes(selectedPlatform || '') || balanceLow === true}
                            >
                                {savingBoost ? (
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                ) : (
                                    <Rocket className="size-4 mr-2" />
                                )}
                                Boost Now
                            </Button>
                        )} */}
                        <Button
                            className='cursor-pointer'
                            type="submit" disabled={saving || savingBoost || !selectedPlatform || uploadingMedia}>
                            {saving ? (
                                <>
                                    <Loader2 className="size-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="size-4 mr-2" />
                                    Create Post
                                </>
                            )}
                        </Button>

                        {/* Preview Button - Opens Modal */}
                        {/* <Dialog>
                                        <DialogTrigger asChild>
                                            <Button type="button" variant="secondary" disabled={!selectedPlatform}>
                                                <Eye className="size-4 mr-2" />
                                                Preview
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    {selectedPlatform && (() => {
                                                        const Icon = getPlatformIcon(selectedPlatform);
                                                        return <Icon className="size-5" />;
                                                    })()}
                                                    Post Preview
                                                </DialogTitle>
                                                <DialogDescription>
                                                    See how your post will look on {selectedPlatform?.charAt(0)}{selectedPlatform?.slice(1).toLowerCase()}
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4">
                                                <PostPreview
                                                    platforms={selectedPlatform ? [selectedPlatform] : []}
                                                    subject={subject}
                                                    message={message}
                                                    mediaUrls={mediaUrls}
                                                    thumbnailUrl={thumbnailUrl}
                                                    isReel={isReel}
                                                    user={{
                                                        name: user?.fullName || user?.firstName || 'User',
                                                        image: user?.imageUrl
                                                    }}
                                                />
                                            </div>
                                        </DialogContent>
                                    </Dialog> */}
                    </div>
                </form>

                {/* AI Content Assistant */}
                <AIContentAssistant
                    open={showAIAssistant}
                    onOpenChange={setShowAIAssistant}
                    initialTab={aiAssistantTab}
                    onInsertContent={(content, subject) => {
                        setMessage(content);
                        if (subject) setSubject(subject);
                    }}
                    onInsertImage={(url) => {
                        setMediaUrls(prev => [...prev, url]);
                        toast.success('AI image added to post!');
                    }}
                    context={{
                        platform: selectedPlatform || undefined,
                        existingContent: message,
                    }}
                /> {/* Send/Schedule Popup */}
                <Dialog open={showSocialPublishConfirm} onOpenChange={setShowSocialPublishConfirm}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Rocket className="size-5 text-primary" />
                                Confirm Publication
                            </DialogTitle>
                            <DialogDescription className="py-4">
                                You haven&apos;t scheduled a post date for this {selectedPlatform?.toLowerCase()} post.
                                <br /><br />
                                <strong>Without a scheduled date, this post will be published automatically (immediately) once created.</strong>
                                <br /><br />
                                Do you want to proceed and publish now?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2 sm:gap-4">
                            <Button
                                variant="outline"
                                onClick={() => setShowSocialPublishConfirm(false)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowSocialPublishConfirm(false);
                                    handleSubmit(undefined, true);
                                }}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 size-4" />
                                        Confirm & Publish Now
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showSendNowDialog} onOpenChange={setShowSendNowDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {sendNowStep === 'initial' ? 'Unscheduled Post' : 'Select Contacts'}
                            </DialogTitle>
                            <DialogDescription>
                                {sendNowStep === 'initial'
                                    ? "You haven't scheduled this post. Would you like to send it immediately?"
                                    : "Select the contacts you want to send this post to."}
                            </DialogDescription>
                        </DialogHeader>

                        {sendNowStep === 'initial' ? (
                            <div className="flex flex-col gap-3 py-4">
                                <Button
                                    className='cursor-pointer w-full justify-start'
                                    variant="outline"
                                    onClick={() => {
                                        setShowSendNowDialog(false);
                                        // Focus the schedule input
                                        document.getElementById('scheduledPostTime')?.focus();
                                    }}
                                >
                                    <Sparkles className="mr-2 size-4" /> {/* Just using an icon for visual */}
                                    Schedule for Later
                                </Button>
                                <Button
                                    className='cursor-pointer w-full justify-start'
                                    onClick={() => executeCreateAndSend()} // Send to ALL
                                >
                                    <Send className="mr-2 size-4" />
                                    Send Now to All Contacts ({campaignContacts.length})
                                </Button>
                                <Button
                                    className='cursor-pointer w-full justify-start'
                                    variant="secondary"
                                    onClick={() => {
                                        setSendNowStep('select_contacts');
                                        setSelectedSendContacts([]); // Reset selection
                                    }}
                                >
                                    <Check className="mr-2 size-4" />
                                    Select Contacts to Send
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 py-4 max-h-[60vh]">
                                {/* Search and Filter */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                        <Input
                                            className="pl-9"
                                            placeholder="Search contacts..."
                                            value={contactSearchQuery}
                                            onChange={(e) => setContactSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                                        <span>{filteredContacts.length} contacts found</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-xs text-primary"
                                            onClick={toggleAllContacts}
                                        >
                                            {filteredContacts.length > 0 && filteredContacts.every(c => selectedSendContacts.includes(String(c.id)))
                                                ? 'Deselect All'
                                                : 'Select All Visible'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Contacts List */}
                                <ScrollArea className="flex-1 border rounded-md h-[300px]">
                                    <div className="p-4 space-y-2">
                                        {filteredContacts.length === 0 ? (
                                            <p className="text-center text-sm text-muted-foreground py-8">
                                                No contacts found.
                                            </p>
                                        ) : (
                                            filteredContacts.map((contact: any) => (
                                                <div key={contact.id} className="flex items-start space-x-2 space-y-0 p-2 hover:bg-muted/50 rounded-md transition-colors">
                                                    <Checkbox
                                                        id={`contact-${contact.id}`}
                                                        checked={selectedSendContacts.includes(String(contact.id))}
                                                        onCheckedChange={() => toggleSendContact(String(contact.id))}
                                                    />
                                                    <div className="grid gap-1.5 leading-none">
                                                        <label
                                                            htmlFor={`contact-${contact.id}`}
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {contact.contactName || 'Unnamed Contact'}
                                                        </label>
                                                        <p className="text-xs text-muted-foreground">
                                                            {contact.contactEmail} • {contact.contactMobile}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>

                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button
                                        variant="outline"
                                        className='mx-2'
                                        onClick={() => setSendNowStep('initial')}
                                        disabled={isSending}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={() => executeCreateAndSend(selectedSendContacts)}
                                        disabled={selectedSendContacts.length === 0 || isSending}
                                    >
                                        {isSending ? (
                                            <>
                                                <Loader2 className="mr-2  size-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2  size-4" />
                                                Send to {selectedSendContacts.length} Contacts
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div >
    );
}
