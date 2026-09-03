import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const FloatingSendButton = () => {
  const location = useLocation();

  // Hide on send pages or admin pages
  if (
    location.pathname.startsWith('/send') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/auth')
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-20 md:bottom-8 right-5 sm:right-8 z-50">
      <Link
        to="/send"
        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary text-white shadow-[0_8px_25px_rgba(249,115,22,0.45)] flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/90 group"
        title="Send a Package"
      >
        <svg
          className="w-5 h-5 sm:w-6 sm:h-6 -rotate-12 translate-x-0.5 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-tighter mt-0.5">
          SEND
        </span>
      </Link>
    </div>
  );
};
