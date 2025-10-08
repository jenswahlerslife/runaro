export const Footer = () => {
  return (
    <footer className="border-t border-border bg-card mt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Runaro – urban running blog
          </p>
          <div className="flex gap-6 text-sm">
            <a href="mailto:hej@runaro.dk" className="hover:text-primary transition-smooth">
              Kontakt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
