"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Phone, TrendingUp, History } from "lucide-react";
import { formatPrice } from "@/lib/plans";

interface WalletCardProps {
  smsAvailable: number;
  smsUsed: number;
  whatsappAvailable: number;
  whatsappUsed: number;
  transactions: any[];
}

export function WalletCard({
  smsAvailable,
  smsUsed,
  whatsappAvailable,
  whatsappUsed,
  transactions
}: WalletCardProps) {
  const smsTotal = smsAvailable + smsUsed;
  const whatsappTotal = whatsappAvailable + whatsappUsed;

  const smsPercentage = smsTotal > 0 ? (smsUsed / smsTotal) * 100 : 0;
  const whatsappPercentage = whatsappTotal > 0 ? (whatsappUsed / whatsappTotal) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* SMS Credits */}
      <Card className="overflow-hidden border-primary/10 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="size-4 text-blue-500" />
              SMS Credits
            </CardTitle>

          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold">{smsAvailable.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">Available</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{smsUsed.toLocaleString()} used</span>
                <span className="font-medium">{Math.round(smsPercentage)}%</span>
              </div>
              <Progress value={smsPercentage} className="h-1.5" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-3 text-green-500" />
              <span>{smsTotal.toLocaleString()} Total Credits</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Credits */}
      <Card className="overflow-hidden border-primary/10 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="size-4 text-green-500" />
              WhatsApp Credits
            </CardTitle>

          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold">{whatsappAvailable.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">Available</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{whatsappUsed.toLocaleString()} used</span>
                <span className="font-medium">{Math.round(whatsappPercentage)}%</span>
              </div>
              <Progress value={whatsappPercentage} className="h-1.5" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-3 text-green-500" />
              <span>{whatsappTotal.toLocaleString()} Total Credits</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="overflow-hidden border-primary/10 shadow-sm hover:shadow-md transition-shadow lg:col-span-1 md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <History className="size-4 text-orange-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {transactions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No transactions found</p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-0">
                    <div className="space-y-0.5">
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className={`font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
