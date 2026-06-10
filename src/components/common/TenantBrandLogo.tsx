import { cn } from '@/lib/utils';

type TenantBrandLogoProps = {
  displayName: string;
  logoUrl?: string | null;
  monogram?: string;
  className?: string;
  markClassName?: string;
};

function getMonogram(displayName: string, monogram?: string) {
  if (monogram) return monogram;
  const words = displayName
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (words.length > 1) return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  return (words[0] || 'SP').slice(0, 2).toUpperCase();
}

export function TenantBrandLogo({
  displayName,
  logoUrl,
  monogram,
  className,
  markClassName,
}: TenantBrandLogoProps) {
  if (logoUrl) {
    return (
      // External tenant logos are user-managed assets; using a plain image avoids
      // coupling each white-label customer to Next image remotePatterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={displayName}
        className={cn('object-contain', className)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      aria-label={displayName}
      className={cn(
        'inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black shadow-sm',
        markClassName,
        className,
      )}
    >
      {getMonogram(displayName, monogram)}
    </span>
  );
}
