import { NextRequest, NextResponse } from 'next/server';

// Secret key for JWT - ideally, this should be in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_here';

// Function to verify the JWT token and identify the user type
function verifyToken(token: string) {  
  try {
    // We check if we're on the server side to avoid build problems
    if (typeof window === 'undefined') {
      // Dynamic import of jsonwebtoken
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, JWT_SECRET);
      return { isValid: true, payload: decoded };
    }
    return { isValid: false, payload: null };
  } catch (error) {
    console.error("Error verifying token:", error);
    return { isValid: false, payload: null };
  }
}

// Function to check cookie consent for analytics/marketing
function checkCookieConsent(request: NextRequest): boolean {
  const consent = request.cookies.get('gate33-cookie-consent')?.value;
  if (!consent) return false;
  
  try {
    const consentData = JSON.parse(consent);
    return consentData.necessary; // At minimum, necessary cookies must be accepted
  } catch {
    return false;
  }
}

// Routes that require admin authentication
const adminRoutes = ['/admin', '/api/admin', '/support-dashboard', '/api/support', '/api/monitoring'];

// Rotas públicas que não devem exigir autenticação mesmo estando dentro de /api/admin ou /api/support
const publicApiRoutes = ['/api/admin/login', '/api/support/login'];

// Mapeamento de rotas para requisitos de permissão específicos
// Adicione rotas e permissões específicas para admin/support se necessário

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Verificar se a rota é pública, como o endpoint de login
  const isExemptRoute = publicApiRoutes.some(route => pathname.startsWith(route));
  if (isExemptRoute) {
    console.log('Public API route accessed:', pathname);
    return NextResponse.next();
  }
  
  // Check if we are on a public page
  const isPublicRoute = !adminRoutes.some(route => pathname.startsWith(route));

  // Se for rota pública, permite acesso imediato
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Verifica autenticação
  const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true';
  if (!isAuthenticated) {
    console.log('Unauthenticated user trying to access protected route:', pathname);
    // Redireciona para homepage 
    return NextResponse.redirect(new URL('/', request.url));
  }

  // For Firebase Auth based authentication, we skip JWT verification
  // and trust the isAuthenticated cookie set during login
  console.log('Authenticated user accessing protected route:', pathname);
  return NextResponse.next();
}

// Configure which routes will be checked by the middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/support-dashboard/:path*',
    
    // Exclude password reset endpoints
    '/((?!api/admin/forgot-password|api/admin/reset-password)api/admin/:path*)',
    
    '/api/support/:path*',
    '/api/monitoring/:path*',
  ],
};