import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured, checkUserSalonMembership } from '../lib/supabase';

export type SalonRole = 'loading' | 'owner' | 'manager' | 'professional' | 'client' | 'guest';

export interface UseSalonRoleResult {
  role: SalonRole;
  userId: string | null;
  salonId: string | null;
  salonData: any | null;
  isLoading: boolean;
}

export function useSalonRole(salonIdentifier?: string | null): UseSalonRoleResult {
  const [role, setRole] = useState<SalonRole>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonData, setSalonData] = useState<any | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const currentReqIdRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function evaluateRole() {
      const reqId = ++currentReqIdRef.current;

      if (!isSupabaseConfigured || !supabase) {
        if (isMounted) {
          setRole('guest');
          setUserId(null);
          setSalonId(null);
          setSalonData(null);
        }
        return;
      }

      try {
        // 1. Tenta obter sessão nativa do Supabase no subdomínio atual
        const { data: { session } } = await supabase.auth.getSession();

        // 2. Suporte Cross-Subdomain SSO (Login realizado no iframe adm.vagouapp.com via postMessage)
        const storedUserId = typeof window !== 'undefined' ? (localStorage.getItem('vagou_auth_user_id') || '').trim() : '';
        const storedUserEmail = typeof window !== 'undefined'
          ? (localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '').trim().toLowerCase()
          : '';
        const storedUserCpf = typeof window !== 'undefined'
          ? (localStorage.getItem('vagou_user_cpf') || '').replace(/\D/g, '')
          : '';

        const currentUserId = session?.user?.id || storedUserId || '';
        const currentUserEmail = (session?.user?.email || storedUserEmail || '').trim().toLowerCase();
        const currentUserCpf = (session?.user?.user_metadata?.cpf || storedUserCpf || '').replace(/\D/g, '');

        // Se não há sessão Supabase nem identidade autenticada pelo admvapp, é visitante ('guest')
        if (!currentUserId && !currentUserEmail && !currentUserCpf) {
          if (isMounted && reqId === currentReqIdRef.current) {
            setRole('guest');
            setUserId(null);
            setSalonId(null);
            setSalonData(null);
            lastIdentityKeyRef.current = null;
          }
          return;
        }

        const identityKey = `${currentUserId}::${currentUserEmail}::${currentUserCpf}::${salonIdentifier || ''}`;
        if (isMounted) {
          setUserId(currentUserId || currentUserEmail || currentUserCpf);
          lastIdentityKeyRef.current = identityKey;
        }

        const effectiveSalonIdent =
          (salonIdentifier && salonIdentifier.trim()) ||
          (typeof window !== 'undefined' ? (localStorage.getItem('vagou_salon_slug') || localStorage.getItem('vagou_salon_db_id') || '').trim() : '');

        if (!effectiveSalonIdent) {
          if (isMounted && reqId === currentReqIdRef.current) setRole('client');
          return;
        }

        // 3. Verificação Multi-Camada Soberana (salons.owner_id/email/owner_cpf + salon_members + professionals)
        const membership = await checkUserSalonMembership(
          currentUserId,
          effectiveSalonIdent,
          currentUserEmail,
          currentUserCpf
        );

        if (!isMounted || reqId !== currentReqIdRef.current) return;

        if (membership.salonId) {
          setSalonId(membership.salonId);
        }
        if (membership.salonData) {
          setSalonData(membership.salonData);
        }

        if (membership.isMember) {
          if (membership.role === 'owner') setRole('owner');
          else if (membership.role === 'manager') setRole('manager');
          else if (membership.role === 'professional') setRole('professional');
          else setRole('client');
        } else {
          setRole('client');
        }
      } catch (err) {
        console.warn('Erro inesperado em useSalonRole:', err);
        if (isMounted && reqId === currentReqIdRef.current) setRole('client');
      }
    }

    setRole('loading');
    evaluateRole();

    // Escuta eventos nativos do Supabase Auth
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        const hasSsoEmail = typeof window !== 'undefined' && Boolean(localStorage.getItem('vagou_user_email'));
        if (!hasSsoEmail) {
          lastIdentityKeyRef.current = null;
          if (isMounted) {
            setRole('guest');
            setUserId(null);
            setSalonId(null);
            setSalonData(null);
          }
        }
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const incomingId = session?.user?.id || '';
        const incomingEmail = session?.user?.email || '';
        const newKey = `${incomingId}::${incomingEmail}::${salonIdentifier || ''}`;
        if (newKey !== lastIdentityKeyRef.current) {
          if (isMounted) setRole('loading');
          setTimeout(() => {
            if (isMounted) evaluateRole();
          }, 30);
        }
      }
    });

    // Escuta sincronização imediata disparada pelo modal de Login do admvapp (postMessage)
    const handleAuthUpdated = () => {
      if (isMounted) {
        evaluateRole();
      }
    };

    window.addEventListener('vagou:auth-updated', handleAuthUpdated);
    window.addEventListener('storage', handleAuthUpdated);

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
      window.removeEventListener('vagou:auth-updated', handleAuthUpdated);
      window.removeEventListener('storage', handleAuthUpdated);
    };
  }, [salonIdentifier]);

  return { role, userId, salonId, salonData, isLoading: role === 'loading' };
}
