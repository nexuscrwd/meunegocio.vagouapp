import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  const lastUserIdRef = useRef<string | null>(null);
  const currentReqIdRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function evaluateRole(isBackgroundRefresh = false) {
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
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session?.user) {
          if (isMounted) {
            setRole('guest');
            setUserId(null);
            setSalonId(null);
            setSalonData(null);
            lastUserIdRef.current = null;
          }
          return;
        }

        const currentUserId = session.user.id;
        if (isMounted) {
          setUserId(currentUserId);
          lastUserIdRef.current = currentUserId;
        }

        if (!salonIdentifier || !salonIdentifier.trim()) {
          if (isMounted && reqId === currentReqIdRef.current) setRole('client');
          return;
        }

        const cleanIdent = salonIdentifier.trim().toLowerCase();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdent);
        const isValidSlug = /^[a-z0-9-]+$/.test(cleanIdent);

        if (!isUuid && !isValidSlug) {
          if (isMounted && reqId === currentReqIdRef.current) setRole('client');
          return;
        }

        // Busca o salão estritamente por id ou slug (sem ilike, sem subdomain inexistente)
        let salonQuery = supabase.from('salons').select('id, trade_name, slug, is_active');
        if (isUuid) {
          salonQuery = salonQuery.eq('id', cleanIdent);
        } else {
          salonQuery = salonQuery.eq('slug', cleanIdent);
        }

        const { data: foundSalon, error: salonErr } = await (salonQuery.maybeSingle() as any);
        if (salonErr || !foundSalon) {
          if (salonErr) console.warn('Erro ao consultar salão:', salonErr.message);
          if (isMounted && reqId === currentReqIdRef.current) setRole('client');
          return;
        }

        if (isMounted) {
          setSalonId(foundSalon.id);
          setSalonData(foundSalon);
        }

        // Consulta formal na tabela salon_members por user_id E salon_id
        const { data: members, error: memErr } = await (supabase
          .from('salon_members')
          .select('role')
          .eq('salon_id', foundSalon.id)
          .eq('user_id', currentUserId) as any);

        if (memErr) {
          console.warn('Erro ao consultar salon_members no useSalonRole:', memErr.message);
          if (isMounted && reqId === currentReqIdRef.current) setRole('client');
          return;
        }

        if (isMounted && reqId === currentReqIdRef.current) {
          if (members && members.length > 0) {
            const memberRole = members[0].role;
            if (memberRole === 'owner') setRole('owner');
            else if (memberRole === 'manager') setRole('manager');
            else if (memberRole === 'professional') setRole('professional');
            else setRole('client');
          } else {
            setRole('client');
          }
        }
      } catch (err) {
        console.warn('Erro inesperado em useSalonRole:', err);
        if (isMounted && reqId === currentReqIdRef.current) setRole('client');
      }
    }

    setRole('loading');
    evaluateRole();

    // Recalcula o papel em eventos de autenticação seletivos
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        lastUserIdRef.current = null;
        if (isMounted) {
          setRole('guest');
          setUserId(null);
          setSalonId(null);
          setSalonData(null);
        }
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Só reavalia se o user.id mudou; não volta a 'loading' se já havia papel para o mesmo usuário
        const incomingUserId = session?.user?.id || null;
        const hasUserChanged = incomingUserId !== lastUserIdRef.current;

        if (hasUserChanged) {
          if (isMounted) setRole('loading');
          setTimeout(() => {
            if (isMounted) evaluateRole(false);
          }, 50);
        }
      }
      // TOKEN_REFRESHED e INITIAL_SESSION são ignorados
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [salonIdentifier]);

  return { role, userId, salonId, salonData, isLoading: role === 'loading' };
}
