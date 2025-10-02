import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Check, Crown, Users, Trophy, Calendar, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDate } from '@/lib/format';

export default function Subscription() {
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subscriptionLoading, checkSubscription, isPro, isFree } = useSubscription();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Early returns after hooks
  if (authLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Call Stripe checkout function (to be implemented)
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId: import.meta.env.VITE_STRIPE_PRICE_ID || 'price_1234567890', // Will be replaced with actual price ID
          successUrl: `${window.location.origin}/subscription?success=true`,
          cancelUrl: `${window.location.origin}/subscription`
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke starte betalingsprocessen. Prøv igen senere.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      // Call Stripe customer portal function (to be implemented)
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: {
          returnUrl: `${window.location.origin}/subscription`
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Fejl",
        description: "Kunne ikke åbne konto-panelet. Prøv igen senere.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Using shared date formatter from lib/format

  return (
    <Layout>
      <div className="space-y-6">
        {/* Back button */}
        <div className="flex justify-start">
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tilbage til Home
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
            <Crown className="h-8 w-8 text-primary" />
            Abonnement
          </h1>
          <p className="text-muted-foreground">
            Vælg den plan der passer til dig
          </p>
        </div>

        {/* Current subscription status */}
        {subscription && (
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant={isPro ? "default" : "secondary"}>
                  {isPro ? "Pro" : "Free"}
                </Badge>
                Nuværende plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Status: {subscription.is_active ? "Aktiv" : "Inaktiv"}
                </p>
                {subscription.subscription_end && (
                  <p className="text-sm text-muted-foreground">
                    {isPro ? "Fornyes" : "Udløber"}: {formatDate(subscription.subscription_end)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <Card className={`relative ${isFree ? 'border-primary' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Free Runner
                </CardTitle>
                {isFree && <Badge>Aktuel</Badge>}
              </div>
              <CardDescription>
                Kom i gang med territorio-kampe
              </CardDescription>
              <div className="text-3xl font-bold">
                Gratis
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Maks 3 medlemmer per liga</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">1 spil per måned</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Spil varighed: 1-14 dage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Basis funktioner</span>
                  </div>
                </div>
                
                {!isFree && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled
                  >
                    Nuværende plan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className={`relative ${isPro ? 'border-primary' : 'border-2 border-primary/50'}`}>
            {!isPro && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  Anbefalet
                </Badge>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  Pro Athlete
                </CardTitle>
                {isPro && <Badge>Aktuel</Badge>}
              </div>
              <CardDescription>
                For seriøse løbere og store ligaer
              </CardDescription>
              <div className="text-3xl font-bold">
                29 kr <span className="text-lg font-normal text-muted-foreground">/måned</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Maks 50 medlemmer per liga</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Ubegrænsede spil</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Spil varighed: 14-30 dage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Avanceret analyse</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Prioritet support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Tilpassede badges</span>
                  </div>
                </div>
                
                {isPro ? (
                  <Button 
                    onClick={handleManageSubscription}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-r-transparent"></div>
                        Åbner...
                      </div>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Administrer abonnement
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleUpgrade}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-r-transparent"></div>
                        Starter...
                      </div>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Opgrader til Pro
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ or additional info */}
        <Card>
          <CardHeader>
            <CardTitle>Ofte stillede spørgsmål</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Kan jeg ændre min plan når som helst?</h4>
                <p className="text-sm text-muted-foreground">
                  Ja, du kan opgradere eller nedgradere din plan når som helst. Ændringer træder i kraft ved næste faktureringsperiode.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Hvad sker der hvis jeg downgrader?</h4>
                <p className="text-sm text-muted-foreground">
                  Dine eksisterende ligaer og spil påvirkes ikke, men nye ligaer vil være begrænset til Free-plan funktioner.
                </p>
              </div>
              <div>
                <h4 className="font-medium">Kan jeg få refundering?</h4>
                <p className="text-sm text-muted-foreground">
                  Du kan annullere dit abonnement når som helst. Der gives ingen refundering for den aktuelle måned.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
