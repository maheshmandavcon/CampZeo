"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, FileDown, Calendar as CalendarIcon, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useEffect } from "react";

export default function ExportView() {
    const [platform, setPlatform] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const fetchPreview = async () => {
        try {
            setIsLoadingPreview(true);
            const params = new URLSearchParams({
                platform,
                startDate,
                endDate,
                preview: 'true'
            });

            const response = await fetch(`/api/Organisation/posts/export?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch preview');

            const data = await response.json();
            // Data structure: { summary: [], posts: [], analytics: [] }
            // We'll show the 'posts' array as it's the main detailed view
            setPreviewData(data.posts || []);
        } catch (error) {
            console.error('Preview error:', error);
            // Silent error for preview, or maybe toast?
            // toast.error('Failed to load preview');
        } finally {
            setIsLoadingPreview(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchPreview();
        }, 500); // 500ms debounce
        return () => clearTimeout(timeoutId);
    }, [platform, startDate, endDate]);

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

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `posts_export_${new Date().toISOString().split('T')[0]}.${format}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success(`Posts exported successfully`);
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

            {/* <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
                <div className="p-2 bg-blue-100 rounded-full h-fit">
                    <FileDown className="w-4 h-4 text-blue-600" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-semibold text-blue-900">Pro Tip</p>
                    <p className="text-sm text-blue-700">
                        Exported files for "Past" posts include live links and 24h engagement snapshots if available.
                    </p>
                </div>
            </div> */}

            <Card>
                <CardHeader>
                    <CardTitle>Data Preview</CardTitle>
                    <CardDescription>
                        Preview of the "Posts Data" sheet based on current filters.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingPreview ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Campaign</TableHead>
                                        <TableHead>Platform</TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Scheduled</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24">
                                                No posts found for the selected filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        previewData.map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{row.Campaign}</TableCell>
                                                <TableCell>{row.Platform}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={row.Subject}>
                                                    {row.Subject || row.Message || '-'}
                                                </TableCell>
                                                <TableCell>{row.Status}</TableCell>
                                                <TableCell>{row['Scheduled Date']}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
