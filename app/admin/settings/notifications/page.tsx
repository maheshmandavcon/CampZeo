"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SecretInput } from "@/components/ui/secret-input";

export default function NotificationSettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        SMTP_HOST: "",
        SMTP_PORT: "587",
        SMTP_USER: "",
        SMTP_PASS: "",
        SMTP_FROM: "",
        ADMIN_EMAIL_RECIPIENT: "",
        SMTP_SECURE: "false"
    });

    // Fetch configs
    useEffect(() => {
        const fetchConfigs = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/admin/platform-config');
                const data = await res.json();

                if (data.isSuccess && Array.isArray(data.data)) {
                    const configs: any[] = data.data;
                    const getValue = (key: string) => configs.find(c => c.key === key)?.value || "";

                    setFormData({
                        SMTP_HOST: getValue('SMTP_HOST'),
                        SMTP_PORT: getValue('SMTP_PORT') || "587",
                        SMTP_USER: getValue('SMTP_USER'),
                        SMTP_PASS: getValue('SMTP_PASS'),
                        SMTP_FROM: getValue('SMTP_FROM'),
                        ADMIN_EMAIL_RECIPIENT: getValue('ADMIN_EMAIL_RECIPIENT'),
                        SMTP_SECURE: getValue('SMTP_SECURE') || "false"
                    });
                }
            } catch (error) {
                toast.error("Failed to load settings");
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfigs();
    }, []);

    const handleChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // Save each key individually as the API expects single updates (or we could batch if API supported)
            // The implemented API is single-key update: POST { key, value, platform }

            const promises = Object.entries(formData).map(([key, value]) =>
                fetch('/api/admin/platform-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key,
                        value,
                        platform: 'EMAIL' // Using EMAIL platform type
                    })
                })
            );

            await Promise.all(promises);
            toast.success("Notification settings saved successfully");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        // Optional: Add backend route to trigger test email using current settings
        toast.info("Test email functionality coming soon.");
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link
                        href="/admin"
                        className="text-muted-foreground hover:text-foreground flex items-center mb-2 transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Notification Settings</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure how the system sends alerts and notifications.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" /> SMTP Configuration
                        </CardTitle>
                        <CardDescription>
                            Details for the outbound email server used for system alerts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="space-y-2">
                                <Label>SMTP Host</Label>
                                <Input
                                    placeholder="smtp.example.com"
                                    value={formData.SMTP_HOST}
                                    onChange={(e) => handleChange('SMTP_HOST', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>SMTP Port</Label>
                                <Input
                                    placeholder="587"
                                    value={formData.SMTP_PORT}
                                    onChange={(e) => handleChange('SMTP_PORT', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Username</Label>
                                <Input
                                    placeholder="apikey or user@example.com"
                                    value={formData.SMTP_USER}
                                    onChange={(e) => handleChange('SMTP_USER', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Password</Label>
                                <SecretInput
                                    value={formData.SMTP_PASS}
                                    onChange={(e) => handleChange('SMTP_PASS', e.target.value)}
                                    placeholder="Enter SMTP Password"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>From Name/Email</Label>
                                <Input
                                    placeholder='"System Alert" <alert@campzeo.com>'
                                    value={formData.SMTP_FROM}
                                    onChange={(e) => handleChange('SMTP_FROM', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Example: "Campzeo Alerts" &lt;noreply@campzeo.com&gt;</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Admin Alert Recipient</Label>
                                <Input
                                    placeholder="admin@campzeo.com"
                                    value={formData.ADMIN_EMAIL_RECIPIENT}
                                    onChange={(e) => handleChange('ADMIN_EMAIL_RECIPIENT', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Who receives critical system failure emails.</p>
                            </div>

                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <Switch
                                id="secure-mode"
                                checked={formData.SMTP_SECURE === 'true'}
                                onCheckedChange={(checked) => handleChange('SMTP_SECURE', String(checked))}
                            />
                            <Label htmlFor="secure-mode">Enable Secure Connection (SSL/TLS - usually port 465)</Label>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button type="button" variant="outline" onClick={handleTestEmail}>
                                Send Test Email
                            </Button>
                            <Button type="submit" disabled={isSaving || isLoading}>
                                {isSaving ? (
                                    <>Saving...</>
                                ) : (
                                    <><Save className="mr-2 h-4 w-4" /> Save Configuration</>
                                )}
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
