"use client";

import { useActionState, useEffect, useMemo, useState, startTransition } from "react";
import { loadReadingMapAction } from "@/actions/reading-map";
import { initialReadingMapActionState } from "@/schemas/reading-map";
import { MapPanel } from "./map-panel";
import { CountrySidebar } from "./country-sidebar";
import { CountryAssignmentModal } from "./country-assignment-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function ReadingMapClient() {
  const [state, formAction, pending] = useActionState(
    loadReadingMapAction,
    initialReadingMapActionState
  );
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const form = new FormData();
    startTransition(() => formAction(form));
  }, [formAction]);

  const { entries, country_counts } = state.data;
  const hasData = entries?.length > 0;

  const filteredEntries = useMemo(() => {
    if (!selectedCountry || !entries) return [];
    return entries.filter(
      (e) => e.countries && e.countries.some((c) => c.country_code === selectedCountry)
    );
  }, [selectedCountry, entries]);

  const handleCountryClick = (code) => {
    setSelectedCountry((prev) => (prev === code ? null : code));
  };

  return (
    <>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-[var(--paper)]">
        <MapPanel
          countryCounts={country_counts || {}}
          selectedCountry={selectedCountry}
          onCountryClick={handleCountryClick}
          pending={pending}
        />
        {/* Manage countries button */}
        <div className="absolute right-4 top-4 z-10">
          <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
            <Plus className="size-3.5" />管理国家
          </Button>
        </div>
      </div>
      <CountrySidebar
        countryCounts={country_counts || {}}
        entries={filteredEntries}
        selectedCountry={selectedCountry}
        onCountryClick={handleCountryClick}
        pending={pending}
        hasData={hasData}
      />
      <CountryAssignmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        entries={entries || []}
      />
    </>
  );
}
