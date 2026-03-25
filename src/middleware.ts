import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * @fileOverview Middleware لتأمين المسارات السيادية.
 * تم توحيد السماح بالوصول للمسار الرئيسي / ليعمل كبوابة موحدة.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. السماح بالدخول العام لصفحة البداية، صفحة التسجيل، والـ API
  if (path === '/' || path === '/register' || path.startsWith('/api')) {
    return NextResponse.next();
  }

  // 2. حماية مسارات المطور (Master Console)
  if (path.startsWith('/developer')) {
    const devSession = request.cookies.get('nova-dev-session');
    if (!devSession) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 3. حماية مسارات لوحة تحكم الشركة (Tenant Dashboard)
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
     * Match all request paths except for:
     * - static files (_next/static, _next/image)
     * - favicon
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
