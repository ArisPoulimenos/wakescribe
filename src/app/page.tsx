'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Ship, Fuel, Leaf, Wallet, Plus, FileText, Anchor, AlertCircle, Zap } from 'lucide-react';

export default function WakeScribeDashboard() {
  const [carbonPrice, setCarbonPrice] = useState<number>(84.85);
  const [ecoTips, setEcoTips] = useState<{ id: string; category: string; tip_text: string }[]>([]);

  // Vessel Specs
  const [vesselName, setVesselName] = useState('M/Y Apekoula');
  const [lengthMeters, setLengthMeters] = useState<number>(34);
  const [grossTonnage, setGrossTonnage] = useState<number>(240);
  const [fuelType, setFuelType] = useState<'MGO' | 'HVO'>('MGO');

  // Voyage & Consumption Specs (Liters default for Yachts)
  const [departurePort, setDeparturePort] = useState('Athens (Flisvos)');
  const [arrivalPort, setArrivalPort] = useState('Mykonos');
  const [charterDays, setCharterDays] = useState<number>(7);
  const [distanceNm, setDistanceNm] = useState<number>(95);
  const [cruisingSpeed, setCruisingSpeed] = useState<number>(14);
  const [mainBurnLph, setMainBurnLph] = useState<number>(280);
  const [genBurnLph, setGenBurnLph] = useState<number>(18);
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number>(1.15);

  // Live APA Tracker State
  const [apaReceived, setApaReceived] = useState<number>(25000);
  const [expenses, setExpenses] = useState([
    { id: 1, category: 'Marina_Berthing', vendor: 'Mykonos Marina', amount: 1450 },
    { id: 2, category: 'Provisioning', vendor: 'Yacht Provisions Greece', amount: 3200 },
  ]);
  const [newVendor, setNewVendor] = useState('');
  const [newCategory, setNewCategory] = useState('Marina_Berthing');
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => {
    async function loadMarketAndTips() {
      const { data: rates } = await supabase.from('market_rates').select('*');
      if (rates) {
        const eua = rates.find((r) => r.indicator_name === 'EU Carbon Permits');
        if (eua) setCarbonPrice(Number(eua.price));
      }
      const { data: tips } = await supabase.from('eco_tips').select('*');
      if (tips && tips.length > 0) setEcoTips(tips);
    }
    loadMarketAndTips();
  }, []);

  // Real-world Yacht Fuel & CO2 Calculations
  const sailingHours = cruisingSpeed > 0 ? distanceNm / cruisingSpeed : 0;
  const totalGeneratorHours = charterDays * 24;
  const mainEngineLiters = sailingHours * mainBurnLph;
  const generatorLiters = totalGeneratorHours * genBurnLph;
  const totalLiters = mainEngineLiters + generatorLiters;

  // MGO density ~ 0.85 kg/L -> Metric Tons
  const fuelConsumedMt = (totalLiters * 0.85) / 1000;
  const estimatedFuelCost = totalLiters * fuelPricePerLiter;

  // Emission factor: MGO = 3.206 tCO2/tFuel, HVO Biofuel = ~0.48 tCO2/tFuel (-85%)
  const emissionFactor = fuelType === 'MGO' ? 3.206 : 0.48;
  const co2EmissionsMt = fuelConsumedMt * emissionFactor;
  const carbonIntensityKgNm = distanceNm > 0 ? (co2EmissionsMt * 1000) / distanceNm : 0;
  const carbonCostEur = co2EmissionsMt * carbonPrice;
  const isMandatoryEuEts = grossTonnage >= 5000;

  // APA Settlement
  const totalOtherExpenses = expenses.reduce((acc, item) => acc + item.amount, 0);
  const totalApaSpent = totalOtherExpenses + estimatedFuelCost;
  const apaBalance = apaReceived - totalApaSpent;

  // Dynamic Eco-Tip
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      {/* Clean Header: WakeScribe + 3-word motto */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Anchor className="w-7 h-7 text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-white">WakeScribe</h1>
          </div>
          <p className="text-sm text-cyan-400 font-medium tracking-widest uppercase mt-1 pl-9">
            Clear. Green. Charters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg text-sm">
          <span className="text-slate-400">Live EUA Carbon:</span>
          <span className="font-mono font-semibold text-emerald-400">€{carbonPrice.toFixed(2)}/t</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">Fuel Rate:</span>
          <span className="font-mono font-semibold text-cyan-400">€{fuelPricePerLiter.toFixed(2)}/L</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Vessel Specs & Fuel Estimator */}
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

          {/* Row 1: Vessel Name & Fuel Type */}
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
                onChange={(e) => setFuelType(e.target.value as 'MGO' | 'HVO')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              >
                <option value="MGO">Marine Diesel / MGO</option>
                <option value="HVO">HVO Biofuel (-85% CO2)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Length, GT, Charter Days */}
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
              <label className="block text-xs text-slate-400 mb-1">Charter Days</label>
              <input
                type="number"
                value={charterDays}
                onChange={(e) => setCharterDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Row 3: Ports */}
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

          {/* Row 4: Distance, Speed, Fuel Price */}
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
              <label className="block text-xs text-slate-400 mb-1">Cruise (Knots)</label>
              <input
                type="number"
                value={cruisingSpeed}
                onChange={(e) => setCruisingSpeed(Number(e.target.value))}
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

          {/* Row 5: Main Engine & Generator Burn in Liters/hr */}
          <div className="grid grid-cols-2 gap-3 pt-1">
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

          {/* Eco-Tip Box */}
          <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              Operational Insight • {activeTip.category}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{activeTip.tip_text}</p>
          </div>
        </section>

        {/* Right Column: KPIs & Live APA Ledger */}
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

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" /> Live APA Ledger ({vesselName})
                </h2>
                <p className="text-xs text-slate-400">
                  Main Engines ({Math.round(mainEngineLiters)} L) + Generators ({Math.round(generatorLiters)} L) + Charter Expenses
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                  <span className="font-mono text-slate-200">€{exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <input
                type="text"
                placeholder="Προμηθευτής / Μαρίνα"
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
                placeholder="Ποσό (€)"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg px-3 py-2 text-xs flex items-center justify-center gap-1 transition"
              >
                <Plus className="w-4 h-4" /> Προσθήκη APA
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
