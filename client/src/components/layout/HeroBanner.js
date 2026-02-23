import React from 'react';
import { useNavigate } from 'react-router-dom';
import heroImage from '../../assets/hero-deposit.png';

function HeroBanner() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-6 pt-4">
      <div className="relative w-full h-[420px] md:h-96 lg:h-[520px] overflow-hidden rounded-2xl shadow-md">
        <img
          src={heroImage}
          alt="Renters in dispute with landlord"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 25%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

        {/* Text overlay — bottom-left */}
        <div className="absolute bottom-0 left-0 max-w-2xl p-6 md:p-12 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-3">
            For Texas Renters
          </p>
          <h2
            className="text-4xl md:text-5xl lg:text-7xl font-bold leading-[1.05] text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            They kept your deposit.
          </h2>
          <p
            className="mt-1 text-4xl md:text-5xl lg:text-7xl font-bold leading-[1.05] text-blue-400"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Get it back.
          </p>
          <button
            onClick={() => navigate('/intake')}
            className="mt-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-10 py-5 text-xl font-bold flex flex-col items-center justify-center tracking-tight"
          >
            <span>Get It Back</span>
            <span className="text-sm font-semibold opacity-85 mt-0.5">Click Here to Start →</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default HeroBanner;
