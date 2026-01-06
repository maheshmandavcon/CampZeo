"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/plans";
import { Printer, Download, Share2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

interface InvoiceViewProps {
    invoice: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function InvoiceView({ invoice, open, onOpenChange }: InvoiceViewProps) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = async () => {
        const content = contentRef.current;
        if (!content) return;

        setIsPrinting(true);

        // Create a hidden iframe
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

        // Get all style sheets to ensure consistency
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

        // Write content to iframe
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

        // Wait for content (especially images) to load
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();

            // Remove iframe after printing
            setTimeout(() => {
                document.body.removeChild(iframe);
                setIsPrinting(false);
            }, 1000);
        }, 500);
    };

    if (!invoice) return null;

    const organisation = invoice.subscription?.organisation;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto p-0 gap-0 bg-slate-50">
                <DialogHeader className="p-6 border-b bg-white sticky top-0 z-10 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl">Invoice #{invoice.invoiceNumber}</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Issued on {new Date(invoice.invoiceDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
                            <Printer className="size-4 mr-2" />
                            {isPrinting ? "Printing..." : "Print"}
                        </Button>
                        <Button variant="default" size="sm" onClick={handlePrint}>
                            <Download className="size-4 mr-2" />
                            Download PDF
                        </Button>
                    </div>
                </DialogHeader>

                <div className="p-8 md:p-12 overflow-auto print-content">
                    <div
                        className="bg-white text-slate-900 p-8 md:p-12 shadow-sm border rounded-lg min-h-[800px] max-w-[800px] mx-auto relative"
                        ref={contentRef}
                        id="invoice-content"
                    >
                        {/* Status Watermark for unpaid */}
                        {invoice.status !== 'PAID' && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 pointer-events-none opacity-10 border-4 border-red-500 text-red-500 text-9xl font-black uppercase p-4 rounded-xl">
                                {invoice.status}
                            </div>
                        )}

                        {/* Header Section */}
                        <div className="flex justify-between items-start mb-12">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    {/* Use a high-res generic placeholder if logo is missing, else use actual logo */}
                                    <img
                                        src="/logo-1.png"
                                        alt="CampZeo"
                                        className="h-12 w-auto object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                    <span className="text-2xl font-bold tracking-tight text-indigo-600">CampZeo</span>
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
                        <div className="grid grid-cols-2 gap-12 mb-12">
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
                        <div className="mb-12">
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

                                    {/* Example place for Tax if needed */}
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
                        <div className="flex justify-end mb-16">
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
                        <div className="bg-slate-50 rounded-lg p-6 text-center">
                            <p className="text-slate-600 font-medium mb-1">Thank you for your business!</p>
                            <p className="text-slate-500 text-sm">If you have any questions concerning this invoice, please contact support@campzeo.com</p>
                        </div>

                        <div className="mt-8 text-center">
                            <p className="text-xs text-slate-300">Generated by CampZeo Platform</p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t bg-white sticky bottom-0 z-10 sm:justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange?.(false)}>
                        Close
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
                            <Printer className="size-4 mr-2" />
                            Print Invoice
                        </Button>
                        <Button onClick={handlePrint}>
                            <Download className="size-4 mr-2" />
                            Download PDF
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
