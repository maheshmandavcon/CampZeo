import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Calendar, CreditCard, Users, Database, Activity } from 'lucide-react';
import { Header } from '@/components/Header';

interface Organisation {
  id: number;
  name: string;
  email: string;
  plan: string;
  status: string;
  mrr: number;
  joinedAt: string;
}

interface OrganisationDetailsModalProps {
  isOpen: boolean;
  organisation: Organisation | null;
  onClose: () => void;
}

export function OrganisationDetailsModal({ isOpen, organisation, onClose }: OrganisationDetailsModalProps) {
  if (!organisation) return null;

  // =============================================
  // TODO: FETCH DETAILED ORGANISATION DATA
  // =============================================
  // useEffect(() => {
  //   async function fetchOrganisationDetails() {
  //     const response = await fetch(`/api/admin/organisations/${organisation.id}/details`)
  //     const data = await response.json()
  //     setOrganisationDetails(data)
  //   }
  //   fetchOrganisationDetails()
  // }, [organisation.id])
  // =============================================

  // Mock detailed data
  const details = {
    userCount: 12,
    storageUsedGB: 45,
    apiCallsThisMonth: 12450,
    lastPaymentDate: '2024-11-01',
    nextBillingDate: '2024-12-01',
    totalRevenue: 29990,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{organisation.name}</DialogTitle>
              <DialogDescription>{organisation.email}</DialogDescription>
            </div>
            <Badge variant={organisation.status === 'active' ? 'default' : 'outline'}>
              {organisation.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{details.userCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{details.storageUsedGB}GB</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">API Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{details.apiCallsThisMonth.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Subscription Details */}
          <div className="space-y-4">
            <h4 className="font-semibold">Subscription Details</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <span>Plan</span>
                </div>
                <Badge variant="secondary">{organisation.plan}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="size-4 text-muted-foreground" />
                  <span>Monthly Revenue</span>
                </div>
                <span className="font-semibold">₹{organisation.mrr}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>Joined</span>
                </div>
                <span className="text-sm text-muted-foreground">{organisation.joinedAt}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>Last Payment</span>
                </div>
                <span className="text-sm text-muted-foreground">{details.lastPaymentDate}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>Next Billing</span>
                </div>
                <span className="text-sm text-muted-foreground">{details.nextBillingDate}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="size-4 text-muted-foreground" />
                  <span>Total Revenue</span>
                </div>
                <span className="font-semibold">₹{details.totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}