'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import React from 'react';

export default function CampaignPostRedirectPage({
    params
}: {
    params: Promise<{ id: string, postId: string }>
}) {
    const router = useRouter();
    const resolvedParams = React.use(params);
    const campaignId = resolvedParams.id;
    const postId = resolvedParams.postId;

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkPostStatus = async () => {
            try {
                // Fetch post details from the API to check its status
                const response = await fetch(`/api/campaigns/${campaignId}/posts`);
                if (!response.ok) throw new Error('Failed to fetch posts');

                const data = await response.json();
                const post = data.posts?.find((p: any) => p.id === parseInt(postId));

                if (!post) {
                    setError('Post not found');
                    return;
                }

                // Redirect based on whether the post has been sent
                if (post.isPostSent) {
                    router.replace(`/organisation/analytics/posts/${postId}`);
                } else {
                    router.replace(`/organisation/campaigns/${campaignId}/posts/${postId}/edit`);
                }
            } catch (err) {
                console.error('Error checking post status:', err);
                setError('Failed to resolve post location');
            }
        };

        checkPostStatus();
    }, [campaignId, postId, router]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <p className="text-red-500 font-medium">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="text-primary hover:underline"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-slate-500 animate-pulse">Routing to post...</p>
        </div>
    );
}
