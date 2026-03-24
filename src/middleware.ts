import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware لحماية المسارات بناءً على ملفات تعريف الارتباط (Cookies).
 * يضمن عدم دخول غير المطورين لصفحة التحكم بالمستأجرين.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // حماية مسارات المطور
  if (path.startsWith('/developer')) {
    const devSession = request.cookies.get('nova-dev-session');
    if (!devSession) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // حماية مسارات لوحة التحكم الخاصة بالشركات
  if (path.startsWith('/dashboard')) {
    const userSession = request.cookies.get('nova-user-session');
    if (!userSession) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/developer/:path*'],
};
