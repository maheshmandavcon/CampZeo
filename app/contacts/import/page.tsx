'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, Download, FileText, CheckCircle, XCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CSVRow {
    contactName?: string;
    contactEmail?: string;
    contactMobile?: string;
    contactWhatsApp?: string;
    campaigns?: string;
}

interface ValidationError {
    row: number;
    field: string;
    message: string;
    data: CSVRow;
}

interface ImportResult {
    success: number;
    failed: number;
    duplicates: number;
    errors: ValidationError[];
}

export default function ImportContactsPage() {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<CSVRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileSelect = async (selectedFile: File) => {
        if (!selectedFile.name.endsWith('.csv')) {
            toast.error('Please select a CSV file');
            return;
        }

        setFile(selectedFile);

        // Parse and preview first 10 rows
        try {
            const text = await selectedFile.text();
            const rows = parseCSV(text);
            setPreview(rows.slice(0, 10));
            toast.success('File loaded successfully');
        } catch (error) {
            console.error('Error parsing CSV:', error);
            toast.error('Failed to parse CSV file');
        }
    };

    const parseCSV = (csvText: string): CSVRow[] => {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows: CSVRow[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row: CSVRow = {};

            headers.forEach((header, index) => {
                const value = values[index] || '';

                if (header.includes('name')) {
                    row.contactName = value;
                } else if (header.includes('email')) {
                    row.contactEmail = value;
                } else if (header.includes('mobile') || header.includes('phone')) {
                    row.contactMobile = value;
                } else if (header.includes('whatsapp')) {
                    row.contactWhatsApp = value;
                } else if (header.includes('campaign')) {
                    row.campaigns = value;
                }
            });

            rows.push(row);
        }

        return rows;
    };

    const handleImport = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        try {
            setImporting(true);
            setImportProgress(0);

            const formData = new FormData();
            formData.append('file', file);

            // Simulate progress
            const progressInterval = setInterval(() => {
                setImportProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const response = await fetch('/api/contacts/import', {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setImportProgress(100);

            if (!response.ok) {
                throw new Error('Import failed');
            }

            const result: ImportResult = await response.json();
            setImportResult(result);
            setShowResultDialog(true);

            if (result.success > 0) {
                toast.success(`Successfully imported ${result.success} contacts`);
            }
        } catch (error) {
            console.error('Error importing contacts:', error);
            toast.error('Failed to import contacts');
        } finally {
            setImporting(false);
            setImportProgress(0);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await fetch('/api/contacts/template');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'contacts_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Template downloaded');
        } catch (error) {
            console.error('Error downloading template:', error);
            toast.error('Failed to download template');
        }
    };

    const handleDownloadErrors = () => {
        if (!importResult || importResult.errors.length === 0) return;

        const csvContent = [
            'Row,Field,Error,Name,Email,Mobile,WhatsApp,Campaigns',
            ...importResult.errors.map(err =>
                `${err.row},"${err.field}","${err.message}","${err.data.contactName || ''}","${err.data.contactEmail || ''}","${err.data.contactMobile || ''}","${err.data.contactWhatsApp || ''}","${err.data.campaigns || ''}"`
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'import_errors.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Error report downloaded');
    };

    return (
        <div className="min-h-screen bg-background">
       
            <div className="flex">
        
                <main className="flex-1 p-6">
                    <div className=" mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                className="cursor-pointer"
                                size="icon"
                                onClick={() => router.push('/contacts')}
                            >
                                <ArrowLeft className="size-4" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">Import Contacts</h1>
                                <p className="text-muted-foreground mt-1">
                                    Upload a CSV file to bulk import contacts
                                </p>
                            </div>
                        </div>

                        {/* Download Template */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Step 1: Download Template</CardTitle>
                                <CardDescription>
                                    Download our CSV template to ensure your data is formatted correctly
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button onClick={handleDownloadTemplate} className="cursor-pointer" variant="outline">
                                    <Download className="size-4 mr-2" />
                                    Download CSV Template
                                </Button>
                            </CardContent>
                        </Card>

                        {/* File Upload */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Step 2: Upload CSV File</CardTitle>
                                <CardDescription>
                                    Drag and drop your CSV file or click to browse
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                                            ? 'border-primary bg-primary/5'
                                            : 'border-muted-foreground/25'
                                        }`}
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                >
                                    <Upload className="size-12 mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-lg font-medium mb-2">
                                        {file ? file.name : 'Drop your CSV file here'}
                                    </p>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        or click to browse
                                    </p>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload">
                                        <Button variant="outline" className="cursor-pointer" asChild>
                                            <span>
                                                <FileText className="size-4 mr-2" />
                                                Browse Files
                                            </span>
                                        </Button>
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        {preview.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Step 3: Preview Data</CardTitle>
                                    <CardDescription>
                                        Review the first 10 rows of your CSV file
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Mobile</TableHead>
                                                    <TableHead>WhatsApp</TableHead>
                                                    <TableHead>Campaigns</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {preview.map((row, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{row.contactName || '-'}</TableCell>
                                                        <TableCell>{row.contactEmail || '-'}</TableCell>
                                                        <TableCell>{row.contactMobile || '-'}</TableCell>
                                                        <TableCell>{row.contactWhatsApp || '-'}</TableCell>
                                                        <TableCell>{row.campaigns || '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Import Button */}
                        {file && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Step 4: Import Contacts</CardTitle>
                                    <CardDescription>
                                        Click the button below to start importing your contacts
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {importing && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span>Importing contacts...</span>
                                                <span>{importProgress}%</span>
                                            </div>
                                            <Progress value={importProgress} />
                                        </div>
                                    )}
                                    <Button
                                        onClick={handleImport}
                                        disabled={importing}
                                        size="lg"
                                        className="w-full cursor-pointer"
                                    >
                                        {importing ? (
                                            <>
                                                <Loader2 className="size-4 mr-2 animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="size-4 mr-2" />
                                                Import Contacts
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </main>
            </div>

            {/* Import Result Dialog */}
            <AlertDialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Import Complete</AlertDialogTitle>
                        <AlertDialogDescription>
                            Here's a summary of your import
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {importResult && (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle className="size-8 text-green-500" />
                                            <div>
                                                <p className="text-2xl font-bold">{importResult.success}</p>
                                                <p className="text-sm text-muted-foreground">Successful</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3">
                                            <XCircle className="size-8 text-red-500" />
                                            <div>
                                                <p className="text-2xl font-bold">{importResult.failed}</p>
                                                <p className="text-sm text-muted-foreground">Failed</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="size-8 text-yellow-500" />
                                            <div>
                                                <p className="text-2xl font-bold">{importResult.duplicates}</p>
                                                <p className="text-sm text-muted-foreground">Duplicates</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Error Details */}
                            {importResult.errors.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium">Error Details</h4>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="cursor-pointer"
                                            onClick={handleDownloadErrors}
                                        >
                                            <Download className="size-4 mr-2" />
                                            Download Error Report
                                        </Button>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Row</TableHead>
                                                    <TableHead>Field</TableHead>
                                                    <TableHead>Error</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {importResult.errors.slice(0, 10).map((error, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{error.row}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">{error.field}</Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm">{error.message}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {importResult.errors.length > 10 && (
                                            <p className="text-sm text-muted-foreground text-center py-2">
                                                And {importResult.errors.length - 10} more errors...
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setShowResultDialog(false);
                            setFile(null);
                            setPreview([]);
                            setImportResult(null);
                        }}>
                            Import Another File
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => router.push('/contacts')}>
                            View Contacts
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
