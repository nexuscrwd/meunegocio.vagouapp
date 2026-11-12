import React, { useState, useEffect } from 'react';
import { ShieldCheck, HelpCircle, Check, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { supabase, isSupabaseConfigured, getDbClient } from '../../lib/supabase';
import { OFFICIAL_SECURITY_QUESTIONS } from './TriadeUserRecoveryModal';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

function normalizeSecretAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export interface SecurityQuestionProfileCardProps {
  userEmail?: string;
  userPhone?: string;
  userName?: string;
}

export const SecurityQuestionProfileCard: React.FC<SecurityQuestionProfileCardProps> = ({
  userEmail,
  userPhone,
  userName,
}) => {
  const { isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [resolvedClientId, setResolvedClientId] = useState<string>('');
  const [resolvedUsername, setResolvedUsername] = useState<string>('');
  const [hasConfiguredSecret, setHasConfiguredSecret] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [questionCode, setQuestionCode] = useState<string>(OFFICIAL_SECURITY_QUESTIONS[0].code);
  const [answerText, setAnswerText] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkSecurityQuestionState() {
      setIsLoading(true);
      const cleanEmail = (userEmail || localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();
      const cleanPhone = (userPhone || localStorage.getItem('vagou_user_phone') || '').replace(/\D/g, '');
      const cleanCpf = (localStorage.getItem('vagou_user_cpf') || '').replace(/\D/g, '');
      let clientId = (localStorage.getItem('vagou_client_id') || '').trim();

      if (isSupabaseConfigured && supabase) {
        const client = getDbClient();
        try {
          let clientRow: any = null;

          if (clientId && clientId.length > 10) {
            const { data } = await (client.from('clients') as any)
              .select('id, user_id, username, email, phone, security_question_code, security_answer_normalized')
              .eq('id', clientId)
              .maybeSingle();
            if (data) clientRow = data;
          }

          if (!clientRow && cleanEmail) {
            const { data } = await (client.from('clients') as any)
              .select('id, user_id, username, email, phone, security_question_code, security_answer_normalized')
              .ilike('email', cleanEmail)
              .limit(1)
              .maybeSingle();
            if (data) clientRow = data;
          }

          if (!clientRow && cleanCpf.length === 11) {
            const { data } = await (client.from('clients') as any)
              .select('id, user_id, username, email, phone, security_question_code, security_answer_normalized')
              .ilike('cpf', `%${cleanCpf}%`)
              .limit(1)
              .maybeSingle();
            if (data) clientRow = data;
          }

          if (!clientRow && cleanPhone.length >= 10) {
            const phoneTail = cleanPhone.slice(-8);
            const { data } = await (client.from('clients') as any)
              .select('id, user_id, username, email, phone, security_question_code, security_answer_normalized')
              .ilike('phone', `%${phoneTail}%`)
              .limit(1)
              .maybeSingle();
            if (data) clientRow = data;
          }

          if (clientRow?.id) {
            clientId = String(clientRow.id);
            try {
              localStorage.setItem('vagou_client_id', clientId);
            } catch {}
          }

          let ansRow: any = null;
          if (clientId && clientId.length > 10) {
            const { data: ansList } = await (client.from('user_security_answers' as any) as any)
              .select('question_code, answer_normalized')
              .eq('client_id', clientId)
              .limit(1);
            if (Array.isArray(ansList) && ansList.length > 0) {
              ansRow = ansList[0];
            }
          }

          const activeCode = String(ansRow?.question_code || clientRow?.security_question_code || '').trim();
          const activeAnswer = String(ansRow?.answer_normalized || clientRow?.security_answer_normalized || '').trim();
          const isConfigured = Boolean(activeCode && activeAnswer);

          if (!isConfigured) {
            // Se houve reset administrativo no admvapp (ambos vazios no banco), limpa eventual cache local antigo deste usuário
            try {
              const cached = JSON.parse(localStorage.getItem('vagou_user_security_answers') || '[]');
              if (Array.isArray(cached) && cached.length > 0) {
                const filtered = cached.filter((item: any) => {
                  const sameId = clientId && item.userId === clientId;
                  const sameEmail = cleanEmail && String(item.email || '').toLowerCase() === cleanEmail;
                  return !sameId && !sameEmail;
                });
                if (filtered.length !== cached.length) {
                  localStorage.setItem('vagou_user_security_answers', JSON.stringify(filtered));
                }
              }
            } catch {}
          }

          if (isMounted) {
            setResolvedClientId(clientId);
            setResolvedUsername(String(clientRow?.username || ''));
            setHasConfiguredSecret(isConfigured);
            if (activeCode && OFFICIAL_SECURITY_QUESTIONS.some((q) => q.code === activeCode)) {
              setQuestionCode(activeCode);
            }
            setIsFormOpen(!isConfigured);
            setIsLoading(false);
          }
          return;
        } catch {
          // Fallback local caso offline
        }
      }

      // Fallback em cache local
      try {
        const cached = JSON.parse(localStorage.getItem('vagou_user_security_answers') || '[]');
        const foundLocal = Array.isArray(cached)
          ? cached.find((item: any) =>
              (clientId && item.userId === clientId) ||
              (cleanEmail && String(item.email || '').toLowerCase() === cleanEmail)
            )
          : null;

        if (isMounted) {
          setResolvedClientId(clientId);
          setHasConfiguredSecret(Boolean(foundLocal?.questionCode && foundLocal?.answer));
          if (foundLocal?.questionCode) {
            setQuestionCode(foundLocal.questionCode);
          }
          setIsFormOpen(!foundLocal);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setIsFormOpen(true);
          setIsLoading(false);
        }
      }
    }

    checkSecurityQuestionState();
    return () => {
      isMounted = false;
    };
  }, [userEmail, userPhone]);

  const handleSaveSecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const normalizedAns = normalizeSecretAnswer(answerText);
    if (normalizedAns.length < 2) {
      setFeedback({ type: 'error', text: 'Informe uma resposta com pelo menos 2 caracteres.' });
      return;
    }

    const selectedQuestion =
      OFFICIAL_SECURITY_QUESTIONS.find((q) => q.code === questionCode) || OFFICIAL_SECURITY_QUESTIONS[0];

    setIsSaving(true);
    hapticLight();

    const cleanEmail = (userEmail || localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();
    const cleanName = (userName || localStorage.getItem('vagou_user_name') || 'Usuário').trim();
    let targetClientId = resolvedClientId || (localStorage.getItem('vagou_client_id') || '').trim();

    try {
      if (isSupabaseConfigured && supabase) {
        const client = getDbClient();

        if ((!targetClientId || targetClientId.length < 10) && cleanEmail) {
          const { data: cRow } = await (client.from('clients') as any)
            .select('id, username')
            .ilike('email', cleanEmail)
            .limit(1)
            .maybeSingle();
          if (cRow?.id) {
            targetClientId = String(cRow.id);
            localStorage.setItem('vagou_client_id', targetClientId);
            if (cRow.username) setResolvedUsername(String(cRow.username));
          }
        }

        if (targetClientId && targetClientId.length > 10) {
          await (client.from('clients') as any)
            .update({
              security_question_code: selectedQuestion.code,
              security_answer_normalized: normalizedAns,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetClientId);

          try {
            await (client.from('user_security_answers' as any) as any)
              .delete()
              .eq('client_id', targetClientId);
          } catch {}

          const authUserId = (localStorage.getItem('vagou_auth_user_id') || '').trim();
          await (client.from('user_security_answers' as any) as any).upsert(
            {
              client_id: targetClientId,
              ...(authUserId && authUserId.length > 10 && !authUserId.startsWith('guest-')
                ? { user_id: authUserId }
                : {}),
              question_code: selectedQuestion.code,
              question_text: selectedQuestion.questionText,
              answer_normalized: normalizedAns,
            },
            { onConflict: 'client_id,question_code' }
          );
        } else if (cleanEmail) {
          await (client.from('clients') as any)
            .update({
              security_question_code: selectedQuestion.code,
              security_answer_normalized: normalizedAns,
              updated_at: new Date().toISOString(),
            })
            .ilike('email', cleanEmail);
        }
      }

      // Atualiza cache local sincronizado
      try {
        const cached = JSON.parse(localStorage.getItem('vagou_user_security_answers') || '[]');
        const list = Array.isArray(cached) ? cached : [];
        const filtered = list.filter((item: any) => {
          const sameId = targetClientId && item.userId === targetClientId;
          const sameEmail = cleanEmail && String(item.email || '').toLowerCase() === cleanEmail;
          return !sameId && !sameEmail;
        });
        filtered.push({
          userId: targetClientId || cleanEmail,
          username: resolvedUsername || (cleanEmail ? `@${cleanEmail.split('@')[0]}` : cleanName),
          name: cleanName,
          email: cleanEmail,
          questionCode: selectedQuestion.code,
          answer: normalizedAns,
        });
        localStorage.setItem('vagou_user_security_answers', JSON.stringify(filtered));
      } catch {}

      setResolvedClientId(targetClientId);
      setHasConfiguredSecret(true);
      setAnswerText('');
      setIsFormOpen(false);
      setFeedback({ type: 'success', text: 'Pergunta secreta salva com sucesso!' });
      hapticSuccess();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Não foi possível salvar a pergunta secreta.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const activeQuestionObj =
    OFFICIAL_SECURITY_QUESTIONS.find((q) => q.code === questionCode) || OFFICIAL_SECURITY_QUESTIONS[0];

  return (
    <div
      className={`p-3.5 rounded-[4px] border space-y-3 ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="caixa-icon-halo w-9 h-9 rounded-full shrink-0">
            <ShieldCheck className={`w-4 h-4 ${isDark ? 'text-slate-200' : 'text-slate-700'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-bold truncate">Pergunta Secreta</h4>
              {!isLoading && (
                <span
                  className={`text-[10px] font-semibold ${
                    hasConfiguredSecret
                      ? isDark
                        ? 'text-emerald-400'
                        : 'text-emerald-600'
                      : isDark
                        ? 'text-amber-400'
                        : 'text-amber-600'
                  }`}
                >
                  · {hasConfiguredSecret ? 'Ativa' : 'Pendente'}
                </span>
              )}
            </div>
            <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {isLoading
                ? 'Verificando segurança...'
                : hasConfiguredSecret
                  ? activeQuestionObj.categoryLabel
                  : 'Cadastre para recuperação de acesso'}
            </p>
          </div>
        </div>

        {!isLoading && (
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setFeedback(null);
              setIsFormOpen((prev) => !prev);
            }}
            className={`px-2.5 py-1.5 rounded-[4px] text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 ${
              !hasConfiguredSecret && !isFormOpen
                ? 'bg-[#334155] hover:bg-[#1E293B] text-white'
                : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span className={!hasConfiguredSecret && !isFormOpen ? 'text-white' : ''}>
              {isFormOpen ? 'Fechar' : hasConfiguredSecret ? 'Alterar' : 'Cadastrar'}
            </span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`px-3 py-2 rounded-[4px] text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? isDark
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-emerald-50 text-emerald-700'
              : isDark
                ? 'bg-rose-500/15 text-rose-300'
                : 'bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {isFormOpen && !isLoading && (
        <form onSubmit={handleSaveSecurityQuestion} className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label
              className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Escolha a Pergunta</span>
            </label>
            <select
              value={questionCode}
              onChange={(e) => setQuestionCode(e.target.value)}
              className="caixa-input text-xs font-semibold cursor-pointer"
            >
              {OFFICIAL_SECURITY_QUESTIONS.map((q) => (
                <option key={q.code} value={q.code}>
                  {q.questionText}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              Sua Resposta Secreta
            </label>
            <input
              type="text"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Digite sua resposta"
              required
              className="caixa-input text-xs font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || answerText.trim().length < 2}
            className="w-full py-2.5 rounded-[4px] bg-[#334155] hover:bg-[#1E293B] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            )}
            <span className="text-white">
              {isSaving ? 'Salvando...' : 'Salvar Pergunta Secreta'}
            </span>
          </button>
        </form>
      )}
    </div>
  );
};
