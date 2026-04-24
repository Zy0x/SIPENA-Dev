interface SipenaLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

// Logo sizes mapping
const sizeClasses = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-20 h-20",
};

export function SipenaLogo({ size = "md", className = "", showText = false }: SipenaLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} rounded-xl overflow-hidden shadow-lg shadow-primary/20 flex-shrink-0`}>
        <img 
          src="/icon.png" 
          alt="SIPENA Logo" 
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <div>
          <h1 className="font-bold text-lg text-foreground">SIPENA</h1>
          <p className="text-xs text-muted-foreground">Penilaian Akademik</p>
        </div>
      )}
    </div>
  );
}

// Icon-only version for smaller use cases
export function SipenaLogoIcon({ size = "md", className = "" }: Omit<SipenaLogoProps, "showText">) {
  return (
    <div className={`${sizeClasses[size]} rounded-xl overflow-hidden shadow-lg shadow-primary/20 flex-shrink-0 ${className}`}>
      <img 
        src="/icon.png" 
        alt="SIPENA Logo" 
        className="w-full h-full object-cover"
      />
    </div>
  );
}
