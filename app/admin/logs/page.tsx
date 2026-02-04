"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Search,
    Filter,
    AlertCircle,
    Info,
    AlertTriangle,
    RefreshCcw,
    Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";

// Helper for log level badges
const LevelBadge = ({ level }: { level: string }) => {
    switch (level?.toLowerCase()) {
        case 'error':
            return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
        case 'warning':
            return <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"><AlertTriangle className="h-3 w-3" /> Warning</Badge>;
        case 'info':
        case 'information':
            return <Badge variant="outline" className="gap-1 text-blue-600 border-blue-200 bg-blue-50"><Info className="h-3 w-3" /> Info</Badge>;
        default:
            return <Badge variant="secondary">{level}</Badge>;
    }
};

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState("");
    const [level, setLevel] = useState("all");
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Detail Modal
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: "20",
                keyword,
                level: level === "all" ? "" : level
            });

            const res = await fetch(`/api/admin/logs?${params}`);
            const data = await res.json();

            if (data.isSuccess) {
                setLogs(data.data.logs);
                setTotalCount(data.data.totalCount);
                setTotalPages(data.data.totalPages);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, level]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Link
                        href="/admin"
                        className="text-muted-foreground hover:text-foreground flex items-center mb-2 transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor system events, errors, and warnings.
                    </p>
                </div>
                <Button onClick={() => fetchLogs()} disabled={isLoading} variant="outline" size="sm">
                    <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between">
                        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search logs..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Button type="submit">Search</Button>
                        </form>

                        <div className="flex gap-2 items-center">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={level} onValueChange={(val) => { setLevel(val); setPage(1); }}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Levels</SelectItem>
                                    <SelectItem value="Error">Error</SelectItem>
                                    <SelectItem value="Warning">Warning</SelectItem>
                                    <SelectItem value="Information">Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                    <TableHead className="w-[100px]">Level</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No logs found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                                            <TableCell className="font-mono text-xs">
                                                {new Date(log.timeStamp).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <LevelBadge level={log.level} />
                                            </TableCell>
                                            <TableCell className="max-w-[500px] truncate font-medium">
                                                {log.message}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm">View</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                            Showing {logs.length} of {totalCount} entries
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || isLoading}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages || isLoading}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LevelBadge level={selectedLog?.level} />
                            <span className="truncate">{selectedLog?.message}</span>
                        </DialogTitle>
                        <DialogDescription>
                            Occurred at {selectedLog && new Date(selectedLog.timeStamp).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {selectedLog?.exception && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-destructive">Exception Trace</h4>
                                <div className="rounded-md bg-muted p-4 overflow-x-auto">
                                    <pre className="text-xs font-mono whitespace-pre-wrap text-destructive-foreground">
                                        {selectedLog.exception}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {selectedLog?.properties && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold">Additional Metadata</h4>
                                <div className="rounded-md bg-muted p-4 overflow-x-auto">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">
                                        {(() => {
                                            try {
                                                return JSON.stringify(JSON.parse(selectedLog.properties), null, 2);
                                            } catch {
                                                return selectedLog.properties;
                                            }
                                        })()}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
