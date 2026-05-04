import { useEffect, useState } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { readStoredThemePreference, THEME_PREFERENCE_EVENT } from "@/hooks/useThemes";
import type { ThemePreference } from "@/hooks/useThemes";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<ToasterProps["theme"]>(() => (
    readStoredThemePreference().mode === "dark" ? "dark" : "light"
  ));

  useEffect(() => {
    const syncTheme = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };

    const handleThemePreference = (event: Event) => {
      const preference = (event as CustomEvent<ThemePreference>).detail;
      setTheme(preference?.mode === "dark" ? "dark" : "light");
    };

    syncTheme();
    window.addEventListener(THEME_PREFERENCE_EVENT, handleThemePreference);
    return () => window.removeEventListener(THEME_PREFERENCE_EVENT, handleThemePreference);
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
