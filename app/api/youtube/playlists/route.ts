import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs/server';
import { getYouTubePlaylists } from '@/lib/youtube';
import { logError } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { youtubeAccessToken: true }
        });

        if (!dbUser || !dbUser.youtubeAccessToken) {
            return NextResponse.json({ error: 'YouTube not connected' }, { status: 400 });
        }

        const playlists = await getYouTubePlaylists(dbUser.youtubeAccessToken);

        // Map to simpler format
        const formattedPlaylists = playlists.map((p: any) => ({
            id: p.id,
            title: p.snippet.title,
            description: p.snippet.description,
            thumbnail: p.snippet.thumbnails?.default?.url,
            itemCount: p.contentDetails?.itemCount
        }));

        return NextResponse.json({ playlists: formattedPlaylists });
    } catch (error: any) {
        console.error('Error fetching YouTube playlists:', error);
        await logError("Failed to fetch YouTube playlists", { userId: "unknown" }, error);
        return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
    }
}
