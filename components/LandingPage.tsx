import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Check, Zap, Shield, BarChart3, Users, Star, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { PaymentModal } from './PaymentModal';
import { SignInButton, SignUpButton, SignedOut, SignedIn, UserButton } from '@clerk/clerk-react';

interface LandingPageProps {
  onLogin: (role: 'admin' | 'organisation') => void;
  onNavigate: (view: 'landing' | 'admin' | 'organisation') => void;
}

type Plan = {
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  isTrial?: boolean;
  isPopular?: boolean;
  priceId?: string;
};

const plans: Plan[] = [
  {
    name: 'Free Trial',
    price: 0,
    period: '14 days',
    description: 'Try all features for free',
    isTrial: true,
    features: [
      'Up to 5 users',
      'Basic analytics',
      'Email support',
      'Core features access',
      '5GB storage',
      'Community support'
    ]
  },
  {
    name: 'Professional',
    price: 2999,
    period: 'month',
    description: 'Perfect for growing teams',
    isPopular: true,
    priceId: 'plan_pro_monthly',
    features: [
      'Unlimited users',
      'Advanced analytics',
      'Priority support',
      'All features unlocked',
      '100GB storage',
      'Custom integrations',
      'API access',
      'White-label options'
    ]
  },
  {
    name: 'Enterprise',
    price: 9999,
    period: 'month',
    description: 'For large organizations',
    priceId: 'plan_enterprise_monthly',
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom SLA',
      'Unlimited storage',
      'Advanced security',
      'Custom contracts',
      'On-premise deployment option'
    ]
  }
];

export function LandingPage({ onLogin, onNavigate }: LandingPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handlePlanSelect = (plan: Plan) => {
    if (plan.isTrial) {
      // =============================================
      // TODO: REPLACE WITH CLERK SIGN UP
      // =============================================
      // In production, redirect to Clerk sign-up with trial metadata:
      //
      // import { useSignUp } from '@clerk/nextjs'
      // const { signUp } = useSignUp()
      // 
      // await signUp.create({
      //   emailAddress: email,
      //   password: password,
      //   unsafeMetadata: {
      //     plan: 'FREE_TRIAL',
      //     trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      //   }
      // })
      //
      // Then in Clerk webhook, create organisation with trial:
      // await prisma.organisation.create({
      //   data: {
      //     plan: 'FREE_TRIAL',
      //     status: 'TRIAL',
      //     trialEndsAt: userData.unsafeMetadata.trialEndsAt
      //   }
      // })
      // =============================================
      
      // Start free trial - mock Clerk signup
      alert('Starting free trial! You would be redirected to sign up with Clerk.');
      // In production: Redirect to Clerk sign-up with trial metadata
      onLogin('organisation');
    } else {
      // Show payment modal for paid plans
      setSelectedPlan(plan);
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    // =============================================
    // TODO: HANDLE SUCCESSFUL PAYMENT
    // =============================================
    // After successful payment verification:
    // 1. Backend has already created/updated organisation in database
    // 2. Backend has recorded payment in Payment table
    // 3. Backend has logged activity
    // 4. Now redirect user to dashboard
    //
    // The payment verification API should return:
    // { success: true, organisation: {...}, redirectUrl: '/dashboard' }
    // =============================================
    
    setShowPaymentModal(false);
    // Mock successful payment and account creation
    alert('Payment successful! Your account has been created.');
    onLogin('organisation');
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b z-50">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Zap className="size-8 text-primary" />
              <span className="font-semibold">SaaSify</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground">
                Pricing
              </a>
              <a href="#about" className="text-muted-foreground hover:text-foreground">
                About
              </a>
            </div>
            <div className="flex items-center gap-4">
              <SignedOut>
                <div className="flex items-center gap-3">
                  <SignUpButton>
                    <button className="px-3 py-2 text-primary border border-primary rounded-md hover:bg-primary/10">
                      Sign Up
                    </button>
                  </SignUpButton>

                  <SignInButton>
                    <button className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                      Sign In
                    </button>
                  </SignInButton>
                </div>
              </SignedOut>
              
              <SignedIn>
                <UserButton />
              </SignedIn>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className=" mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            🚀 Now with AI-powered insights
          </Badge>
          <h1 className="mb-6 max-w-4xl mx-auto">
            The Complete SaaS Platform for Modern Teams
          </h1>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamline your workflow, boost productivity, and scale your business with our all-in-one platform. 
            Start your free 14-day trial today, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => handlePlanSelect(plans[0])}>
              Start Free Trial
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              View Pricing
            </Button>
          </div>
          <div className="mt-16 flex justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              14-day free trial
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              No credit card required
            </div>
            <div className="flex items-center gap-2">
              <Check className="size-4 text-green-500" />
              Cancel anytime
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className=" mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-4">Powerful Features for Every Team</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage, scale, and optimize your business operations
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <BarChart3 className="size-12 text-primary mb-4" />
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Get deep insights into your business metrics with real-time dashboards and custom reports
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="size-12 text-primary mb-4" />
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Bank-level encryption, SOC 2 compliance, and advanced access controls to keep your data safe
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Users className="size-12 text-primary mb-4" />
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>
                  Work seamlessly with your team using shared workspaces, comments, and real-time updates
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className=" mx-auto">
          <div className="text-center mb-16">
            <h2 className="mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the perfect plan for your needs. Start with a free trial or go straight to a paid plan.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative ${plan.isPopular ? 'border-primary shadow-lg' : ''}`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1">
                      <Star className="size-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl">
                      {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/{plan.period}</span>
                    )}
                    {plan.isTrial && (
                      <span className="text-muted-foreground"> for {plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="size-5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={plan.isPopular ? 'default' : 'outline'}
                    onClick={() => handlePlanSelect(plan)}
                  >
                    {plan.isTrial ? 'Start Free Trial' : 'Purchase Now'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>


      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="mb-4 text-primary-foreground">Ready to Get Started?</h2>
          <p className="mb-8 text-primary-foreground/90">
            Join thousands of teams already using SaaSify to streamline their operations
          </p>
          <Button size="lg" variant="secondary" onClick={() => handlePlanSelect(plans[0])}>
            Start Your Free Trial
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className=" mx-auto text-center text-muted-foreground text-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="size-6 text-primary" />
            <span className="font-semibold text-foreground">SaaSify</span>
          </div>
          <p>© 2025 SaaSify. All rights reserved.</p>
        </div>
      </footer>

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}