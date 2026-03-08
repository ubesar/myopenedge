// --- NEW UI LAYOUT --- Mobile-only header with hamburger
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, LogOut, FileText, Crown } from "lucide-react";
import logo from "@/assets/logo.png";

interface MobileHeaderProps {
  isActive: boolean;
  onSignOut: () => void;
}

const MobileHeader = ({ isActive, onSignOut }: MobileHeaderProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="lg:hidden border-b border-border/30 bg-card px-4 py-3 relative z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logo} alt="MyOpenEdge" className="h-7 w-7 rounded-full object-cover" />
          <span className="text-sm font-bold text-foreground lowercase">myopenedge</span>
          {isActive && (
            <span className="text-[9px] uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">
              pro
            </span>
          )}
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg hover:bg-muted/40">
          {menuOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
        </button>
      </div>

      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-card border-b border-border/30 shadow-xl z-50">
          <div className="p-3 space-y-1">
            <button
              onClick={() => { navigate("/docs"); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/40"
            >
              <FileText className="h-4 w-4" />
              <span className="lowercase">documentation</span>
            </button>
            {!isActive && (
              <button
                onClick={() => { navigate("/upgrade"); setMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10"
              >
                <Crown className="h-4 w-4" />
                <span className="lowercase">upgrade to pro</span>
              </button>
            )}
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/40"
            >
              <LogOut className="h-4 w-4" />
              <span className="lowercase">sign out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default MobileHeader;
