import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Play, Gamepad2 } from 'lucide-react';
import { BlogPreviewSection } from '@/components/blog/BlogPreviewSection';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout
      backgroundClassName="bg-[#050818]"
      mainClassName="px-4 py-16 md:py-20"
    >
      <div className="flex flex-col items-center gap-16 pb-12">
        <section className="w-full max-w-5xl">
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-[#2959ff] via-[#394eff] to-[#8e2dff] p-10 shadow-[0_52px_120px_-50px_rgba(51,95,255,0.85)]">
            <div className="absolute inset-0 bg-black/10 mix-blend-overlay" aria-hidden />
            <div className="relative flex flex-col items-center gap-6 text-center text-white">
              <div className="flex items-center justify-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <Gamepad2 className="h-7 w-7" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                  Territorielt Spil
                </h1>
              </div>
              <p className="max-w-2xl text-lg text-white/90 sm:text-xl">
                Konkurrér med venner i territoriale kampe ved hjælp af dine løberuter. Udvid dit territorium og erobr kortet!
              </p>
              <Button
                size="lg"
                asChild
                className="px-8 py-3 text-lg font-semibold text-primary-foreground shadow-lg shadow-blue-900/40"
              >
                <Link to="/leagues">
                  <Play className="mr-2 h-5 w-5" />
                  Start Spil
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="w-full max-w-6xl">
          <BlogPreviewSection />
        </section>
      </div>
    </Layout>
  );
};

export default Index;
