"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Download, ArrowLeft, Share2 } from "lucide-react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/plans";
import { toast } from "sonner";

export default function InvoicePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const [invoice, setInvoice] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const printTriggeredRef = useRef(false);

    useEffect(() => {
        if (params.id) {
            fetchInvoice(params.id as string);
        }
    }, [params.id]);

    useEffect(() => {
        if (!loading && invoice && searchParams.get("download") === "true" && !printTriggeredRef.current) {
            printTriggeredRef.current = true;
            // Short delay to ensure DOM is fully rendered
            setTimeout(() => {
                handlePrint();
            }, 1000);
        }
    }, [loading, invoice, searchParams]);

    const fetchInvoice = async (id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/invoices/${id}`);
            if (!response.ok) throw new Error("Failed to fetch invoice");
            const data = await response.json();
            setInvoice(data.invoice);
        } catch (error) {
            console.error("Error fetching invoice:", error);
            toast.error("Failed to load invoice details");
            router.push("/organisation/billing/invoices");
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = async () => {
        const content = contentRef.current;
        if (!content) return;

        setIsPrinting(true);

        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
            setIsPrinting(false);
            return;
        }

        const styles = Array.from(document.styleSheets)
            .map(styleSheet => {
                try {
                    return Array.from(styleSheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('');
                } catch (e) {
                    return '';
                }
            })
            .join('');

        doc.open();
        doc.write(`
          <html>
            <head>
              <title>Invoice #${invoice.invoiceNumber}</title>
              <style>
                ${styles}
                body { 
                    background: white !important; 
                    margin: 0;
                    padding: 40px;
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important; 
                }
                .no-print { display: none !important; }
              </style>
              <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body>
              ${content.innerHTML}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            setTimeout(() => {
                document.body.removeChild(iframe);
                setIsPrinting(false);
            }, 1000);
        }, 500);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!invoice) return null;

    const organisation = invoice.subscription?.organisation;

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
            <div className=" mx-auto space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
                            <ArrowLeft className="size-4 mr-2" />
                            Back
                        </Button>
                        <h1 className="text-xl font-semibold">Invoice Details</h1>
                    </div>
                    <div className="flex items-center gap-2  sm:w-auto">

                        <Button onClick={handlePrint} disabled={isPrinting} className="flex-1 sm:flex-none">
                            <Download className="size-4 mr-2" />
                            Download PDF
                        </Button>
                    </div>
                </div>

                {/* Invoice Content */}
                <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="p-8 md:p-12" ref={contentRef}>
                        <div className=" mx-auto relative">
                            {/* Status Watermark */}
                            {invoice.status !== 'PAID' && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-10 border-4 border-red-500 text-red-500 text-9xl font-black uppercase p-4 rounded-xl whitespace-nowrap z-0">
                                    {invoice.status}
                                </div>
                            )}

                            {/* Header Section */}
                            <div className="flex justify-between items-start mb-12 relative z-10">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src="/logo-1.png"
                                            alt="CampZeo"
                                            className="h-12 w-auto object-contain"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="text-sm text-slate-500 max-w-[200px]">
                                        <p>123 Innovation Drive</p>
                                        <p>Tech City, TC 90210</p>
                                        <p>support@campzeo.com</p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <h1 className="text-4xl font-light text-slate-300 tracking-widest uppercase mb-2">Invoice</h1>
                                    <p className="font-mono text-lg font-medium text-slate-700">#{invoice.invoiceNumber}</p>
                                    <div className="mt-4">
                                        <span className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium ${invoice.status === 'PAID' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' :
                                            invoice.status === 'PENDING' ? 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20' :
                                                'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                                            }`}>
                                            {invoice.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100 mb-12" />

                            {/* Client & Dates Grid */}
                            <div className="grid grid-cols-2 gap-12 mb-12 relative z-10">
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Bill To</h3>
                                    <div className="text-slate-900 font-bold text-lg mb-1">{organisation?.name || "Valued Customer"}</div>
                                    <div className="text-slate-600 text-sm space-y-1">
                                        {organisation?.address ? <p>{organisation.address}</p> : <p className="text-slate-400 italic">No address provided</p>}
                                        {(organisation?.city || organisation?.state || organisation?.postalCode) && (
                                            <p>{[organisation.city, organisation.state, organisation.postalCode].filter(Boolean).join(', ')}</p>
                                        )}
                                        {organisation?.country && <p>{organisation.country}</p>}
                                        {organisation?.email && <p className="text-indigo-600 mt-2">{organisation.email}</p>}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                        <span className="text-slate-500 text-sm">Invoice Date</span>
                                        <span className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-100 pb-2">
                                        <span className="text-slate-500 text-sm">Due Date</span>
                                        <span className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
                                    </div>
                                    {invoice.paymentMethod && (
                                        <div className="flex justify-between border-b border-slate-100 pb-2">
                                            <span className="text-slate-500 text-sm">Payment Method</span>
                                            <span className="font-medium capitalize">{invoice.paymentMethod.replace(/_/g, ' ').toLowerCase()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Line Items Table */}
                            <div className="mb-12 relative z-10">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-y border-slate-200">
                                            <th className="py-4 pl-4 text-left font-semibold text-slate-700 text-sm uppercase tracking-wide w-2/3">Description</th>
                                            <th className="py-4 pr-4 text-right font-semibold text-slate-700 text-sm uppercase tracking-wide w-1/3">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-6 pl-4">
                                                <p className="font-bold text-slate-900">{invoice.description || "Subscription Plan"}</p>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    Period: {new Date(invoice.subscription?.startDate).toLocaleDateString()} — {new Date(invoice.subscription?.endDate).toLocaleDateString()}
                                                </p>
                                            </td>
                                            <td className="py-6 pr-4 text-right font-mono text-slate-700">
                                                {formatPrice(Number(invoice.amount), invoice.currency)}
                                            </td>
                                        </tr>
                                        {Number(invoice.taxAmount) > 0 && (
                                            <tr>
                                                <td className="py-6 pl-4">
                                                    <p className="font-medium text-slate-900">Tax / VAT</p>
                                                </td>
                                                <td className="py-6 pr-4 text-right font-mono text-slate-700">
                                                    {formatPrice(Number(invoice.taxAmount), invoice.currency)}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Section */}
                            <div className="flex justify-end mb-16 relative z-10">
                                <div className="w-full max-w-xs space-y-3">
                                    <div className="flex justify-between text-slate-600 text-sm">
                                        <span>Subtotal</span>
                                        <span className="font-mono">{formatPrice(Number(invoice.amount) - Number(invoice.taxAmount || 0), invoice.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 text-sm">
                                        <span>Tax</span>
                                        <span className="font-mono">{formatPrice(Number(invoice.taxAmount || 0), invoice.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-600 text-sm">
                                        <span>Discount</span>
                                        <span className="font-mono text-green-600">-{formatPrice(Number(invoice.discountAmount || 0), invoice.currency)}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-3 mt-3 flex justify-between items-end">
                                        <span className="font-bold text-slate-900">Total</span>
                                        <span className="font-bold text-2xl text-indigo-600 font-mono">
                                            {formatPrice(Number(invoice.amount) - Number(invoice.discountAmount || 0), invoice.currency)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-slate-50 rounded-lg p-6 text-center break-inside-avoid relative z-10">
                                <p className="text-slate-600 font-medium mb-1">Thank you for your business!</p>
                                <p className="text-slate-500 text-sm">If you have any questions concerning this invoice, please contact support@campzeo.com</p>
                            </div>

                            <div className="mt-8 text-center relative z-10">
                                <p className="text-xs text-slate-300">Generated by CampZeo Platform</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
