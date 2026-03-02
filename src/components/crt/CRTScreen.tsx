"use client";

import React from "react";

interface CRTScreenProps {
  children: React.ReactNode;
  className?: string;
}

export default function CRTScreen({ children, className = "" }: CRTScreenProps) {
  return (
    <div className={`crt-monitor ${className}`}>
      {/* Outer bezel */}
      <div className="crt-bezel">
        {/* Screen with curvature effect */}
        <div className="crt-screen">
          {/* Scanline overlay */}
          <div className="crt-scanlines" aria-hidden="true" />
          {/* Flicker overlay */}
          <div className="crt-flicker" aria-hidden="true" />
          {/* Pixel grid overlay */}
          <div className="crt-pixelgrid" aria-hidden="true" />
          {/* Actual content */}
          <div className="crt-content">
            {children}
          </div>
        </div>
      </div>
      {/* Power LED */}
      <div className="crt-led" />
    </div>
  );
}
