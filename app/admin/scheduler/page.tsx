'use client';

import { AdminSchedulerView } from '@/components/admin/admin-scheduler-view';

export default function SchedulerTestPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="flex">
                <main className="flex-1 p-6">
                    <div className="max-w-4xl mx-auto">
                        <AdminSchedulerView />
                    </div>
                </main>
            </div>
        </div>
    );
}
