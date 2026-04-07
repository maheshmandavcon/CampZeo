"use client";

import { useState, useEffect } from "react";
import { Save, Mail, AlertCircle, CheckCircle, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SecretInput } from "@/components/ui/secret-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function AdminNotificationSettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [newEmail, setNewEmail] = useState("");

    const [formData, setFormData] = useState({
        MAILGUN_API_KEY: "",
        MAILGUN_DOMAIN: "",
        MAILGUN_FROM_EMAIL: "",
        ADMIN_EMAIL_RECIPIENTS: [] as string[],
        ADMIN_LOG_LEVEL: "ERROR"
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

                    const recipientsStr = getValue('ADMIN_EMAIL_RECIPIENTS') || getValue('ADMIN_EMAIL_RECIPIENT');
                    const recipients = recipientsStr ? recipientsStr.split(',').map((e: string) => e.trim()).filter(Boolean) : [];

                    setFormData({
                        MAILGUN_API_KEY: getValue('MAILGUN_API_KEY'),
                        MAILGUN_DOMAIN: getValue('MAILGUN_DOMAIN'),
                        MAILGUN_FROM_EMAIL: getValue('MAILGUN_FROM_EMAIL'),
                        ADMIN_EMAIL_RECIPIENTS: recipients,
                        ADMIN_LOG_LEVEL: getValue('ADMIN_LOG_LEVEL') || "ERROR"
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

    const handleChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleAddEmail = () => {
        if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
            toast.error("Please enter a valid email address");
            return;
        }
        if (formData.ADMIN_EMAIL_RECIPIENTS.includes(newEmail)) {
            toast.error("Email already exists");
            return;
        }
        setFormData(prev => ({
            ...prev,
            ADMIN_EMAIL_RECIPIENTS: [...prev.ADMIN_EMAIL_RECIPIENTS, newEmail]
        }));
        setNewEmail("");
    };

    const handleRemoveEmail = (email: string) => {
        setFormData(prev => ({
            ...prev,
            ADMIN_EMAIL_RECIPIENTS: prev.ADMIN_EMAIL_RECIPIENTS.filter(e => e !== email)
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            const dataToSave = {
                ...formData,
                ADMIN_EMAIL_RECIPIENTS: formData.ADMIN_EMAIL_RECIPIENTS.join(','),
                ADMIN_EMAIL_RECIPIENT: "" // Clear old key if migrating
            };

            const promises = Object.entries(dataToSave).map(([key, value]) => {
                // Skip non-string values or empty keys we don't want to persist in a weird way
                if (key === 'ADMIN_EMAIL_RECIPIENTS' && Array.isArray(value)) return null;

                return fetch('/api/admin/platform-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key,
                        value: String(value), // Ensure string
                        platform: 'EMAIL'
                    })
                });
            }).filter(Boolean);

            await Promise.all(promises);
            toast.success("Mailgun Configuration saved successfully");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        toast.info("Test email functionality coming soon.");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Email Configuration</h2>
                    <p className="text-muted-foreground">Configure how the system sends alerts and notifications via Mailgun.</p>
                </div>
            </div>

            <form onSubmit={handleSave}>
                <Card className="border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" /> Mailgun Configuration
                        </CardTitle>
                        <CardDescription>
                            Details for the Mailgun API used for system emails and alerts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="space-y-2 md:col-span-2">
                                <Label>Mailgun API Key</Label>
                                <SecretInput
                                    placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                    value={formData.MAILGUN_API_KEY}
                                    onChange={(e) => handleChange('MAILGUN_API_KEY', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Found in Mailgun Dashboard → API Keys → Private API Key</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Mailgun Domain</Label>
                                <Input
                                    placeholder="mg.yourdomain.com"
                                    value={formData.MAILGUN_DOMAIN}
                                    onChange={(e) => handleChange('MAILGUN_DOMAIN', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">The verified domain in your Mailgun account.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>From Name/Email</Label>
                                <Input
                                    placeholder='"CampZeo Alerts" &lt;alerts@yourdomain.com&gt;'
                                    value={formData.MAILGUN_FROM_EMAIL}
                                    onChange={(e) => handleChange('MAILGUN_FROM_EMAIL', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Example: "CampZeo Support" &lt;support@mg.campzeo.com&gt;</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex flex-col space-y-2">
                                <Label>Admin Alert Recipients</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add admin email..."
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddEmail();
                                            }
                                        }}
                                    />
                                    <Button type="button" variant="secondary" onClick={handleAddEmail}>
                                        <Plus className="h-4 w-4 mr-2" /> Add
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.ADMIN_EMAIL_RECIPIENTS.map((email) => (
                                        <Badge key={email} variant="secondary" className="px-3 py-1 text-sm flex items-center gap-2">
                                            {email}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveEmail(email)}
                                                className="text-muted-foreground hover:text-destructive focus:outline-none"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {formData.ADMIN_EMAIL_RECIPIENTS.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">No recipients configured.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Log Level</Label>
                                    <Select
                                        value={formData.ADMIN_LOG_LEVEL}
                                        onValueChange={(val) => handleChange('ADMIN_LOG_LEVEL', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INFO">INFO (All events)</SelectItem>
                                            <SelectItem value="WARN">WARN (Warnings & Errors)</SelectItem>
                                            <SelectItem value="ERROR">ERROR (Errors only)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Minimum severity level to trigger an email notification.</p>
                                </div>
                            </div>
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
