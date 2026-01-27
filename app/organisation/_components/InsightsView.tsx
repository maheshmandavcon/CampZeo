"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Loader2, TrendingUp, BarChart3, PieChart as PieChartIcon, Calendar as CalendarIcon, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { exportChartToPDF } from "@/lib/chart-export";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function InsightsView() {
    const [platform, setPlatform] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    // Chart Refs for PDF Export
    const pieChartRef = useRef<HTMLDivElement>(null);
    const barChartRef = useRef<HTMLDivElement>(null);

    const fetchInsights = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                platform,
                startDate,
                endDate
            });

            const response = await fetch(`/api/Organisation/posts/insights?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch insights');
            const result = await response.json();
            setData(result.insights);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to update insights data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, [platform, startDate, endDate]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // PDF Export Handlers
    const handleExportPieChart = async () => {
        try {
            await exportChartToPDF(pieChartRef, 'platform-distribution-pie', 'Platform Distribution (Pie Chart)');
            toast.success('Pie chart exported to PDF');
        } catch (error) {
            toast.error('Failed to export chart');
        }
    };

    const handleExportBarChart = async () => {
        try {
            await exportChartToPDF(barChartRef, 'platform-distribution-bar', 'Platform Distribution (Bar Chart)');
            toast.success('Bar chart exported to PDF');
        } catch (error) {
            toast.error('Failed to export chart');
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg border shadow-sm items-end">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Platform</label>
                    <Select value={platform} onValueChange={setPlatform}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Platform" />
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
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[180px]" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[180px]" />
                </div>
                <Button variant="outline" onClick={fetchInsights} className="gap-2">
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Posts</CardDescription>
                        <CardTitle className="text-3xl font-bold">{data?.totalPosts || 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                            <TrendingUp className="w-3 h-3" />
                            All matched records
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Upcoming Posts</CardDescription>
                        <CardTitle className="text-3xl font-bold">{data?.stats.upcoming || 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <TrendingUp className="w-3 h-3" />
                            Next scheduled post soon
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Past (Published)</CardDescription>
                        <CardTitle className="text-3xl font-bold">{data?.stats.past || 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <BarChart3 className="w-3 h-3" />
                            Engagement synced
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Drafts</CardDescription>
                        <CardTitle className="text-3xl font-bold">{data?.stats.drafts || 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                            <CalendarIcon className="w-3 h-3" />
                            Pending scheduling
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Platform Distribution Pie Chart */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <PieChartIcon className="w-5 h-5 text-blue-600" />
                                    Platform Distribution
                                </CardTitle>
                                <CardDescription>Distribution of posts across different social platforms.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportPieChart}
                                disabled={!data?.platformMix.length}
                                className="cursor-pointer"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        {data?.platformMix.length > 0 ? (
                            <div ref={pieChartRef} style={{ width: '100%', height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data.platformMix}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="count"
                                            nameKey="platform"
                                        >
                                            {data.platformMix.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                No platform data available for the selected filters.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Platform Distribution */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-green-600" />
                                    Platform Distribution
                                </CardTitle>
                                <CardDescription>Compare post volumes across different social platforms.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportBarChart}
                                disabled={!data?.platformMix.length}
                                className="cursor-pointer"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        {data?.platformMix.length > 0 ? (
                            <div ref={barChartRef} style={{ width: '100%', height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.platformMix}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="platform" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                No platform data available.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
