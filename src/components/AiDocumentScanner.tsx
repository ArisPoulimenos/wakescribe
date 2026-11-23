'use client';

import React, { useState } from 'react';
import { ScanLine, Upload, Loader2, CheckCircle2 } from 'lucide-react';

interface ScannerProps {
  onReceiptExtracted: (item: { vendor: string; category: string; amount: number }) => void;
  onNoonReportExtracted: (data: {
    departure_port?: string;
    arrival_port?: string;
    distance_nm?: number;
    cruising_speed?: number;
  }) => void;
}

export default function AiDocumentScanner({ onReceiptExtracted, onNoonReportExtracted }: ScannerProps) {
  const [scanMode, setScanMode] = useState<'receipt' | 'noon_report'>('receipt');
  const [scanning, setScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setStatusMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', scanMode);

      const res = await fetch('/api/scan-document', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error scanning document');

      if (data.mode === 'receipt' && data.extracted) {
        onReceiptExtracted({
          vendor: data.extracted.vendor || 'Scanned Vendor',
          category: data.extracted.category || 'Other',
          amount: Number(data.extracted.amount_eur) || 0,
        });
        setStatusMsg(
          `Added: ${data.extracted.vendor} (€${Number(data.extracted.amount_eur).toFixed(2)})${
            data.demo ? ' [Demo Mode]' : ''
          }`
        );
      } else if (data.mode === 'noon_report' && data.extracted) {
        onNoonReportExtracted(data.extracted);
        setStatusMsg(
          `Route updated: ${data.extracted.departure_port} to ${data.extracted.arrival_port} (${data.extracted.distance_nm} NM)${
            data.demo ? ' [Demo Mode]' : ''
          }`
        );
      }
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-slate-900/70 border border-cyan-900/50 rounded-xl p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">AI Captain Scanner (Receipts & Noon Reports)</h3>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setScanMode('receipt')}
            className={`px-2.5 py-1 rounded-md transition ${
              scanMode === 'receipt' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            APA Receipt
          </button>
          <button
            type="button"
            onClick={() => setScanMode('noon_report')}
            className={`px-2.5 py-1 rounded-md transition ${
              scanMode === 'noon_report' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            Noon Report
          </button>
        </div>
      </div>

      <label className="flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/60 rounded-lg py-3.5 px-4 cursor-pointer transition text-xs text-slate-300">
        {scanning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Scanning document with AI Vision...</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>
              Upload photo/PDF of {scanMode === 'receipt' ? 'Marina / Provisioning Receipt' : 'Captain Noon Report'}
            </span>
          </>
        )}
        <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" disabled={scanning} />
      </label>

      {statusMsg && (
        <div className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
}
