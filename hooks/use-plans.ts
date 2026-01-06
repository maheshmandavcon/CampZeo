"use client";

import { useState, useEffect } from 'react';

export interface Plan {
    id: number;
    name: string;
    description: string | null;
    price: number;
    billingCycle: string;
    features: string[];
    usageLimits: any;
    createdAt: Date;
    updatedAt: Date;
}

interface UsePlansReturn {
    plans: Plan[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function usePlans(): UsePlansReturn {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/plans');
            const data = await response.json();

            if (data.success && Array.isArray(data.plans)) {
                setPlans(data.plans);
            } else {
                throw new Error(data.message || 'Failed to fetch plans');
            }
        } catch (err) {
            console.error('Error fetching plans:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch plans');
            setPlans([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    return {
        plans,
        isLoading,
        error,
        refetch: fetchPlans
    };
}
