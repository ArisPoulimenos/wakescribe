'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { generateCharterPdf } from '@/lib/generateCharterPdf';
import AiDocumentScanner from '@/components/AiDocumentScanner';
import FleetSelector, { FleetVessel } from '@/components/FleetSelector';
import AuthGate from '@/components/AuthGate';
import {
  Ship,
  Fuel,
  Leaf,
  Wallet,
  Plus,
  FileText,
  Anchor,
  AlertCircle,
  Zap,
  Save,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  Download,
  Trash2,
  LogOut,
} from 'lucide-react';

interface SavedCharter {
  id: string;
  vessel_id: string;
  charter_code: string;
  client_name: string;
  embarkation_port: string;
  disembarkation_port: string;
  apa_received_eur: number;
  created_at: string;
  vessels: FleetVessel | null;
}

export default function WakeScribeDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [carbonPrice, setCarbonPrice] = useState<number>(84.85);
  const [lastRateSync, setLastRateSync] = useState<string | null>(null);
  const [syncingRate, setSyncingRate] = useState(false);
  const [ecoTips, setEcoTips] = useState<{ id: string; category: string; tip_text: string }[]>([]);

  const [brokerageName, setBrokerageName] = useState('Aegean Yachting Partners');
  const [charterCode, setCharterCode] = useState('CHR-2027-01');
  const [clientName, setClientName] = useState('A. Papadopoulos');

  const [selectedVesselId, setSelectedVesselId] = useState<string>('new');
  const [vesselName, setVesselName] = useState('M/Y Apekoula');
  const [lengthMeters, setLengthMeters] = useState<number>(34);
  const [grossTonnage, setGrossTonnage] = useState<number>(240);
  const [fuelType, setFuelType] = useState<'MGO' | 'HVO_Biofuel'>('MGO');

  const [departurePort, setDeparturePort] = useState('Athens (Flisvos)');
  const [arrivalPort, setArrivalPort] = useState('Mykonos');
  const [charterDays, setCharterDays] = useState<number>(7);
  const [distanceNm, setDistanceNm] = useState<number>(95);
  const [cruisingSpeed, setCruisingSpeed] = useState<number>(14);
  const [mainBurnLph, setMainBurnLph] = useState<number>(280);
  const [genBurnLph, setGenBurnLph] = useState<number>(18);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number>(1.15);

  const [apaReceived, setApaReceived] = useState<number>(25000);
  const [expenses, setExpenses] = useState<{ id: number; category: string; vendor: string; amount: number }[]>([]);
  const [newVendor, setNewVendor] = useState('');
  const [newCategory, setNewCategory] = useState('Marina_Berthing');
  const [newAmount, setNewAmount] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedCharters, setSavedCharters] = useState<SavedCharter[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSyncLiveEua = useCallback(async () => {
    setSyncingRate(true);
    try {
      const res = await fetch('/api/sync-eua', { method: 'POST' });
      const data = await res.json();
      if (data.updated && data.price) {
        setCarbonPrice(Number(data.price));
        setLastRateSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } finally {
      setSyncingRate(false);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('broker_profiles')
      .select('brokerage_name')
      .eq('user_id', user.id)
      .single();
    if (profile?.brokerage_name) {
      setBrokerageName(profile.brokerage_name);
    }

    const { data: rates } = await supabase.from('market_rates').select('*');
    if (rates) {
      const eua = rates.find((r) => r.indicator_name === 'EU Carbon Permits');
      if (eua) {
        setCarbonPrice(Number(eua.price));
        const updatedAt = new Date(eua.updated_at).getTime();
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - updatedAt > oneHour) {
          handleSyncLiveEua();
        } else {
          setLastRateSync(new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      }
    }

    const { data: tips } = await supabase.from('eco_tips').select('*');
    if (tips && tips.length > 0) setEcoTips(tips);

    const { data: charters } = await supabase
      .from('charters')
      .select('id, vessel_id, charter_code, client_name, embarkation_port, disembarkation_port, apa_received_eur, created_at, vessels(*)')
      .order('created_at', { ascending: false })
      .limit(10);
    if (charters) setSavedCharters(charters as unknown as SavedCharter[]);
  }, [user, handleSyncLiveEua]);

  useEffect(() => {
    if (!user) return;
    loadInitialData();
    const intervalId = setInterval(() => {
      handleSyncLiveEua();
    }, 60 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [user, loadInitialData, handleSyncLiveEua]);

  if (!authChecked) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!user) {
    return <AuthGate />;
  }

  const handleLoadCharter = async (c: SavedCharter) => {
    setCharterCode(c.charter_code);
    setClientName(c.client_name);
    setDeparturePort(c.embarkation_port || 'Athens (Flisvos)');
    setArrivalPort(c.disembarkation_port || 'Mykonos');
    setApaReceived(Number(c.apa_received_eur) || 0);

    if (c.vessels) {
      setSelectedVesselId(c.vessels.id);
      setVesselName(c.vessels.name);
      setLengthMeters(Number(c.vessels.length_meters) || 34);
      setGrossTonnage(Number(c.vessels.gross_tonnage) || 240);
      setCruisingSpeed(Number(c.vessels.cruising_speed_knots) || 14);
      setMainBurnLph(Number(c.vessels.avg_fuel_burn_liters_per_hour) || 280);
      setGenBurnLph(Number(c.vessels.gen_burn_liters_per_hour) || 18);
      setFuelType(c.vessels.fuel_type === 'HVO_Biofuel' ? 'HVO_Biofuel' : 'MGO');
    }

    const { data: vLogs } = await supabase
      .from('voyage_logs')
      .select('*')
      .eq('charter_id', c.id)
      .limit(1);
    if (vLogs && vLogs[0]) {
      setDistanceNm(Number(vLogs[0].distance_nm) || 95);
    }

    const { data: apaRows } = await supabase
      .from('apa_expenses')
      .select('*')
      .eq('charter_id', c.id);
    if (apaRows) {
      setExpenses(
        apaRows.map((r, idx) => ({
          id: Date.now() + idx,
          category: r.category,
          vendor: r.vendor_name,
          amount: Number(r.amount_eur),
        }))
      );
    }
    setSaveMessage(`Loaded charter ${c.charter_code} (${c.vessels?.name || ''})`);
  };

  const sailingHours = cruisingSpeed > 0 ? distanceNm / cruisingSpeed : 0;
  const totalGeneratorHours = charterDays * 24;
  const mainEngineLiters = sailingHours * mainBurnLph;
  const generatorLiters = totalGeneratorHours * genBurnLph;
  const totalLiters = mainEngineLiters + generatorLiters;

  const fuelConsumedMt = (totalLiters * 0.85) / 1000;
  const estimatedFuelCost = totalLiters * fuelPricePerLiter;

  const emissionFactor = fuelType === 'MGO' ? 3.206 : 0.48;
  const co2EmissionsMt = fuelConsumedMt * emissionFactor;
  const carbonIntensityKgNm = distanceNm > 0 ? (co2EmissionsMt * 1000) / distanceNm : 0;
  const carbonCostEur = co2EmissionsMt * carbonPrice;
  const isMandatoryEuEts = grossTonnage >= 5000;

  const totalOtherExpenses = expenses.reduce((acc, item) => acc + item.amount, 0);
  const totalApaSpent = totalOtherExpenses + estimatedFuelCost;
  const apaBalance = apaReceived - totalApaSpent;

  const activeTip =
    ecoTips.length > 0
      ? generatorLiters > mainEngineLiters * 0.4
        ? ecoTips.find((t) => t.id === 'TIP2') || ecoTips[0]
        : carbonIntensityKgNm > 95
        ? ecoTips.find((t) => t.id === 'TIP1') || ecoTips[0]
        : ecoTips.find((t) => t.id === 'TIP5') || ecoTips[0]
      : {
          category: 'Speed Optimization',
          tip_text: 'A 1-knot speed reduction on this route lowers fuel burn by ~12%, saving fuel and CO2.',
        };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor || !newAmount) return;
    setExpenses([
      ...expenses,
      { id: Date.now(), category: newCategory, vendor: newVendor, amount: parseFloat(newAmount) },
    ]);
    setNewVendor('');
    setNewAmount('');
  };

  const handleExportPdf = () => {
    generateCharterPdf({
      brokerageName,
      charterCode,
      clientName,
      vesselName,
      lengthMeters,
      grossTonnage,
      fuelType,
      departurePort,
      arrivalPort,
      charterDays,
      distanceNm,
      cruisingSpeed,
      mainEngineLiters,
      generatorLiters,
      totalLiters,
      fuelConsumedMt,
      fuelPricePerLiter,
      estimatedFuelCost,
      co2EmissionsMt,
      carbonIntensityKgNm,
      carbonPrice,
      carbonCostEur,
      isMandatoryEuEts,
      apaReceived,
      expenses,
      apaBalance,
      ecoTipCategory: activeTip.category,
      ecoTipText: activeTip.tip_text,
    });
  };

  const handleSaveCharter = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      // Save Brokerage Name to profile
      await supabase.from('broker_profiles').upsert({
        user_id: user.id,
        brokerage_name: brokerageName,
        contact_email: user.email,
      });

      let activeVesselId = selectedVesselId;
      if (!activeVesselId || activeVesselId === 'new') {
        const { data: vessel, error: vErr } = await supabase
          .from('vessels')
          .insert({
            user_id: user.id,
            name: vesselName,
            length_meters: lengthMeters,
            gross_tonnage: grossTonnage,
            cruising_speed_knots: cruisingSpeed,
            avg_fuel_burn_liters_per_hour: mainBurnLph,
            gen_burn_liters_per_hour: genBurnLph,
            fuel_type: fuelType,
            emission_factor: emissionFactor,
          })
          .select()
          .single();
        if (vErr) throw vErr;
        activeVesselId = vessel.id;
        setSelectedVesselId(vessel.id);
      }

      const { data: charter, error: cErr } = await supabase
        .from('charters')
        .insert({
          user_id: user.id,
          vessel_id: activeVesselId,
          charter_code: charterCode,
          client_name: clientName,
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + charterDays * 86400000).toISOString().split('T')[0],
          embarkation_port: departurePort,
          disembarkation_port: arrivalPort,
          apa_received_eur: apaReceived,
          status: 'active',
        })
        .select()
        .single();

      if (cErr) throw cErr;

      const fuelPricePerMt = fuelPricePerLiter / 0.00085;
      await supabase.from('voyage_logs').insert({
        charter_id: charter.id,
        vessel_id: activeVesselId,
        departure_port: departurePort,
        arrival_port: arrivalPort,
        distance_nm: distanceNm,
        fuel_consumed_mt: Number(fuelConsumedMt.toFixed(3)),
        fuel_price_per_mt_eur: Number(fuelPricePerMt.toFixed(2)),
        carbon_price_per_ton_eur: carbonPrice,
      });

      if (expenses.length > 0) {
        await supabase.from('apa_expenses').insert(
          expenses.map((exp) => ({
            charter_id: charter.id,
            category: exp.category,
            vendor_name: exp.vendor,
            amount_eur: exp.amount,
          }))
        );
      }

      setSaveMessage(`Saved (${charterCode} - ${vesselName})!`);
      loadInitialData();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || JSON.stringify(err);
      setSaveMessage(`Error: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Anchor className="w-7 h-7 text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-white">WakeScribe</h1>
          </div>
          <p className="text-sm text-cyan-400 font-medium tracking-widest uppercase mt-1 pl-9">
            Clean. Green. Win.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-sm">
            <span className="text-slate-400">EUA Carbon:</span>
            <span className="font-mono font-semibold text-emerald-400">€{carbonPrice.toFixed(2)}/t</span>
            {lastRateSync && <span className="text-[11px] text-slate-500">({lastRateSync})</span>}
            <button
              onClick={handleSyncLiveEua}
              disabled={syncingRate}
              title="Sync Live Market Rate (Auto-updates hourly)"
              className="text-slate-400 hover:text-cyan-400 transition ml-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingRate ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">Fuel:</span>
            <span className="font-mono font-semibold text-cyan-400">€{fuelPricePerLiter.toFixed(2)}/L</span>
          </div>

          <button
            onClick={handleExportPdf}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            Export PDF
          </button>

          <button
            onClick={handleSaveCharter}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition shadow-lg shadow-emerald-950/50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Charter'}
          </button>

          <button
            onClick={() => supabase.auth.signOut()}
            title={`Sign out (${user.email})`}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white p-2 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {saveMessage && (
        <div className="max-w-7xl mx-auto mb-6 bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {saveMessage}
        </div>
      )}

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Ship className="w-5 h-5 text-cyan-400" /> Yacht Specs & Route
            </h2>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isMandatoryEuEts
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {isMandatoryEuEts ? 'EU ETS Mandatory (≥5,000 GT)' : `${lengthMeters}m Charter Mode`}
            </span>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Brokerage / Agency Name (Saved to Profile)</label>
            <input
              type="text"
              value={brokerageName}
              onChange={(e) => setBrokerageName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-cyan-300 font-medium"
            />
          </div>

          <FleetSelector
            selectedVesselId={selectedVesselId}
            currentVessel={{
              name: vesselName,
              length_meters: lengthMeters,
              gross_tonnage: grossTonnage,
              cruising_speed_knots: cruisingSpeed,
              avg_fuel_burn_liters_per_hour: mainBurnLph,
              gen_burn_liters_per_hour: genBurnLph,
              fuel_type: fuelType,
            }}
            onSelectVessel={(v: FleetVessel | null) => {
              if (!v) {
                setSelectedVesselId('new');
                setVesselName('');
                return;
              }
              setSelectedVesselId(v.id);
              setVesselName(v.name);
              setLengthMeters(Number(v.length_meters) || 34);
              setGrossTonnage(Number(v.gross_tonnage) || 240);
              setCruisingSpeed(Number(v.cruising_speed_knots) || 14);
              setMainBurnLph(Number(v.avg_fuel_burn_liters_per_hour) || 280);
              setGenBurnLph(Number(v.gen_burn_liters_per_hour) || 18);
              setFuelType(v.fuel_type === 'HVO_Biofuel' ? 'HVO_Biofuel' : 'MGO');
            }}
            onVesselSaved={(saved: FleetVessel) => setSelectedVesselId(saved.id)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Yacht Name</label>
              <input
                type="text"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuel Type</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as 'MGO' | 'HVO_Biofuel')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              >
                <option value="MGO">Marine Diesel / MGO</option>
                <option value="HVO_Biofuel">HVO Biofuel (-85% CO2)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">LOA (Meters)</label>
              <input
                type="number"
                value={lengthMeters}
                onChange={(e) => setLengthMeters(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Gross Tonnage</label>
              <input
                type="number"
                value={grossTonnage}
                onChange={(e) => setGrossTonnage(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cruise (Knots)</label>
              <input
                type="number"
                value={cruisingSpeed}
                onChange={(e) => setCruisingSpeed(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Main Engines (L/hr)</label>
              <input
                type="number"
                value={mainBurnLph}
                onChange={(e) => setMainBurnLph(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Generators (L/hr)
              </label>
              <input
                type="number"
                value={genBurnLph}
                onChange={(e) => setGenBurnLph(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Charter Ref #</label>
              <input
                type="text"
                value={charterCode}
                onChange={(e) => setCharterCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Charterer / Client</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Embarkation</label>
              <input
                type="text"
                value={departurePort}
                onChange={(e) => setDeparturePort(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Disembarkation</label>
              <input
                type="text"
                value={arrivalPort}
                onChange={(e) => setArrivalPort(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Distance (NM)</label>
              <input
                type="number"
                value={distanceNm}
                onChange={(e) => setDistanceNm(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Charter Days</label>
              <input
                type="number"
                value={charterDays}
                onChange={(e) => setCharterDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fuel (€/Liter)</label>
              <input
                type="number"
                step="0.01"
                value={fuelPricePerLiter}
                onChange={(e) => setFuelPricePerLiter(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              Operational Insight | {activeTip.category}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{activeTip.tip_text}</p>
          </div>
        </section>

        <section className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Fuel className="w-4 h-4 text-cyan-400" /> Total Fuel
              </div>
              <div className="text-2xl font-bold mt-2">{Math.round(totalLiters).toLocaleString()} L</div>
              <div className="text-xs text-cyan-400 mt-1">
                {fuelConsumedMt.toFixed(2)} MT (€{estimatedFuelCost.toFixed(0)})
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Leaf className="w-4 h-4 text-emerald-400" /> CO2 Footprint
              </div>
              <div className="text-2xl font-bold mt-2">{co2EmissionsMt.toFixed(2)} MT</div>
              <div className="text-xs text-slate-400 mt-1">{carbonIntensityKgNm.toFixed(1)} kg CO2/NM</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                {isMandatoryEuEts ? 'EU ETS Liability' : 'Carbon Offset'}
              </div>
              <div className="text-2xl font-bold mt-2">€{carbonCostEur.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-1">
                {isMandatoryEuEts ? 'Compliance cost' : '1-Click Green Charter'}
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Wallet className="w-4 h-4 text-indigo-400" /> APA Balance
              </div>
              <div className={`text-2xl font-bold mt-2 ${apaBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                €{apaBalance.toFixed(0)}
              </div>
              <div className="text-xs text-slate-400 mt-1">of €{apaReceived.toLocaleString()} APA</div>
            </div>
          </div>

          <AiDocumentScanner
            onReceiptExtracted={(item) =>
              setExpenses((prev) => [...prev, { id: Date.now(), ...item }])
            }
            onNoonReportExtracted={(data) => {
              if (data.departure_port) setDeparturePort(data.departure_port);
              if (data.arrival_port) setArrivalPort(data.arrival_port);
              if (data.distance_nm) setDistanceNm(Number(data.distance_nm));
              if (data.cruising_speed) setCruisingSpeed(Number(data.cruising_speed));
            }}
          />

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" /> Live APA Ledger ({vesselName || 'Yacht'})
                </h2>
                <p className="text-xs text-slate-400">
                  Main Engines ({Math.round(mainEngineLiters)} L) + Generators ({Math.round(generatorLiters)} L) + Charter Expenses
                </p>
              </div>
              <div className="flex items-center gap-2">
                {expenses.length === 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpenses([
                        { id: 1, category: 'Marina_Berthing', vendor: 'Mykonos Marina', amount: 1450 },
                        { id: 2, category: 'Provisioning', vendor: 'Yacht Provisions Greece', amount: 3200 },
                      ])
                    }
                    className="text-xs text-cyan-400 hover:underline mr-2"
                  >
                    + Load Demo Expenses
                  </button>
                )}
                <span className="text-xs text-slate-400">APA Received (€):</span>
                <input
                  type="number"
                  value={apaReceived}
                  onChange={(e) => setApaReceived(Number(e.target.value))}
                  className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm font-mono"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-800 border-y border-slate-800 my-4 text-sm">
              <div className="py-2.5 flex justify-between items-center text-cyan-300">
                <div>
                  <span className="font-medium">
                    Estimated Bunker ({Math.round(totalLiters).toLocaleString()} L @ €{fuelPricePerLiter.toFixed(2)}/L)
                  </span>
                  <span className="ml-2 text-xs bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded">Auto-calc</span>
                </div>
                <span className="font-mono font-semibold">€{estimatedFuelCost.toFixed(2)}</span>
              </div>

              {expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-slate-200">{exp.vendor}</span>
                    <span className="ml-2 text-xs text-slate-400">({exp.category.replace('_', ' ')})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-200">€{exp.amount.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setExpenses(expenses.filter((x) => x.id !== exp.id))}
                      className="text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <input
                type="text"
                placeholder="Vendor / Marina"
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
              >
                <option value="Marina_Berthing">Marina / Berthing</option>
                <option value="Provisioning">Provisioning</option>
                <option value="Customs_Taxes">Customs & Taxes</option>
                <option value="Water_Toys">Water Toys</option>
                <option value="Other">Other</option>
              </select>
              <input
                type="number"
                placeholder="Amount (€)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg px-3 py-2 text-xs flex items-center justify-center gap-1 transition"
              >
                <Plus className="w-4 h-4" /> Add APA
              </button>
            </form>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
              <FolderOpen className="w-4 h-4 text-cyan-400" /> Saved Charters ({savedCharters.length}) — Click to Load
            </h3>
            {savedCharters.length === 0 ? (
              <p className="text-xs text-slate-500">
                No charters saved yet. Click Save Charter to store in your workspace.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedCharters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleLoadCharter(c)}
                    className="text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-700 rounded-lg p-3 flex justify-between items-center text-xs transition"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {c.charter_code} | {c.vessels?.name || 'Yacht'}
                      </div>
                      <div className="text-slate-400 mt-0.5">Client: {c.client_name}</div>
                    </div>
                    <div className="font-mono text-emerald-400">APA €{Number(c.apa_received_eur).toLocaleString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
