'''
import type { AuthenticatedUser } from '@/context/auth-context';

/**
 * 🛡️ The Single Source of Truth for settings access.
 * This function is the central gatekeeper that determines who can access
 * the high-level system settings.
 * 
 * @param user The authenticated user object or just their role string.
 * @returns {boolean} True if the user has administrative privileges, false otherwise.
 */
export const canAccessSettings = (user: AuthenticatedUser | { role?: string | null } | string | null | undefined): boolean => {
    if (!user) {
        return false;
    }

    const role = typeof user === 'string' ? user : user.role;

    if (!role) {
        return false;
    }

    // These roles are considered administrators and can change critical system settings.
    const permittedRoles = ['Admin', 'مدير عام', 'General Manager', 'Developer'];

    return permittedRoles.includes(role);
};
'''