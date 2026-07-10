"use client";

import { useId, useRef, useState } from "react";
import { findAirportByCode, searchAirports, type AirportOption } from "@/lib/airports";
import { cn } from "@/lib/utils";

export function CityAirportCombobox({
  value,
  onChange,
  label,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const options = open && query.trim().length >= 2 ? searchAirports(query) : [];

  function handleSelect(option: AirportOption) {
    onChange(option.code);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      />
      {open && options.length > 0 ? (
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                )}
              >
                <span className="flex h-6 min-w-[2.75rem] items-center justify-center rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                  {option.code}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
