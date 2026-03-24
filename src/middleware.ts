import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware لحماية المسارات بناءً على ملفات تعريف الارتباط (Cookies).
 * يضمن عزل بوابة المطور عن بوابة الشركات.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // استثناء صفحة الدخول والمسارات العامة
  if (path === '/' || path === '/developer/login') {
    return NextResponse.next();
  }

  // حماية مسارات المطور
  if (path.startsWith('/developer')) {
    const devSession = request.cookies.get('nova-dev-session');
    if (!devSession) {
      return NextResponse.redirect(new URL('/developer/login', request.url));
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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
