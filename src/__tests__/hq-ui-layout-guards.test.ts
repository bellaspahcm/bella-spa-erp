import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('HQ UI layout regression guards', () => {
  it('keeps HQ branch filters inside the card with horizontal scrolling instead of clipping', () => {
    const source = readSource('src/app/hq/components/HqBranchFilters.tsx');

    expect(source).toContain('overflow-hidden rounded-[2.5rem]');
    expect(source).toContain('overflow-x-auto overscroll-x-contain');
    expect(source).toContain('flex min-w-max gap-4');
  });

  it('keeps the HQ branch registration modal scrollbar inside the modal shell', () => {
    const source = readSource('src/app/hq/components/HqBranchRegistrationModal.tsx');

    expect(source).toContain('max-h-[calc(100dvh-1.5rem)]');
    expect(source).toContain('overflow-hidden rounded-[2.5rem]');
    expect(source).toContain('overflow-y-auto overscroll-contain');
    expect(source).toContain('[scrollbar-gutter:stable]');
  });

  it('keeps transfer order tables scrollable inside their own card', () => {
    const source = readSource('src/app/hq/components/HqTransferOrdersLedger.tsx');

    expect(source).toContain('overflow-x-auto overscroll-x-contain custom-scrollbar');
    expect(source).toContain('min-w-[1000px]');
  });
});
