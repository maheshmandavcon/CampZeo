// Plan configuration and pricing

export type PlanType = "FREE_TRIAL" | "PROFESSIONAL" | "ENTERPRISE";

export interface Plan {
    id: PlanType;
    name: string;
    price: number;
    currency: string;
    interval: string;
    features: string[];
    popular?: boolean;
}

export const PLANS: Record<PlanType, Plan> = {
    FREE_TRIAL: {
        id: "FREE_TRIAL",
        name: "Free Trial",
        price: 0,
        currency: "INR",
        interval: "14 days",
        features: [
            "Up to 5 team members",
            "10GB storage",
            "Basic analytics",
            "Email support",
            "14-day trial period",
        ],
    },
    PROFESSIONAL: {
        id: "PROFESSIONAL",
        name: "Professional",
        price: 2999,
        currency: "INR",
        interval: "month",
        features: [
            "Up to 50 team members",
            "100GB storage",
            "Advanced analytics",
            "Priority email support",
            "API access",
            "Custom integrations",
        ],
        popular: true,
    },
    ENTERPRISE: {
        id: "ENTERPRISE",
        name: "Enterprise",
        price: 9999,
        currency: "INR",
        interval: "month",
        features: [
            "Unlimited team members",
            "1TB storage",
            "Advanced analytics & reporting",
            "24/7 phone & email support",
            "Dedicated account manager",
            "Custom integrations",
            "SLA guarantee",
            "Advanced security features",
        ],
    },
};

export function getPlanById(planId: PlanType): Plan {
    return PLANS[planId];
}

export function formatPrice(price: number, currency: string = "INR"): string {
    if (price === 0) return "Free";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
    }).format(price);
}

export function canUpgrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
    const planOrder: PlanType[] = ["FREE_TRIAL", "PROFESSIONAL", "ENTERPRISE"];
    const currentIndex = planOrder.indexOf(currentPlan);
    const targetIndex = planOrder.indexOf(targetPlan);
    return targetIndex > currentIndex;
}

export function canDowngrade(currentPlan: PlanType, targetPlan: PlanType): boolean {
    const planOrder: PlanType[] = ["FREE_TRIAL", "PROFESSIONAL", "ENTERPRISE"];
    const currentIndex = planOrder.indexOf(currentPlan);
    const targetIndex = planOrder.indexOf(targetPlan);
    return targetIndex < currentIndex;
}
