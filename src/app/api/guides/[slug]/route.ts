import { NextResponse, NextRequest } from 'next/server';
import { getCurrentUser } from '@/services/user-actions';
import { isManualPermitted } from '@/services/user-manuals';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !user.role) {
    return new NextResponse('Unauthorized: Vui lòng đăng nhập lại.', { status: 401 });
  }

  const { slug } = await params;

  if (!isManualPermitted(user.role, slug)) {
    return new NextResponse('Access Denied: Bạn không có quyền truy cập tài liệu này.', { status: 403 });
  }

  try {
    const filename = `${slug.toLowerCase()}.html`;
    const filePath = path.join(process.cwd(), 'docs', 'user-manuals', filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File Not Found: Tài liệu không tồn tại.', { status: 404 });
    }

    const htmlContent = fs.readFileSync(filePath, 'utf-8');

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('Error reading guide file in API route:', err);
    return new NextResponse(`Internal Server Error: ${err.message}`, { status: 500 });
  }
}
