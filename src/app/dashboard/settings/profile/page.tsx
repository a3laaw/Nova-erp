'use client';

import { ProfileManager } from '@/components/settings/profile-manager';

export default function ProfilePage() {
    return (
        <div className="p-4 sm:p-8 animate-in fade-in duration-700">
            <ProfileManager />
        </div>
    );
}
