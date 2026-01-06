import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState } from 'react';

interface Organisation {
  id: number;
  name: string;
  email: string;
  plan: string;
  status: string;
  mrr: number;
  joinedAt: string;
}

interface OrganisationManagementModalProps {
  isOpen: boolean;
  organisation: Organisation | null;
  mode: 'add' | 'edit';
  onClose: () => void;
  onSave: (organisation: Partial<Organisation>) => void;
}

export function OrganisationManagementModal({ isOpen, organisation, mode, onClose, onSave }: OrganisationManagementModalProps) {
  const [formData, setFormData] = useState({
    name: organisation?.name || '',
    email: organisation?.email || '',
    plan: organisation?.plan || 'Professional',
    status: organisation?.status || 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // =============================================
    // TODO: REPLACE WITH REAL API CALL
    // =============================================
    // if (mode === 'add') {
    //   await fetch('/api/admin/organisations', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       name: formData.name,
    //       email: formData.email,
    //       plan: formData.plan,
    //       status: formData.status
    //     })
    //   })
    // } else {
    //   await fetch(`/api/admin/organisations/${organisation.id}`, {
    //     method: 'PATCH',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(formData)
    //   })
    // }
    // =============================================
    
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add New Organisation' : 'Edit Organisation'}</DialogTitle>
          <DialogDescription>
            {mode === 'add' 
              ? 'Create a new organisation. They will receive an invitation email.'
              : 'Update organisation information and subscription details.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organisation Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Acme Corp"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Contact Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@acme.com"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Select 
              value={formData.plan} 
              onValueChange={(value) => setFormData({ ...formData, plan: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Free Trial">Free Trial</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {mode === 'add' ? 'Create Organisation' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}