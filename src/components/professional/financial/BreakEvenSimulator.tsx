import React, { useState, useEffect } from 'react';
import {
  Target, TrendingUp, Sliders, CheckCircle2,
  Zap, Calendar, Calculator
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { FinancialExpense } from '../../../types';
import { hapticLight } from '../../../utils/haptics';

interface BreakEvenSimulatorProps {
  expenses: FinancialExpense[];
  currentRealizedRevenue: number;
  currentAverageTicket: number;
  completedAppointmentsCount: number;
}

const formatBrazilianNumber = (val: string | number): string => {
  if (val === '' || val === null || val === undefined) return '';
  let strVal = typeof val === 'number' ? val.toString().replace('.', ',') : val;
  strVal = strVal.replace(/[^\d,]/g, '');
  const parts = strVal.split(',');
  let integerPart = parts[0];
  let decimalPart = parts.length > 1 ? parts[1] : null;
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimalPart !== null) {
    return `${integerPart},${decimalPart.slice(0, 2)}`;
  }
  return integerPart;
};

const parseBrazilianNumber = (val: string): number => {
  if (!val) return 0;
  const cleanStr = val.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const BreakEvenSimulator: React.FC<BreakEvenSimulatorProps> = ({
  expenses,
  currentRealizedRevenue,
  currentAverageTicket,
  completedAppointmentsCount,
}) => {
  const { isDark } = useTheme();

  const [targetProfitStr, setTargetProfitStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_financial_target_profit');
      const num = saved ? parseFloat(saved) : 0;
      return formatBrazilianNumber(num);
    } catch {
      return '0';
    }
  });

  const [workDaysStr, setWorkDaysStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_financial_work_days');
      const num = saved ? parseInt(saved, 10) : 22;
      return formatBrazilianNumber(num);
    } catch {
      return '22';
    }
  });

  const [dailyClientsStr, setDailyClientsStr] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_financial_daily_clients');
      const num = saved ? parseInt(saved, 10) : 6;
      return formatBrazilianNumber(num);
    } catch {
      return '6';
    }
  });

  const targetProfit = parseBrazilianNumber(targetProfitStr);
  const workDays = Math.max(1, Math.round(parseBrazilianNumber(workDaysStr)) || 1);
  const dailyClients = Math.max(1, Math.round(parseBrazilianNumber(dailyClientsStr)) || 1);

  useEffect(() => {
    try {
      localStorage.setItem('vagou_financial_target_profit', targetProfit.toString());
      localStorage.setItem('vagou_financial_work_days', workDays.toString());
      localStorage.setItem('vagou_financial_daily_clients', dailyClients.toString());
    } catch {}
  }, [targetProfit, workDays, dailyClients]);

  const totalExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  const totalRequiredRevenue = totalExpenses + targetProfit;

  const monthlyEstimatedAppointments = workDays * dailyClients;

  const targetAverageTicket = monthlyEstimatedAppointments > 0
    ? totalRequiredRevenue / monthlyEstimatedAppointments
    : 0;

  const targetDailyRevenue = workDays > 0 ? totalRequiredRevenue / workDays : 0;

  const breakEvenProgress = totalExpenses > 0 ? Math.min(100, (currentRealizedRevenue / totalExpenses) * 100) : 100;
  const isBreakEvenReached = currentRealizedRevenue >= totalExpenses;
  const netProfitOrDeficit = currentRealizedRevenue - totalExpenses;

  const [simulatedTicket, setSimulatedTicket] = useState<number>(() => {
    return Math.max(0, Math.round(targetAverageTicket || 0));
  });

  useEffect(() => {
    if (targetAverageTicket > 0) {
      setSimulatedTicket(Math.round(targetAverageTicket));
    }
  }, [targetAverageTicket]);

  const requiredAppointmentsWithSimulatedTicket = simulatedTicket > 0
    ? Math.ceil(totalRequiredRevenue / simulatedTicket)
    : 0;

  const simulatedDailyClientsNeeded = workDays > 0
    ? (requiredAppointmentsWithSimulatedTicket / workDays).toFixed(1)
    : '0';

  return (
    <div className="space-y-3.5">

      <div className={`p-3.5 rounded border space-y-2.5 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 brand-icon shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
              Termômetro de Ponto de Equilíbrio
            </h3>
          </div>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
            isBreakEvenReached
              ? 'brand-tab-active shadow-2xs'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold'
          }`}>
            {isBreakEvenReached ? 'Zona de Lucro Real' : 'Em Cobertura de Custos'}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 text-[10px]">Coletado: R$ {currentRealizedRevenue.toFixed(2).replace('.', ',')}</span>
            <span className="text-rose-500 font-bold text-[11px]">Custo Mês: R$ {totalExpenses.toFixed(2).replace('.', ',')}</span>
          </div>

          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isBreakEvenReached ? 'brand-bar' : 'bg-amber-400'
              }`}
              style={{ width: `${breakEvenProgress}%` }}
            />
          </div>
        </div>

        <div className={`p-2 rounded text-[11px] font-medium flex items-center gap-2 ${
          isBreakEvenReached
            ? 'brand-soft-badge'
            : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
        }`}>
          {isBreakEvenReached ? (
            <>
              <CheckCircle2 className="w-4 h-4 brand-icon shrink-0" />
              <span>
                Suas despesas foram 100% cobertas! Lucro líquido atual: <strong className="text-emerald-500">R$ {netProfitOrDeficit.toFixed(2).replace('.', ',')}</strong>
              </span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Faltam <strong>R$ {Math.abs(netProfitOrDeficit).toFixed(2).replace('.', ',')}</strong> para cobrir todos os custos do mês.
              </span>
            </>
          )}
        </div>
      </div>

      <div className={`p-3.5 rounded border space-y-3 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 brand-icon" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
              Parâmetros de Meta & Capacidade
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Ajuste os valores para projetar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Meta de Lucro Desejada (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={targetProfitStr}
              onChange={(e) => {
                hapticLight();
                setTargetProfitStr(formatBrazilianNumber(e.target.value));
              }}
              className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded border outline-none brand-ring-focus brand-text ${
                isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Dias Úteis / Mês
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={workDaysStr}
              onChange={(e) => {
                hapticLight();
                setWorkDaysStr(formatBrazilianNumber(e.target.value));
              }}
              className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded border outline-none brand-ring-focus ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Média Clientes / Dia
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={dailyClientsStr}
              onChange={(e) => {
                hapticLight();
                setDailyClientsStr(formatBrazilianNumber(e.target.value));
              }}
              className={`w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded border outline-none brand-ring-focus ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`p-3 rounded border flex flex-col justify-between brand-border-active ${
          isDark ? 'bg-slate-900/90' : 'bg-white shadow-2xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-wider brand-text">Ticket Médio Alvo</span>
            <Target className="w-3.5 h-3.5 brand-icon" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-black font-mono brand-text">
              R$ {targetAverageTicket.toFixed(2).replace('.', ',')}
            </span>
            <p className="text-[9.5px] text-slate-400 mt-0.5">Por atendimento para bater meta</p>
          </div>
        </div>

        <div className={`p-3 rounded border flex flex-col justify-between ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Meta Diária</span>
            <Calendar className="w-3.5 h-3.5 brand-icon" />
          </div>
          <div className="mt-1">
            <span className="text-lg font-black font-mono brand-text">
              R$ {targetDailyRevenue.toFixed(2).replace('.', ',')}
            </span>
            <p className="text-[9.5px] text-slate-400 mt-0.5">Faturamento por dia trabalhado</p>
          </div>
        </div>
      </div>

      <div className={`p-3.5 rounded border space-y-2 ${
        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 brand-icon" />
            Análise do Ticket Médio Atual
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {completedAppointmentsCount} atendimentos concluídos
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-slate-400">Ticket Médio Praticado:</span>
          <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            R$ {currentAverageTicket.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1 border-t border-slate-800/40">
          <span className="text-slate-400">Ticket Médio Alvo Recomendado:</span>
          <span className="font-mono font-bold brand-text">
            R$ {targetAverageTicket.toFixed(2).replace('.', ',')}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs py-1 border-t border-slate-800/40">
          <span className="text-slate-400">Diferença Necessária:</span>
          <span className={`font-mono font-bold ${
            currentAverageTicket >= targetAverageTicket ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {currentAverageTicket >= targetAverageTicket ? '+' : ''}
            R$ {(currentAverageTicket - targetAverageTicket).toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      <div className={`p-3.5 rounded border space-y-3 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 brand-icon" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
              Simulador Interativo ("E se...?")
            </h3>
          </div>
          <span className="text-[10px] font-mono brand-text font-bold">
            Simulação Dinâmica
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Se o seu Ticket Médio for:</span>
            <span className="font-mono font-black text-sm brand-text">
              R$ {simulatedTicket},00
            </span>
          </div>

          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={simulatedTicket}
            onChange={(e) => {
              hapticLight();
              setSimulatedTicket(parseInt(e.target.value, 10));
            }}
            style={{ accentColor: 'var(--brand-primary)' }}
            className="w-full cursor-pointer h-1.5 bg-slate-950 rounded-lg"
          />

          <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-xs space-y-1 mt-2">
            <p className="text-slate-300">
              Com um ticket de <strong className="brand-text">R$ {simulatedTicket},00</strong>, você precisará de:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 block uppercase">Total / Mês</span>
                <strong className="text-white text-xs">{requiredAppointmentsWithSimulatedTicket} clientes</strong>
              </div>

              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-center">
                <span className="text-[9px] text-slate-400 block uppercase">Atend./Dia ({workDays}d)</span>
                <strong className="brand-text text-xs">{simulatedDailyClientsNeeded} clientes/dia</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
