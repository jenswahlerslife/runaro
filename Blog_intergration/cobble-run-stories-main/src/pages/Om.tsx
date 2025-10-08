import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Om = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-16 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-headline font-bold mb-8 tracking-tight">
            Runaro
          </h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-xl text-muted-foreground mb-8">
              København er vores løbebane. Fra brosten på Nørrebro til havnefronten ved Islands Brygge.
            </p>

            <h2 className="text-3xl font-headline font-bold mt-12 mb-4">Manifest</h2>
            <p>
              Vi løber ikke for at flygte fra byen. Vi løber for at opleve den.
            </p>
            <p>
              Intervaller mellem cykler. Longruns langs havnen. Fællesløb på Amager Fælled.
            </p>
            <p>
              Runaro handler om at dele ruter, træning, og urban running culture. Uden BS. Bare løb.
            </p>

            <h2 className="text-3xl font-headline font-bold mt-12 mb-4">Kontakt</h2>
            <p>
              Skriv til os på{" "}
              <a href="mailto:hej@runaro.dk" className="text-primary hover:underline">
                hej@runaro.dk
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Om;
