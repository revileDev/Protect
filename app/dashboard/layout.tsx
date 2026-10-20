// app/dashboard/layout.tsx
import React from "react";
import DashboardNav from "@/components/DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#08090E] text-zinc-100 flex flex-col md:flex-row selection:bg-cyan-500 selection:text-black">
      {/* Dynamic Fitted Navigation Sidebar */}
      <DashboardNav />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-w-0 bg-[#08090E]">
        <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
