import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkAdAccountStatus } from '@/lib/meta-ads';

/**
 * GET /api/meta/adaccount/balance
 *
 * Query params:
 * - adAccountId: string (required) e.g. "act_1234567890"
 *
 * Response:
 * {
 *   available_balance: number; // in major units (e.g. 12.34)
 *   currency: string;
 *   has_payment_method: boolean;
 *   account_status: number;
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const adAccountId = searchParams.get('adAccountId');

        if (!adAccountId) {
            return NextResponse.json({ error: 'Missing adAccountId' }, { status: 400 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { clerkId: user.id },
            select: { facebookAccessToken: true }
        });

        if (!dbUser?.facebookAccessToken) {
            return NextResponse.json({ error: 'Facebook not connected' }, { status: 400 });
        }

        let adAccount;
        try {
            adAccount = await checkAdAccountStatus(adAccountId, dbUser.facebookAccessToken);
        } catch (error: any) {
            // Bubble up Meta error details in a safe way
            const message = typeof error?.message === 'string' ? error.message : 'Failed to fetch ad account status';
            return NextResponse.json(
                { error: 'Failed to fetch ad account status', details: message },
                { status: 502 }
            );
        }

        const rawBalanceCents = parseFloat(adAccount.balance || '0'); // Meta returns minor units
        const amountSpentCents = parseFloat(adAccount.amount_spent || '0');
        const spendCapCents = adAccount.spend_cap ? parseFloat(adAccount.spend_cap) : null;

        // Derive available balance:
        // - If spend_cap is set, use remaining cap
        // - Otherwise, fall back to inverse of "balance" (which is usually amount owed in postpaid setups)
        let availableBalanceCents = 0;
        if (spendCapCents !== null && !Number.isNaN(spendCapCents) && spendCapCents > 0) {
            availableBalanceCents = Math.max(spendCapCents - amountSpentCents, 0);
        } else {
            availableBalanceCents = Math.max(-rawBalanceCents, 0);
        }

        // Heuristic for payment method: if we can see either a spend cap, non-zero spend or non-zero balance,
        // treat it as having a payment method configured.
        const hasPaymentMethod =
            (spendCapCents !== null && spendCapCents > 0) ||
            amountSpentCents > 0 ||
            rawBalanceCents !== 0;

        return NextResponse.json({
            available_balance: +(availableBalanceCents / 100).toFixed(2),
            currency: adAccount.currency,
            has_payment_method: hasPaymentMethod,
            account_status: adAccount.account_status
        });
    } catch (error) {
        console.error('[Meta AdAccount Balance] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch ad account balance' }, { status: 500 });
    }
}

