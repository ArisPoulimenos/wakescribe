'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Ship, Check, Loader2, Trash2 } from 'lucide-react';

export interface FleetVessel {
  id: string;
  name: string;
  length_meters: number;
  gross_tonnage: number;
  cruising_speed_knots: number;
  avg_fuel_burn_liters_per_hour: number;
  gen_burn_liters_per_hour: number;
  fuel_type: 'MGO' | 'HVO_Biofuel';
}

interface FleetSelectorProps {
  currentVessel: Omit<FleetVessel, 'id'>;
  selectedVesselId: string;
  onSelectVessel: (vessel: FleetVessel | null) => void;
  onVesselSaved: (saved: FleetVessel) => void;
}

export default function FleetSelector({
  currentVessel,
  selectedVesselId,
  onSelectVessel,
  onVesselSaved,
}: FleetSelectorProps) {
  const [fleet, setFleet] = useState<FleetVessel[]>([]);
  const [savingVessel, setSavingVessel] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const loadFleet = useCallback(async () => {
    const { data } = await supabase
      .from('vessels')
      .select('id, name, length_meters, gross_tonnage, cruising_speed_knots, avg_fuel_burn_liters_per_hour, gen_burn_liters_per_hour, fuel_type')
      .order('name', { ascending: true });
    if (data) setFleet(data as FleetVessel[]);
  }, []);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const handleSaveVesselToFleet = async () => {
    if (!currentVessel.name.trim()) return;
    setSavingVessel(true);
    setSavedNotice(false);
    try {
      const emissionFactor = currentVessel.fuel_type === 'HVO_Biofuel' ? 0.48 : 3.206;
      const { data: authData } = await supabase.auth.getUser();
      const payload = {
        user_id: authData.user?.id,
        name: currentVessel.name,
        length_meters: currentVessel.length_meters,
        gross_tonnage: currentVessel.gross_tonnage,
        cruising_speed_knots: currentVessel.cruising_speed_knots,
        avg_fuel_burn_liters_per_hour: currentVessel.avg_fuel_burn_liters_per_hour,
        gen_burn_liters_per_hour: currentVessel.gen_burn_liters_per_hour,
        fuel_type: currentVessel.fuel_type,
        emission_factor: emissionFactor,
      };

      if (selectedVesselId && selectedVesselId !== 'new') {
        const { data, error } = await supabase
          .from('vessels')
          .update(payload)
          .eq('id', selectedVesselId)
          .select()
          .single();
        if (!error && data) {
          onVesselSaved(data as FleetVessel);
          loadFleet();
          setSavedNotice(true);
        }
      } else {
        const { data, error } = await supabase
          .from('vessels')
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          onVesselSaved(data as FleetVessel);
          loadFleet();
          setSavedNotice(true);
        }
      }
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSavingVessel(false);
    }
  };

  const handleDeleteVessel = async () => {
    if (!selectedVesselId || selectedVesselId === 'new') return;
    await supabase.from('vessels').delete().eq('id', selectedVesselId);
    onSelectVessel(null);
    loadFleet();
  };

  return (
    <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
          <Ship className="w-3.5 h-3.5" /> Fleet Database ({fleet.length})
        </label>
        <div className="flex items-center gap-1.5">
          {selectedVesselId !== 'new' && (
            <button
              type="button"
              onClick={handleDeleteVessel}
              title="Remove yacht from fleet"
              className="text-[11px] bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/50 text-rose-300 px-2 py-1 rounded flex items-center transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveVesselToFleet}
            disabled={savingVessel}
            className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded flex items-center gap-1 transition"
          >
            {savingVessel ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : savedNotice ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : null}
            {savedNotice
              ? 'Saved!'
              : selectedVesselId === 'new'
              ? '+ Save to Fleet'
              : 'Update Specs'}
          </button>
        </div>
      </div>

      <select
        value={selectedVesselId}
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'new') {
            onSelectVessel(null);
          } else {
            const found = fleet.find((v) => v.id === val) || null;
            onSelectVessel(found);
          }
        }}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-medium"
      >
        <option value="new">+ Add New Yacht (Manual Specs)</option>
        {fleet.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.length_meters}m | {v.gross_tonnage} GT | {v.avg_fuel_burn_liters_per_hour} L/hr)
          </option>
        ))}
      </select>
    </div>
  );
}

