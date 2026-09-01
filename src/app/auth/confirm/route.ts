import { type NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'invite' | 'recovery' | 'email' | 'signup' | null;

  if (token_hash && type) {
    // Legacy invite/recovery links are no longer used. Admin-created users
    // receive an initial password directly.
    redirect('/login');
  }

  redirect('/login?error=invite_link_invalid');
}
