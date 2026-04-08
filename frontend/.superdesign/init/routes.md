# Routes & Pages

## Route Mapping
- `/` -> `src/app/page.tsx` (Main SPA)
- `/admin` -> Redirects to `/`
- `/machines` -> Redirects to `/`
- `/vend/:id` -> Redirects to `/`
- `/login` -> Redirects to `/`

## Page Dependency Tree (`/`)
- `src/app/page.tsx`
  - `src/app/globals.css`
  - `src/app/layout.tsx`
  - `src/components/DashboardCard.tsx`
  - `src/components/EmergencyFAB.tsx`
  - `src/components/Features.tsx`
  - `src/components/MachineCard.tsx`
  - `src/components/MumbaiMap.tsx`
  - `src/components/Navbar.tsx` (Internal version in page.tsx)
  - `src/components/ProductSwipeCard.tsx`
  - `src/components/QuickExitOverlay.tsx`
  - `src/components/SuccessBloom.tsx`
  - `src/components/VendingSimulation.tsx`
