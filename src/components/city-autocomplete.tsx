import { useMemo, useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { POPULAR_CITIES } from "@/lib/cities";
import { cn } from "@/lib/utils";
import { Check, MapPin } from "lucide-react";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  id?: string;
  className?: string;
  maxSuggestions?: number;
  maxLength?: number;
  "aria-invalid"?: boolean;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder,
  autoComplete = "address-level2",
  required,
  id,
  className,
  maxSuggestions = 8,
  maxLength,
  "aria-invalid": ariaInvalid,
}: CityAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return POPULAR_CITIES.slice(0, maxSuggestions);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const c of POPULAR_CITIES) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q)) starts.push(c);
      else if (lc.includes(q)) contains.push(c);
      if (starts.length >= maxSuggestions) break;
    }
    return [...starts, ...contains].slice(0, maxSuggestions);
  }, [value, maxSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = (city: string) => {
    onChange(city);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && suggestions[activeIdx]) {
        e.preventDefault();
        select(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        aria-invalid={ariaInvalid}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-auto"
          role="listbox"
        >
          {suggestions.map((city, i) => {
            const isActive = i === activeIdx;
            const isSelected = city.toLowerCase() === value.trim().toLowerCase();
            return (
              <button
                key={city}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(city);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{city}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
