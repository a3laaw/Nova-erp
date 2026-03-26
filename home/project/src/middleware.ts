import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * @fileOverview Middleware لتأمين المسارات السيادية.
 * تم تحديثه للسماح للمطور بدخول الـ Dashboard عند التقمص.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. السماح بالدخول العام لصفحة البداية، صفحة التسجيل، والـ API
  if (path === '/' || path === '/register' || path.startsWith('/api')) {
    return NextResponse.next();
  }

  const devSession = request.cookies.get('nova-dev-session');
  const userSession = request.cookies.get('nova-user-session');

  // 2. حماية مسارات المطور (Master Console)
  if (path.startsWith('/developer')) {
    if (!devSession) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // 3. حماية مسارات لوحة تحكم الشركة (Tenant Dashboard)
  // نسمح بالدخول إذا وجدنا جلسة مستخدم أو جلسة مطور (لحالة التقمص)
  if (path.startsWith('/dashboard')) {
    if (!userSession && !devSession) {
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
