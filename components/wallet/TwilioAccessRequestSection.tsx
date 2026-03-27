"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface TwilioAccessRequestSectionProps {
  status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  reason?: string;
  onSuccess?: () => void;
}

export function TwilioAccessRequestSection({ status, reason, onSuccess }: TwilioAccessRequestSectionProps) {
  const [requestReason, setRequestReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!requestReason.trim()) {
      toast.error("Please provide a reason for your request");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/twilio/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: requestReason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }

      toast.success("Request submitted successfully!");
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "APPROVED") {
    return (
      <Card className="border-green-100 bg-green-50/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600" />
              Twilio SMS & WhatsApp Access
            </CardTitle>
            <Badge variant="default" className="bg-green-600">Approved</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-800">
            Your access has been approved. You can now purchase credits and send campaigns.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "PENDING") {
    return (
      <Card className="border-blue-100 bg-blue-50/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="size-4 text-blue-600" />
              Access Request Pending
            </CardTitle>
            <Badge variant="outline" className="border-blue-200 text-blue-700">Pending Review</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-blue-800">
            Our team is reviewing your request for Twilio access. You'll be notified once it's approved.
          </p>
          {reason && (
             <div className="mt-3 p-2 bg-white/50 rounded text-xs italic text-blue-600 border border-blue-100">
                "{reason}"
             </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={status === "REJECTED" ? "border-red-100" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
                <Send className="size-5 text-primary" />
                Request Twilio Access
            </CardTitle>
            {status === "REJECTED" && <Badge variant="destructive">Rejected</Badge>}
        </div>
        <CardDescription>
          Apply for SMS and WhatsApp campaign access. Please describe your use case briefly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "REJECTED" && (
            <div className="flex items-start gap-3 p-3 bg-red-50 text-red-800 rounded-lg text-sm mb-2 border border-red-100">
                <AlertCircle className="size-4 mt-0.5 shrink-0" />
                <div>
                   <p className="font-semibold">Request Rejected</p>
                   <p className="text-xs">{reason || "No reason provided by admin."}</p>
                </div>
            </div>
        )}
        <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Reason for Request</label>
            <Textarea 
                placeholder="e.g. I want to send promotional SMS and WhatsApp updates to my 5000+ customer base." 
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isSubmitting}
            />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
            className="w-full" 
            onClick={handleSubmit} 
            disabled={isSubmitting || !requestReason.trim()}
        >
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </CardFooter>
    </Card>
  );
}
