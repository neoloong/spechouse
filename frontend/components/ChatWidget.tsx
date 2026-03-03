"use client";

import { useEffect } from "react";

export default function ChatWidget() {
  useEffect(() => {
    // Tawk.to Chat Widget
    if (typeof window !== 'undefined') {
      // Set Tawk_API before the script loads
      window.Tawk_API = {};
      window.Tawk_LoadStart = new Date();
      
      // Load Tawk.to script
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://embed.tawk.to/678dc691430489a1d0f50e3d/1ift0778l";
      script.charset = "UTF-8";
      script.setAttribute("crossorigin", "*");
      
      document.head.appendChild(script);
      
      // Cleanup on component unmount
      return () => {
        document.head.removeChild(script);
      };
    }
  }, []);

  return null;
}

// TypeScript declarations
declare global {
  interface Window {
    Tawk_API: any;
    Tawk_LoadStart: Date;
  }
}