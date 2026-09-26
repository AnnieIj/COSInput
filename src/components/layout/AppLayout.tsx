import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../common/Sidebar';
import { Header } from '../common/Header';
import { DemoModeBanner } from '../common/DemoModeBanner';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface font-sans text-on-surface antialiased flex flex-col">
      {/* Sidebar (Desktop fixed left-64, mobile drawer) */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Canvas Area shifted 64 (16rem) on desktop */}
      <div className="lg:pl-64 flex flex-col min-h-screen min-w-0">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <DemoModeBanner />

        <main className="w-full flex-1 bg-surface min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
