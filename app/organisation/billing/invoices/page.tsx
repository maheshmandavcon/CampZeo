"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { FileText, Loader2, ArrowLeft, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/plans";
import { toast } from "sonner";

interface PaymentData {
    id: string;
    amount: number;
    currency: string;
    status: string;
    plan: string;
    createdAt: string;
}

export default function InvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<PaymentData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const [invoicesResponse, paymentsResponse] = await Promise.all([
                fetch("/api/invoices"),
                fetch("/api/payments")
            ]);

            if (invoicesResponse.ok) {
                const data = await invoicesResponse.json();
                setInvoices(data.invoices || []);
            }

            if (paymentsResponse.ok) {
                const data = await paymentsResponse.json();
                setPayments(data.payments || []);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load billing history");
        } finally {
            setLoading(false);
        }
    };

    const handleViewInvoice = (invoice: any) => {
        router.push(`/organisation/billing/invoices/${invoice.id}`);
    };

    return (
        <div className="p-6">
            <div className=" mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
                        <p className="text-muted-foreground mt-1">
                            View and manage your billing history and invoices
                        </p>
                    </div>
                </div>

                {/* Invoice List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invoice History</CardTitle>
                        <CardDescription>
                            A list of all invoices and payment transactions for your organisation
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : invoices.length === 0 && payments.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">No billing history found</p>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Invoice #</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>

                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.map((invoice) => (
                                            <TableRow key={`inv-${invoice.id}`}>
                                                <TableCell className="font-medium">
                                                    {invoice.invoiceNumber}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(invoice.invoiceDate).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="truncate max-w-[200px] block" title={invoice.description || ""}>
                                                        {invoice.description || "Subscription"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {formatPrice(Number(invoice.amount), invoice.currency)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            invoice.status === "PAID"
                                                                ? "default"
                                                                : invoice.status === "PENDING"
                                                                    ? "secondary"
                                                                    : "destructive"
                                                        }
                                                        className={
                                                            invoice.status === "PAID" ? "bg-green-600 hover:bg-green-700" : ""
                                                        }
                                                    >
                                                        {invoice.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">Invoice</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewInvoice(invoice)}
                                                    >
                                                        <Eye className="size-4 mr-2" />
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {payments.map((payment) => (
                                            <TableRow key={`pay-${payment.id}`}>
                                                <TableCell className="font-medium text-muted-foreground text-xs">
                                                    {(payment as any).razorpayPaymentId || (payment as any).razorpayOrderId || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(payment.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    {payment.plan} Plan
                                                </TableCell>
                                                <TableCell>
                                                    {formatPrice(payment.amount, payment.currency)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            payment.status === "COMPLETED"
                                                                ? "default"
                                                                : payment.status === "PENDING"
                                                                    ? "secondary"
                                                                    : "destructive"
                                                        }
                                                        className={
                                                            payment.status === "COMPLETED" ? "bg-red-600 hover:bg-red-700" : ""
                                                        }
                                                    >
                                                        {payment.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell />
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>


            </div>
        </div>
    );
}
