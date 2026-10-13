"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileCheck2,
  Users2,
  TableProperties,
  GraduationCap,
  Settings,
  Plus,
  Sparkles,
  RotateCcw,
  Menu,
  X,
  ShieldAlert,
} from "lucide-react";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const navItems = [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "Assessments", href: "/assessments", icon: FileCheck2 },
    { label: "Classes & Students", href: "/classes", icon: Users2 },
    { label: "Results & Markbook", href: "/results", icon: TableProperties },
    { label: "Report Cards", href: "/reports", icon: GraduationCap },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const handleResetSeed = async () => {
    if (!confirm("Reset database to initial educational seed data?")) return;
    setIsResetting(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Failed to reset seed");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FBF9F5] text-[#1C1A17]">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#FFFFFF] border-b border-[#E8E2D5]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#2A5A43] flex items-center justify-center text-[#FBF9F5] font-serif font-bold text-sm">
            M
          </div>
          <span className="font-serif font-semibold text-base tracking-tight text-[#1C1A17]">
            MucoCheck
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#6E685F] hover:text-[#1C1A17] rounded"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Persistent Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-[#FFFFFF] border-r border-[#E8E2D5] flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-[#E8E2D5] flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded bg-[#2A5A43] flex items-center justify-center text-[#FBF9F5] font-serif font-bold text-base shadow-xs group-hover:bg-[#214734] transition-colors">
                M
              </div>
              <div>
                <h1 className="font-serif font-semibold text-lg tracking-tight leading-none text-[#1C1A17]">
                  MucoCheck
                </h1>
                <p className="text-[11px] text-[#6E685F] mt-1 tracking-wide uppercase font-medium">
                  AI Grading Workspace
                </p>
              </div>
            </Link>
          </div>

          {/* Primary Action Button */}
          <div className="p-4">
            <Link
              href="/assessments/new"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-sm font-medium transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Assessment</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-1 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded font-medium transition-colors ${
                    isActive
                      ? "bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7]"
                      : "text-[#6E685F] hover:text-[#1C1A17] hover:bg-[#F6F3EB]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-[#2A5A43]" : "text-[#8E877D]"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel: Provider Status & User Info */}
        <div className="p-4 border-t border-[#E8E2D5] space-y-3 bg-[#FAF8F3]">
          {/* Visible AI Provider Status Banner */}
          <div className="p-2.5 rounded border border-[#E8E2D5] bg-[#FFFFFF] text-xs">
            <div className="flex items-center justify-between font-medium text-[#1C1A17] mb-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#B2762A]" />
                Grading Engine
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#FEF7EC] text-[#B2762A] border border-[#F3DEC0]">
                MOCK ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-[#6E685F] leading-snug">
              Nebius Token Factory account under review. Deterministic evaluator active.
            </p>
          </div>

          {/* Teacher Profile & Reset Action */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-[#E8E2D5] text-[#2A5A43] flex items-center justify-center font-medium text-xs shrink-0">
                EV
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-[#1C1A17] truncate">
                  Dr. Eleanor Vance
                </p>
                <p className="text-[10px] text-[#6E685F] truncate">
                  Natural Sciences
                </p>
              </div>
            </div>

            <button
              onClick={handleResetSeed}
              disabled={isResetting}
              title="Reset workspace demo data"
              className="p-1.5 text-[#8E877D] hover:text-[#C25B3E] rounded hover:bg-[#FDF2EE] transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar for Desktop */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-[#FFFFFF] border-b border-[#E8E2D5]">
          <div className="flex items-center gap-3">
            <div className="text-xs text-[#8E877D] flex items-center gap-1.5">
              <span>MucoCheck</span>
              <span>/</span>
              <span className="text-[#1C1A17] font-medium capitalize">
                {pathname === "/" ? "Overview" : pathname.split("/")[1].replace("-", " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded text-xs bg-[#EFF5F1] text-[#2A5A43] border border-[#BCD4C7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2A5A43]" />
              <span className="font-medium">Deterministic Scoring Engine</span>
            </div>

            <Link
              href="/assessments/new"
              className="flex items-center gap-1.5 py-1.5 px-3 rounded bg-[#2A5A43] hover:bg-[#214734] text-[#FBF9F5] text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Assessment</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
