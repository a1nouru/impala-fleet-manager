"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Employee } from "@/services/hrService";

export function DriverPicker({
  employees,
  value,
  onChange,
  invalid = false,
}: {
  employees: Employee[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const matches = employees.filter((e) => e.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={`w-full justify-between font-normal ${invalid ? "border-red-500" : ""}`}
        >
          {employees.find((e) => e.id === value)?.nome ?? "Select a driver"}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Input
          placeholder="Search drivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
        />
        <div className="max-h-48 overflow-y-auto space-y-1">
          {matches.map((e) => (
            <div
              key={e.id}
              className={`px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-accent ${value === e.id ? "bg-accent font-medium" : ""}`}
              onClick={() => {
                onChange(e.id);
                setOpen(false);
                setSearch("");
              }}
            >
              {e.nome}
            </div>
          ))}
          {matches.length === 0 && <p className="text-xs text-muted-foreground px-2 py-1">No drivers found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
