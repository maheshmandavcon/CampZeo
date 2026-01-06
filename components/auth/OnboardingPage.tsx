/**
 * Onboarding Page Component
 * 
 * After sign-up, users complete their profile and create their tenant.
 */

import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Activity, Building2 } from 'lucide-react';

interface OnboardingPageProps {
  onComplete: () => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    organizationName: '',
    plan: 'FREE_TRIAL',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // =============================================
    // TODO: REPLACE WITH REAL API CALL
    // =============================================
    // This should create a tenant in the database
    // 
    // const response = await fetch('/api/onboarding', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     organizationName: formData.organizationName,
    //     plan: formData.plan,
    //   })
    // });
    // 
    // if (response.ok) {
    //   const { tenant } = await response.json();
    //   onComplete();
    // }
    // =============================================

    // Mock implementation
    setTimeout(() => {
      setIsLoading(false);
      onComplete();
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="size-8 text-primary" />
            </div>
          </div>
          <CardTitle>Welcome to SaaSify!</CardTitle>
          <CardDescription>
            Let's set up your organization to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.primaryEmailAddress?.emailAddress || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                placeholder="Acme Corp"
                value={formData.organizationName}
                onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Select Plan</Label>
              <Select 
                value={formData.plan} 
                onValueChange={(value:any) => setFormData({ ...formData, plan: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE_TRIAL">Free Trial (14 days)</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional - ₹2,999/month</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise - ₹9,999/month</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You can change your plan anytime
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Setting up...' : 'Complete Setup'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
