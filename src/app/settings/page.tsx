"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Sparkles,
  User,
  ShieldAlert,
  Save,
  Check,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { repository } from "@/lib/db/repo";
import { GradeBand, TeacherProfile } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<TeacherProfile>(repository.getProfile());

  // Form states
  const [fullName, setFullName] = useState(profile.full_name);
  const [schoolName, setSchoolName] = useState(profile.school_name);
  const [department, setDepartment] = useState(profile.department);
  const [roundingMode, setRoundingMode] = useState<"half_up" | "floor" | "ceil">(
    profile.rounding_mode
  );
  const [defaultMaxMarks, setDefaultMaxMarks] = useState(profile.default_max_marks);
  const [gradeBands, setGradeBands] = useState<GradeBand[]>(profile.grade_bands);

  // Nebius AI states
  const [providerMode, setProviderMode] = useState<"mock" | "nebius">(
    profile.provider_mode
  );
  const [nebiusKey, setNebiusKey] = useState("");
  const [nebiusModel, setNebiusModel] = useState(profile.nebius_model);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const p = repository.getProfile();
    setProfile(p);
    setFullName(p.full_name);
    setSchoolName(p.school_name);
    setDepartment(p.department);
    setRoundingMode(p.rounding_mode);
    setDefaultMaxMarks(p.default_max_marks);
    setGradeBands(p.grade_bands);
    setProviderMode(p.provider_mode);
    setNebiusModel(p.nebius_model);
  }, []);

  const handleSaveSettings = () => {
    const updated = repository.updateProfile({
      full_name: fullName,
      school_name: schoolName,
      department,
      rounding_mode: roundingMode,
      default_max_marks: Number(defaultMaxMarks),
      grade_bands: gradeBands,
      provider_mode: providerMode,
      nebius_model: nebiusModel,
      nebius_api_key_configured: Boolean(nebiusKey.trim()),
    });

    setProfile(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleBandChange = (index: number, minPct: number) => {
    const updated = [...gradeBands];
    updated[index].min_pct = minPct;
    if (index > 0) {
      updated[index - 1].max_pct = minPct - 0.01;
    }
    setGradeBands(updated);
  };

  const handleTestNebiusConnection = () => {
    if (!nebiusKey.trim()) {
      setTestResult(
        "Notice: Nebius API key is not entered. Workspace will remain on MockGradingProvider."
      );
      return;
    }
    setTestResult(
      "Notice: Nebius account is currently awaiting team review. Deterministic Mock Provider remains active as fallback."
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E8E2D5]">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#1C1A17]">
            Workspace Settings
          </h2>
          <p className="text-sm text-[#6E685F] mt-1">
            Configure institutional defaults, deterministic grade thresholds, and AI model parameters.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors shadow-xs"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Changes</span>
        </button>
      </div>

      {savedNotice && (
        <div className="p-3 rounded bg-[#EFF5F1] border border-[#BCD4C7] text-xs text-[#2A5A43] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Workspace configuration saved successfully.</span>
        </div>
      )}

      {/* Section 1: AI Provider Integration Status */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-4 shadow-2xs">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#FEF7EC] text-[#B2762A]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
                AI Grading Provider Status
              </h3>
              <p className="text-xs text-[#6E685F]">
                NVIDIA open-source model through Nebius Token Factory
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded text-xs font-mono font-medium ${
              providerMode === "nebius" && profile.nebius_api_key_configured
                ? "bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7]"
                : "bg-[#FEF7EC] text-[#B2762A] border border-[#F3DEC0]"
            }`}
          >
            {providerMode === "nebius" && profile.nebius_api_key_configured
              ? "NEBIUS ACTIVE"
              : "MOCK MODE (PENDING REVIEW)"}
          </span>
        </div>

        <div className="p-3.5 rounded border border-[#E8E2D5] bg-[#FAF8F3] text-xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B2762A] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-[#1C1A17]">
                Development Non-Blocking Architecture
              </p>
              <p className="text-[#6E685F] leading-relaxed">
                The Nebius account is currently awaiting team review. Development is non-blocked: the system uses <strong>MockGradingProvider</strong> to generate deterministic rubrics, candidate scores, and confidence flags. Real API calls are never fabricated.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
          <div className="space-y-1">
            <label className="font-medium text-[#1C1A17]">
              Grading Mode Selection
            </label>
            <select
              value={providerMode}
              onChange={(e) => setProviderMode(e.target.value as "mock" | "nebius")}
              className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
            >
              <option value="mock">
                MockGradingProvider (Deterministic Simulation)
              </option>
              <option value="nebius">
                Nebius Token Factory (NVIDIA Open-Source LLM)
              </option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#1C1A17]">
              NVIDIA Model Identifier
            </label>
            <select
              value={nebiusModel}
              onChange={(e) => setNebiusModel(e.target.value)}
              className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17] font-mono text-[11px]"
            >
              <option value="nvidia/llama-3.1-nemotron-70b-instruct">
                nvidia/llama-3.1-nemotron-70b-instruct
              </option>
              <option value="nvidia/nemotron-mini-4b-instruct">
                nvidia/nemotron-mini-4b-instruct
              </option>
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="font-medium text-[#1C1A17]">
              Nebius API Token (Server-only / Private)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={nebiusKey}
                onChange={(e) => setNebiusKey(e.target.value)}
                placeholder="Enter NEBIUS_API_KEY once team account review completes..."
                className="flex-1 p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-xs font-mono text-[#1C1A17]"
              />
              <button
                type="button"
                onClick={handleTestNebiusConnection}
                className="px-3 py-2 rounded border border-[#E8E2D5] bg-[#FFFFFF] hover:bg-[#FAF8F3] text-xs font-medium text-[#1C1A17]"
              >
                Test Connection
              </button>
            </div>
            {testResult && (
              <p className="text-xs text-[#B2762A] mt-1">{testResult}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Teacher Profile */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-4 shadow-2xs">
        <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
          Teacher Profile & Institution
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-medium text-[#1C1A17]">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#1C1A17]">School Name</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#1C1A17]">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-[#1C1A17]">Default Max Marks</label>
            <input
              type="number"
              value={defaultMaxMarks}
              onChange={(e) => setDefaultMaxMarks(Number(e.target.value))}
              className="w-full p-2 bg-[#FAF8F3] border border-[#E8E2D5] rounded text-[#1C1A17]"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Deterministic Rounding & Grade Bands */}
      <div className="bg-[#FFFFFF] border border-[#E8E2D5] rounded-md p-6 space-y-4 shadow-2xs">
        <div>
          <h3 className="font-serif text-base font-semibold text-[#1C1A17]">
            Deterministic Calculation & Grade Bands
          </h3>
          <p className="text-xs text-[#6E685F] mt-0.5">
            Define rounding rules and percentage thresholds used for Markbooks and Report Cards.
          </p>
        </div>

        <div className="text-xs space-y-2">
          <label className="font-medium text-[#1C1A17] block">
            Rounding Policy:
          </label>
          <div className="flex gap-4">
            {[
              { id: "half_up", label: "Standard Half-Up (e.g. 84.55 → 84.6)" },
              { id: "floor", label: "Floor / Truncate" },
              { id: "ceil", label: "Ceil / Round Up" },
            ].map((opt) => (
              <label key={opt.id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="rounding"
                  checked={roundingMode === opt.id}
                  onChange={() => setRoundingMode(opt.id as any)}
                  className="text-[#2A5A43] focus:ring-[#2A5A43]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Grade Bands Table */}
        <div className="border border-[#E8E2D5] rounded-md overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAF8F3] border-b border-[#E8E2D5] text-[#6E685F] font-medium">
                <th className="py-2.5 px-3">Grade</th>
                <th className="py-2.5 px-3">Min %</th>
                <th className="py-2.5 px-3">Max %</th>
                <th className="py-2.5 px-3">Descriptor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E2D5]">
              {gradeBands.map((band, idx) => (
                <tr key={band.grade} className="hover:bg-[#FAF8F3]">
                  <td className="py-2.5 px-3 font-serif font-bold text-[#1C1A17]">
                    {band.grade}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    <input
                      type="number"
                      value={band.min_pct}
                      onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                      className="w-16 p-1 bg-[#FFFFFF] border border-[#E8E2D5] rounded text-center"
                    />
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#6E685F]">
                    {band.max_pct}%
                  </td>
                  <td className="py-2.5 px-3 text-[#6E685F]">{band.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
