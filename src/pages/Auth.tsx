import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);
    
    if (error) {
      // Handle email not confirmed error specifically
      if (error.message?.toLowerCase().includes('email not confirmed')) {
        setError('Din email er ikke bekræftet endnu. Tjek din indbakke og klik på bekræftelseslinket.');
      } else {
        setError(error.message);
      }
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!username) {
      setError('Brugernavn er påkrævet');
      setLoading(false);
      return;
    }

    if (!displayName || displayName.length < 2 || displayName.length > 50) {
      setError('Navn skal være mellem 2 og 50 tegn');
      setLoading(false);
      return;
    }

    const ageNum = parseInt(age);
    if (!age || isNaN(ageNum) || ageNum < 5 || ageNum > 120) {
      setError('Alder skal være mellem 5 og 120');
      setLoading(false);
      return;
    }

    const result = await signUp(email, password, username, displayName, ageNum);
    
    if (result.error) {
      setError(result.error.message);
    } else if (result.needsConfirmation) {
      setError('✅ Vi har sendt dig et bekræftelseslink. Tjek din email og klik på linket for at aktivere din konto.');
      setShowResend(true);
    } else {
      // User was auto-confirmed
      setError('✅ Tilmelding gennemført og bekræftet!');
      setShowResend(false);
    }
    
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Indtast din email-adresse først');
      return;
    }

    setLoading(true);
    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || 
        (typeof window !== 'undefined' ? window.location.origin : 'https://runaro.dk');
        
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${siteUrl}/auth` },
      });

      if (error) {
        setError(`Fejl ved gensendelse: ${error.message}`);
      } else {
        setError('✅ Nyt bekræftelseslink er sendt til din email.');
      }
    } catch (err) {
      setError('Der opstod en fejl ved gensendelse af bekræftelseslink.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-6">
          <div className="flex justify-center mb-6">
            <img src="/lovable-uploads/e5d5e0c5-6573-4ca7-823e-08d5d7708873.png" alt="Runaro" className="h-16 w-auto" />
          </div>
          <CardDescription className="text-center text-lg font-medium text-muted-foreground">
            Erobre verden, ét skridt ad gangen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Log Ind</TabsTrigger>
              <TabsTrigger value="signup">Tilmeld</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Indtast din email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Adgangskode</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Indtast din adgangskode"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 mt-6" disabled={loading}>
                  {loading ? 'Logger ind...' : 'Log Ind'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-sm font-medium">Navn *</Label>
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Dit fulde navn"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={50}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-sm font-medium">Alder *</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="Din alder"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                      min={5}
                      max={120}
                      className="h-11"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">Brugernavn</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Vælg et brugernavn"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Indtast din email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium">Adgangskode</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Opret en adgangskode"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                
                <Button type="submit" className="w-full h-11 mt-6" disabled={loading}>
                  {loading ? 'Opretter konto...' : 'Tilmeld'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          {error && (
            <Alert className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showResend && (
            <div className="mt-4 text-center">
              <Button 
                variant="outline" 
                onClick={handleResendConfirmation} 
                disabled={loading}
                className="text-sm"
              >
                Send bekræftelseslink igen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;