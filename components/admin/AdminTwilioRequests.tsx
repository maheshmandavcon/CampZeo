"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, CheckCircle, XCircle, Clock, Smartphone } from "lucide-react";

export function AdminTwilioRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/twilio-requests");
      const data = await response.json();
      if (response.ok && data.requests) {
        setRequests(data.requests);
      } else {
        toast.error(data.error || "Failed to fetch requests");
      }
    } catch (error) {
      toast.error("An error occurred while fetching requests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (requestId: number, status: "APPROVED" | "REJECTED", reason?: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/admin/twilio-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status, reason }),
      });

      const data = await response.json();
      if (data.isSuccess) {
        toast.success(`Request ${status.toLowerCase()} successfully`);
        fetchRequests();
        setIsRejectionModalOpen(false);
        setRejectionReason("");
        setSelectedRequest(null);
      } else {
        toast.error(data.error || "Failed to update request");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRequests = requests.filter(req => 
    req.organisation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.organisation.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED": return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "REJECTED": return <Badge variant="destructive">Rejected</Badge>;
      case "PENDING": return <Badge variant="outline" className="border-blue-200 text-blue-700">Pending</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Twilio Access Requests</h2>
          <p className="text-muted-foreground">Approve or reject SMS and WhatsApp messaging access for organisations.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search by organisation..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Reason for Request</TableHead>
                <TableHead>Requested On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <Clock className="size-4 animate-spin text-primary" />
                            <span>Loading requests...</span>
                        </div>
                    </TableCell>
                 </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No requests found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.organisation.name}</TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        <p>{req.organisation.email}</p>
                        <p className="text-muted-foreground">{req.organisation.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate" title={req.reason}>{req.reason}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(req.createdAt), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                    <TableCell className="text-right">
                      {req.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleAction(req.id, "APPROVED")}
                            disabled={isProcessing}
                          >
                            <CheckCircle className="size-4 mr-1" /> Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsRejectionModalOpen(true);
                            }}
                            disabled={isProcessing}
                          >
                            <XCircle className="size-4 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {req.status !== "PENDING" && req.adminReason && (
                         <span className="text-xs text-muted-foreground italic truncate block max-w-[150px]" title={req.adminReason}>
                            Ref: {req.adminReason}
                         </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rejection Modal */}
      <Dialog open={isRejectionModalOpen} onOpenChange={setIsRejectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Twilio Access Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting the request from <strong>{selectedRequest?.organisation.name}</strong>. This will be shown to the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea 
                id="rejection-reason"
                placeholder="e.g. Please provide more details about your planned campaigns."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectionModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => handleAction(selectedRequest?.id, "REJECTED", rejectionReason)}
              disabled={isProcessing || !rejectionReason.trim()}
            >
              {isProcessing ? "Processing..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
