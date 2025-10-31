import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import fabromLogo from "@/assets/fabrom-logo.png";
import galaxyBg from "@/assets/galaxy-background.jpg";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${galaxyBg})` }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <img 
            src={fabromLogo} 
            alt="FABROM" 
            className="h-8 sm:h-10 lg:h-12"
          />
          <span className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">FABROM</span>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Button 
            variant="outline"
            onClick={() => navigate("/auth")}
            className="bg-background/10 backdrop-blur-sm border-foreground/20 hover:bg-background/20 text-xs sm:text-sm px-3 sm:px-4"
            size="sm"
          >
            <span className="hidden sm:inline">Se connecter</span>
            <span className="sm:hidden">Connexion</span>
          </Button>
          <Button 
            onClick={() => navigate("/auth")}
            className="bg-gradient-to-r from-destructive to-[hsl(45,100%,50%)] hover:opacity-90 text-xs sm:text-sm px-3 sm:px-4"
            size="sm"
          >
            <span className="hidden sm:inline">Créer un compte</span>
            <span className="sm:hidden">S'inscrire</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center py-8 sm:py-12">
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">
          {/* Title with logo - responsive layout */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 lg:gap-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground">
              Créer avec
            </h1>
            <img 
              src={fabromLogo} 
              alt="FABROM" 
              className="h-10 sm:h-12 md:h-14 lg:h-16 xl:h-20 animate-fade-in"
            />
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground">
              FABROM
            </h1>
          </div>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold text-foreground animate-fade-in px-4">
            Le vibe code Congolais
          </p>
          
          {/* CTA Button */}
          <div className="mt-8 sm:mt-10 lg:mt-12 animate-scale-in">
            <Button 
              size="lg" 
              onClick={() => navigate("/editor")}
              className="text-base sm:text-lg lg:text-xl px-8 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6 bg-gradient-to-r from-destructive to-[hsl(45,100%,50%)] hover:opacity-90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              Commencer à coder
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 sm:py-6 text-muted-foreground px-4">
        <p className="text-xs sm:text-sm lg:text-base">
          Fièrement conçu par{" "}
          <a 
            href="https://oredtech.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-foreground font-semibold hover:text-primary transition-colors story-link"
          >
            Oredy TECHNOLOGIES
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Landing;
