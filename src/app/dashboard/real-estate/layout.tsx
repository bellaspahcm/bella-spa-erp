/**
 * Real Estate Module Layout
 *
 * Dedicated layout wrapper for all /dashboard/real-estate/* routes.
 * Applies premium "luxury real estate" design tokens to the content area only.
 *
 * ISOLATION GUARANTEE:
 *   - This layout only mounts for /dashboard/real-estate/* routes (Next.js route nesting)
 *   - CSS scoped via [data-re-layout] attribute — no global style side effects
 *   - Spa / Babycare / Industrial tenants never render this layout
 */
import './re-layout.css';

export default function RealEstateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-re-layout="true" className="re-layout-root">
      {children}
    </div>
  );
}
