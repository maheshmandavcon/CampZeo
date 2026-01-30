"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, FileDown, Calendar as CalendarIcon, Filter } from "lucide-react";
import { toast } from "sonner";

export default function ExportView() {
    const [platform, setPlatform] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async (format: 'csv' | 'xlsx') => {
        try {
            setIsExporting(true);
            const params = new URLSearchParams({
                format,
                platform,
                startDate,
                endDate
            });

            const response = await fetch(`/api/Organisation/posts/export?${params.toString()}`);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `posts_export_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Posts exported successfully as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export posts');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="w-5 h-5 text-blue-600" />
                        Export Posts
                    </CardTitle>
                    <CardDescription>
                        Filter and download your post data for reporting and analysis.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Platform</label>
                            <Select value={platform} onValueChange={setPlatform}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Platforms</SelectItem>
                                    <SelectItem value="EMAIL">Email</SelectItem>
                                    <SelectItem value="SMS">SMS</SelectItem>
                                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                    <SelectItem value="FACEBOOK">Facebook</SelectItem>
                                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                                    <SelectItem value="LINKEDIN">LinkedIn</SelectItem>
                                    <SelectItem value="YOUTUBE">YouTube</SelectItem>
                                    <SelectItem value="PINTEREST">Pinterest</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Start Date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">End Date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4 border-t">
                        <Button
                            variant="default"
                            className="gap-2"
                            disabled={isExporting}
                            onClick={() => handleExport('xlsx')}
                        >
                            <FileDown className="w-4 h-4" />
                            Download Excel (.xlsx)
                        </Button>
                        <Button
                            variant="outline"
                            className="gap-2"
                            disabled={isExporting}
                            onClick={() => handleExport('csv')}
                        >
                            <Filter className="w-4 h-4" />
                            Download CSV (.csv)
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
                <div className="p-2 bg-blue-100 rounded-full h-fit">
                    <FileDown className="w-4 h-4 text-blue-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-blue-900">Pro Tip</p>
                    <p className="text-sm text-blue-700">
                        Exported files for "Past" posts include live links and 24h engagement snapshots if available.
                    </p>
                </div>
            </div>
        </div>
    );
}
