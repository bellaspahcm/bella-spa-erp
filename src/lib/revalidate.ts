'use server';

export async function safeRevalidatePath(path: string, type?: 'layout' | 'page') {
  try {
    const { revalidatePath } = await import('next/cache');
    if (typeof revalidatePath === 'function') {
      revalidatePath(path, type);
    }
  } catch (error) {
    console.warn('[Revalidation] Could not revalidate path: %s', path, error);
  }
}
