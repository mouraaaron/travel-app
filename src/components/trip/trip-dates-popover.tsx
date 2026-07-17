"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatFormDate,
  formatTripDateLabel,
  isConfirmEnabled,
  parseFormDate,
} from "@/components/trip/trip-dates-popover-utils";

type TripDatesPopoverProps =
  | {
      mode: "single";
      date: string;
      onChange: (value: string) => void;
      minDate?: Date;
    }
  | {
      mode: "range";
      departureDate: string;
      returnDate: string | undefined;
      onChangeDeparture: (value: string) => void;
      onChangeReturn: (value: string | undefined) => void;
      minDate?: Date;
    };

export function TripDatesPopover(props: TripDatesPopoverProps) {
  const [open, setOpen] = useState(false);

  if (props.mode === "single") {
    const { date, onChange, minDate } = props;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            {formatTripDateLabel(date, "single")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start">
          <Calendar
            mode="single"
            numberOfMonths={1}
            selected={parseFormDate(date)}
            defaultMonth={parseFormDate(date) ?? minDate}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(selected) => {
              if (!selected) return;
              onChange(formatFormDate(selected));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  const { departureDate, returnDate, onChangeDeparture, onChangeReturn, minDate } = props;
  const range: DateRange = {
    from: parseFormDate(departureDate),
    to: parseFormDate(returnDate),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          {formatTripDateLabel(departureDate, "range", returnDate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          defaultMonth={range.from ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(selected) => {
            onChangeDeparture(selected?.from ? formatFormDate(selected.from) : "");
            onChangeReturn(selected?.to ? formatFormDate(selected.to) : undefined);
          }}
        />
        <div className="flex justify-end border-t border-border p-3">
          <Button
            type="button"
            size="sm"
            disabled={!isConfirmEnabled(departureDate)}
            onClick={() => setOpen(false)}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
