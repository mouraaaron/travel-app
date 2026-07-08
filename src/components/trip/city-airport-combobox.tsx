"use client";

import { useId, useRef, useState } from "react";
import { findAirportByCode, searchAirports, type AirportOption } from "@/lib/airports";
import { cn } from "@/lib/utils";

export function CityAirportCombobox({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  placeholder: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const options = open ? searchAirports(query) : [];

  function handleSelect(option: AirportOption) {
    onChange(option.code);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
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
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-input bg-popover shadow-md">
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                )}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
