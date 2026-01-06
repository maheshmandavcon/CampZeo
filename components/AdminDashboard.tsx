import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Header } from '@/components/Header';

import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Activity,
  LogOut,
  Home,
  Settings,
  Search,
  MoreVertical,
  Plus
} from 'lucide-react';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useState } from 'react';
import { OrganisationManagementModal } from './OrganisationManagementModal';
import { OrganisationDetailsModal } from './OrganisationDetailsModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface AdminDashboardProps {
  onLogout: () => void;
  onNavigate: (view: 'landing' | 'admin' | 'organisation') => void;
}

// =============================================
// TODO: REPLACE WITH REAL DATABASE CALLS
// =============================================
// In production, use these API calls instead of mock data:
//
// 1. Fetch Stats:
//    const { data } = await fetch('/api/dashboard/stats').then(r => r.json())
//
// 2. Fetch Organisations:
//    const { organisations } = await fetch('/api/organisations').then(r => r.json())
//
// 3. Fetch Activity:
//    const { activities } = await fetch('/api/activities').then(r => r.json())
//
// Use React Query or SWR for better data management:
// import useSWR from 'swr'
// const { data, error, isLoading } = useSWR('/api/organisations', fetcher)
// =============================================

// Mock data - In production, this would come from Prisma + Neon database
const mockStats = {
  totalRevenue: 2459800,
  totalUsers: 1234,
  activeSubscriptions: 856,
  growthRate: 23.5
};

interface Organisation {
  id: number;
  name: string;
  email: string;
  plan: string;
  status: string;
  mrr: number;
  joinedAt: string;
}

const initialMockOrganisations: Organisation[] = [
  { id: 1, name: 'Acme Corp', email: 'admin@acme.com', plan: 'Enterprise', status: 'active', mrr: 9999, joinedAt: '2024-01-15' },
  { id: 2, name: 'TechStart Inc', email: 'hello@techstart.com', plan: 'Professional', status: 'active', mrr: 2999, joinedAt: '2024-02-20' },
  { id: 3, name: 'Creative Studio', email: 'info@creative.com', plan: 'Professional', status: 'trial', mrr: 0, joinedAt: '2024-11-15' },
  { id: 4, name: 'Global Services', email: 'contact@global.com', plan: 'Enterprise', status: 'active', mrr: 9999, joinedAt: '2024-03-10' },
  { id: 5, name: 'Startup Hub', email: 'team@startuphub.com', plan: 'Professional', status: 'suspended', mrr: 2999, joinedAt: '2024-04-05' },
];

const mockRecentActivity = [
  { id: 1, action: 'New subscription', user: 'Creative Studio', timestamp: '2 hours ago' },
  { id: 2, action: 'Payment received', user: 'Acme Corp', timestamp: '5 hours ago' },
  { id: 3, action: 'Plan upgraded', user: 'TechStart Inc', timestamp: '1 day ago' },
  { id: 4, action: 'New user signup', user: 'Startup Hub', timestamp: '2 days ago' },
];

export function AdminDashboard({ onLogout, onNavigate }: AdminDashboardProps) {
  const [organisations, setOrganisations] = useState<Organisation[]>(initialMockOrganisations);
  const [selectedOrganisation, setSelectedOrganisation] = useState<Organisation | null>(null);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // =============================================
  // TODO: ADD REAL DATA FETCHING
  // =============================================
  // Replace mock data with real API calls:
  //
  // useEffect(() => {
  //   async function fetchData() {
  //     const [statsRes, organisationsRes, activityRes] = await Promise.all([
  //       fetch('/api/dashboard/stats'),
  //       fetch('/api/admin/organisations'),
  //       fetch('/api/activities')
  //     ])
  //     
  //     setStats(await statsRes.json())
  //     setOrganisations(await organisationsRes.json())
  //     setActivity(await activityRes.json())
  //   }
  //   fetchData()
  // }, [])
  // =============================================

  // =============================================
  // ACTION HANDLERS
  // =============================================
  
  const handleAddOrganisation = () => {
    setSelectedOrganisation(null);
    setModalMode('add');
    setShowManagementModal(true);
  };

  const handleEditOrganisation = (organisation: Organisation) => {
    setSelectedOrganisation(organisation);
    setModalMode('edit');
    setShowManagementModal(true);
  };

  const handleViewDetails = (organisation: Organisation) => {
    setSelectedOrganisation(organisation);
    setShowDetailsModal(true);
  };

  const handleSaveOrganisation = async (organisationData: Partial<Organisation>) => {
    // =============================================
    // TODO: REPLACE WITH REAL API CALL
    // =============================================
    // if (modalMode === 'add') {
    //   const response = await fetch('/api/admin/organisations', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(organisationData)
    //   });
    //   const newOrganisation = await response.json();
    //   setOrganisations([...organisations, newOrganisation]);
    // } else if (selectedOrganisation) {
    //   const response = await fetch(`/api/admin/organisations/${selectedOrganisation.id}`, {
    //     method: 'PATCH',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(organisationData)
    //   });
    //   const updatedOrganisation = await response.json();
    //   setOrganisations(organisations.map(t => t.id === selectedOrganisation.id ? updatedOrganisation : t));
    // }
    // =============================================

    // Mock implementation
    if (modalMode === 'add') {
      const newOrganisation: Organisation = {
        id: Math.max(...organisations.map(t => t.id)) + 1,
        name: organisationData.name || '',
        email: organisationData.email || '',
        plan: organisationData.plan || 'Professional',
        status: organisationData.status || 'trial',
        mrr: organisationData.plan === 'Professional' ? 2999 : organisationData.plan === 'Enterprise' ? 9999 : 0,
        joinedAt: new Date().toISOString().split('T')[0],
      };
      setOrganisations([...organisations, newOrganisation]);
    } else if (selectedOrganisation) {
      setOrganisations(organisations.map(t => 
        t.id === selectedOrganisation.id 
          ? { ...t, ...organisationData }
          : t
      ));
    }
  };

  const handleSuspendOrganisation = async () => {
    if (!selectedOrganisation) return;

    // =============================================
    // TODO: REPLACE WITH REAL API CALL
    // =============================================
    // await fetch(`/api/admin/organisations/${selectedOrganisation.id}`, {
    //   method: 'PATCH',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ status: 'suspended' })
    // });
    // =============================================

    setOrganisations(organisations.map(t => 
      t.id === selectedOrganisation.id 
        ? { ...t, status: 'suspended' }
        : t
    ));
    setShowSuspendDialog(false);
    setShowDetailsModal(false);
    setSelectedOrganisation(null);
  };

  const handleRestoreOrganisation = async () => {
    if (!selectedOrganisation) return;

    // =============================================
    // TODO: REPLACE WITH REAL API CALL
    // =============================================
    // await fetch(`/api/admin/organisations/${selectedOrganisation.id}`, {
    //   method: 'PATCH',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ status: 'active' })
    // });
    // =============================================

    setOrganisations(organisations.map(t => 
      t.id === selectedOrganisation.id 
        ? { ...t, status: 'active' }
        : t
    ));
    setShowRestoreDialog(false);
    setShowDetailsModal(false);
    setSelectedOrganisation(null);
  };

  const handleSendEmail = async (organisationId: number) => {
    // =============================================
    // TODO: IMPLEMENT EMAIL FUNCTIONALITY
    // =============================================
    // await fetch(`/api/admin/organisations/${organisationId}/send-email`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ 
    //     subject: 'Message from Admin',
    //     template: 'admin-message'
    //   })
    // });
    // =============================================
    alert('Email functionality would be implemented here');
  };

  // Filter organisations based on search
  const filteredOrganisations = organisations.filter(organisation =>
    organisation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    organisation.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
     <Header />

      <div className="p-6  mx-auto">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Total Revenue</CardTitle>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">₹{mockStats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +{mockStats.growthRate}% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Total Users</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{mockStats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                +180 from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Active Subscriptions</CardTitle>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{mockStats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">
                +12% conversion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Growth Rate</CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{mockStats.growthRate}%</div>
              <p className="text-xs text-muted-foreground">
                +5.2% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="organisations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="organisations">Organisations</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="organisations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Organisations</CardTitle>
                    <CardDescription>
                      Manage and monitor all organisation accounts
                    </CardDescription>
                  </div>
                  <Button onClick={handleAddOrganisation}>
                    <Plus className="size-4 mr-2" />
                    Add Organisation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganisations.map((organisation) => (
                      <TableRow key={organisation.id}>
                        <TableCell>{organisation.name}</TableCell>
                        <TableCell className="text-muted-foreground">{organisation.email}</TableCell>
                        <TableCell>
                          <Badge variant={organisation.plan === 'Enterprise' ? 'default' : 'secondary'}>
                            {organisation.plan}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={organisation.status === 'active' ? 'default' : 'outline'}>
                            {organisation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{organisation.mrr.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground">{organisation.joinedAt}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(organisation)}>View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditOrganisation(organisation)}>Edit Plan</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendEmail(organisation.id)}>Send Email</DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive" 
                                onClick={() => {
                                  setSelectedOrganisation(organisation);
                                  organisation.status === 'suspended' 
                                    ? setShowRestoreDialog(true) 
                                    : setShowSuspendDialog(true);
                                }}
                              >
                                {organisation.status === 'suspended' ? 'Restore Account' : 'Suspend Account'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest actions and events across all organisations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRecentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p>{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.user}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{activity.timestamp}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>
                  Detailed metrics and insights (Chart visualization would go here)
                </CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="size-12 mx-auto mb-4" />
                  <p>Advanced analytics charts would be displayed here</p>
                  <p className="text-sm">Using Recharts or similar charting library</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      {showManagementModal && (
        <OrganisationManagementModal
          isOpen={showManagementModal}
          organisation={selectedOrganisation}
          mode={modalMode}
          onClose={() => {
            setShowManagementModal(false);
            setSelectedOrganisation(null);
          }}
          onSave={handleSaveOrganisation}
        />
      )}

      {showDetailsModal && selectedOrganisation && (
        <OrganisationDetailsModal
          isOpen={showDetailsModal}
          organisation={selectedOrganisation}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOrganisation(null);
          }}
        />
      )}

      {/* Suspend Confirmation Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Organisation Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend "{selectedOrganisation?.name}" and prevent users from accessing their account.
              You can restore the account later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspendOrganisation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Suspend Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Organisation Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore "{selectedOrganisation?.name}" and allow users to access their account again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreOrganisation}>
              Restore Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}