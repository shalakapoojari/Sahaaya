# Layouts

## RootLayout
- Path: `src/app/layout.tsx`
- Description: Main app shell with fonts, grain overlay, and botanical background wrapper.
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sahayaa – Care, delivered naturally.",
  description: "A premium botanical wellness platform for seamless and dignified hygiene access.",
  themeColor: "#2D4A3E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col selection:bg-magenta selection:text-white">
        <div className="grain-overlay" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
```

## BotanicalBackground
- Path: Defined internally in `src/app/page.tsx`
- Description: Animated organic shapes and floating particles.
```tsx
const BotanicalBackground = () => (
  <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
    {/* Animated Blobs */}
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0],
        x: [0, 100, 0],
        y: [0, 50, 0]
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-leaf/10 rounded-full blur-[120px]"
    />
    <motion.div 
      animate={{ 
        scale: [1, 1.1, 1],
        rotate: [0, -45, 0],
        x: [0, -50, 0],
        y: [0, 100, 0]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[20%] -right-[5%] w-[50%] h-[50%] bg-blossom/10 rounded-full blur-[100px]"
    />
    {/* Floating Elements */}
    <div className="absolute inset-0">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute opacity-20"
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            rotate: Math.random() * 360
          }}
          animate={{ 
            y: ["-20%", "120%"],
            rotate: [0, 360] 
          }}
          transition={{ 
            duration: 15 + Math.random() * 10, 
            repeat: Infinity, 
            delay: -Math.random() * 10 
          }}
        >
          <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
            {i % 2 === 0 ? (
              <path d="M50 10C50 10 30 40 10 50C30 60 50 90 50 90C50 90 70 60 90 50C70 40 50 10 50 10Z" fill="currentColor" className="text-leaf" />
            ) : (
              <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 8" className="text-earth" />
            )}
          </svg>
        </motion.div>
      ))}
    </div>
  </div>
);
```
