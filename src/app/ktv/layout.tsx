export default function KtvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // REMOVED redundant auth check from layout - each page does its own auth check
  // This was causing duplicate getCurrentUser() calls (2x on every page load)
  // and contributing to the performance issue
  
  return <>{children}</>;
}
