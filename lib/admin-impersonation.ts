import { cookies } from "next/headers";

/**
 * Get the impersonated organisation ID from the cookie
 * @returns Promise<number | null> - The ID of the organisation being impersonated, or null
 */
export async function getImpersonatedOrganisationId(): Promise<number | null> {
    const cookieStore = await cookies();
    const adminImpersonation = cookieStore.get("admin_impersonation");

    if (!adminImpersonation?.value) return null;

    // Handle the case where we might have legacy "true" value
    if (adminImpersonation.value === "true") return null;

    const id = parseInt(adminImpersonation.value);
    return isNaN(id) ? null : id;
}

/**
 * Check if the current session is an admin impersonation session
 * @returns Promise<boolean> - true if admin is impersonating, false otherwise
 */
export async function isAdminImpersonating(): Promise<boolean> {
    const orgId = await getImpersonatedOrganisationId();
    return !!orgId;
}

/**
 * Constants for admin impersonation
 */
export const ADMIN_IMPERSONATION_COOKIE = "admin_impersonation";
export const ADMIN_IMPERSONATION_MAX_AGE = 3600; // 1 hour in seconds
