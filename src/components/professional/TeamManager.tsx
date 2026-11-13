import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, User as UserIcon, 
  Trash2, ArrowLeft, ChevronRight, Check,
  Briefcase, ShieldCheck, Scissors, Calendar, Clock, Save, Camera, Layers,
  Plus, X
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  hapticLight,
  hapticSuccess,
  hapticMedium,
  ProfessionalTeamMember,
  ProfessionalRole,
  ProfessionalAccessType,
  ProfessionalJobFunctionType,
  ProfessionalDayScheduleSlot,
  ProfessionalWorkSchedule,
  SalonProfessionalItem,
  CatalogServiceItem,
  DayOperatingHours,
} from '../../types';
import { generateUuidV4 } from '../../lib/supabase';

const INITIAL_TEAM: ProfessionalTeamMember[] = [];

const DEFAULT_CATEGORIES = [
  'Cabelo',
  'Barba',
  'Combos',
  'Estética',
  'Tratamentos',
  'Rosto',
  'Unhas',
];

const WEEK_DAYS_CONFIG = [
  { key: 'seg', shortLabel: 'Seg', fullLabel: 'Segunda-feira' },
  { key: 'ter', shortLabel: 'Ter', fullLabel: 'Terça-feira' },
  { key: 'qua', shortLabel: 'Qua', fullLabel: 'Quarta-feira' },
  { key: 'qui', shortLabel: 'Qui', fullLabel: 'Quinta-feira' },
  { key: 'sex', shortLabel: 'Sex', fullLabel: 'Sexta-feira' },
  { key: 'sab', shortLabel: 'Sáb', fullLabel: 'Sábado' },
  { key: 'dom', shortLabel: 'Dom', fullLabel: 'Domingo' },
] as const;

export const createDefaultProDays = (
  open = '09:00',
  close = '18:00',
  withBreak = true
): DayOperatingHours[] => [
  { dayKey: 'seg', dayLabel: 'Seg', isOpen: true, openTime: open, closeTime: close, hasBreak: withBreak, breakStart: '12:00', breakEnd: '13:00' },
  { dayKey: 'ter', dayLabel: 'Ter', isOpen: true, openTime: open, closeTime: close, hasBreak: withBreak, breakStart: '12:00', breakEnd: '13:00' },
  { dayKey: 'qua', dayLabel: 'Qua', isOpen: true, openTime: open, closeTime: close, hasBreak: withBreak, breakStart: '12:00', breakEnd: '13:00' },
  { dayKey: 'qui', dayLabel: 'Qui', isOpen: true, openTime: open, closeTime: close, hasBreak: withBreak, breakStart: '12:00', breakEnd: '13:00' },
  { dayKey: 'sex', dayLabel: 'Sex', isOpen: true, openTime: open, closeTime: close, hasBreak: withBreak, breakStart: '12:00', breakEnd: '13:00' },
  { dayKey: 'sab', dayLabel: 'Sáb', isOpen: true, openTime: open, closeTime: '14:00', hasBreak: false, breakStart: '12:00', breakEnd: '13:00' },
  { dayKey: 'dom', dayLabel: 'Dom', isOpen: false, openTime: '09:00', closeTime: '14:00', hasBreak: false, breakStart: '12:00', breakEnd: '13:00' },
];

export const mapMemberToScheduleDays = (member: ProfessionalTeamMember): DayOperatingHours[] => {
  try {
    const rawAdmin = localStorage.getItem('vagou_admin_settings');
    if (rawAdmin) {
      const parsed = JSON.parse(rawAdmin);
      const savedProDays = parsed?.operatingSchedule?.professionalSchedules?.[member.id];
      if (Array.isArray(savedProDays) && savedProDays.length === 7) {
        return savedProDays.map((d: DayOperatingHours) => ({
          ...d,
          hasBreak: d.hasBreak ?? false,
          breakStart: d.breakStart || '12:00',
          breakEnd: d.breakEnd || '13:00',
        }));
      }
    }
  } catch {}

  const defaults = createDefaultProDays(
    member.workSchedule?.startTime || '09:00',
    member.workSchedule?.endTime || '18:00'
  );

  const activeDays = member.workSchedule?.days || ['seg', 'ter', 'qua', 'qui', 'sex'];
  const dailySlots = member.workSchedule?.dailySchedules || {};

  return defaults.map((d) => {
    const isDayOpen = activeDays.includes(d.dayKey);
    const slot = dailySlots[d.dayKey];
    if (!slot) {
      return { ...d, isOpen: isDayOpen };
    }
    const hasBreak = slot.hasBreak !== undefined
      ? Boolean(slot.hasBreak)
      : Boolean(slot.afternoonStart && slot.morningEnd && slot.afternoonStart !== slot.morningEnd);
    const openTime = slot.openTime || slot.morningStart || d.openTime;
    const closeTime = slot.closeTime || slot.afternoonEnd || slot.morningEnd || d.closeTime;
    const breakStart = slot.breakStart || slot.morningEnd || '12:00';
    const breakEnd = slot.breakEnd || slot.afternoonStart || '13:00';
    return {
      dayKey: d.dayKey,
      dayLabel: d.dayLabel,
      isOpen: isDayOpen,
      openTime,
      closeTime,
      hasBreak,
      breakStart,
      breakEnd,
    };
  });
};

export function createDefaultDailySchedules(days: string[] = ['seg', 'ter', 'qua', 'qui', 'sex']): Record<string, ProfessionalDayScheduleSlot> {
  const map: Record<string, ProfessionalDayScheduleSlot> = {};
  WEEK_DAYS_CONFIG.forEach((d) => {
    map[d.key] = {
      dayKey: d.key,
      morningStart: '08:00',
      morningEnd: '12:00',
      afternoonStart: '13:00',
      afternoonEnd: '18:00',
      isOpen: days.includes(d.key),
      openTime: '09:00',
      closeTime: '18:00',
      hasBreak: true,
      breakStart: '12:00',
      breakEnd: '13:00',
    };
  });
  return map;
}

export interface TeamManagerProps {
  salonProfessionals?: SalonProfessionalItem[];
  onUpdateSalonProfessionals?: (professionals: SalonProfessionalItem[]) => void;
  services?: CatalogServiceItem[];
  onBack?: () => void;
}

function mapSalonProsToTeamMembers(pros?: SalonProfessionalItem[]): ProfessionalTeamMember[] {
  if (!Array.isArray(pros) || pros.length === 0) return [];
  return pros.map((p) => {
    const rawRole = String(p.role || '').toLowerCase();
    const accessType: ProfessionalAccessType =
      p.accessType ||
      (p.systemRole === 'superadmin' || rawRole.includes('super')
        ? 'superadmin'
        : p.systemRole === 'admin' || rawRole.includes('admin') || rawRole.includes('dono') || rawRole.includes('gerente')
        ? 'admin'
        : 'professional');

    const mappedRole: ProfessionalRole =
      accessType === 'superadmin'
        ? 'superadmin'
        : accessType === 'admin'
        ? 'admin'
        : rawRole.includes('recep')
        ? 'receptionist'
        : 'professional';

    let jobFunctionType: ProfessionalJobFunctionType = p.jobFunctionType || 'autonomo';
    let customJobFunction = p.customJobFunction || '';
    if (!p.jobFunctionType) {
      if (rawRole.includes('recep')) jobFunctionType = 'recepcionista';
      else if (rawRole.includes('atendente')) jobFunctionType = 'atendente';
      else if (rawRole.includes('autonomo') || rawRole.includes('autônomo')) jobFunctionType = 'autonomo';
      else if (p.role && !['Profissional', 'Dono / Gerente', 'Administrador'].includes(p.role)) {
        jobFunctionType = 'outros';
        customJobFunction = p.role;
      }
    }

    const defaultDays = p.workSchedule?.days?.length
      ? p.workSchedule.days
      : ['seg', 'ter', 'qua', 'qui', 'sex'];

    const existingDaily = p.workSchedule?.dailySchedules || createDefaultDailySchedules(defaultDays);

    return {
      id: p.id || generateUuidV4(),
      name: p.name || 'Profissional',
      role: mappedRole,
      accessType,
      jobFunctionType,
      customJobFunction,
      categories: Array.isArray(p.categories)
        ? p.categories
        : Array.isArray(p.specialties) && p.specialties.length > 0
        ? p.specialties
        : ['Cabelo'],
      serviceIds: Array.isArray(p.serviceIds) ? p.serviceIds : [],
      serviceNames: Array.isArray(p.serviceNames) ? p.serviceNames : [],
      avatarUrl: p.avatarUrl || p.avatar || undefined,
      phone: p.phone || '',
      email: p.email || '',
      specialties: Array.isArray(p.specialties) && p.specialties.length > 0 ? p.specialties : ['Geral'],
      commissionRate: p.commissionRate ?? (mappedRole === 'admin' ? 100 : 50),
      workSchedule: {
        shiftType: p.workSchedule?.shiftType || 'personalizado',
        shiftLabel:
          p.workSchedule?.shiftLabel ||
          'Seg a Sex • 08:00 às 12:00 / 13:00 às 18:00',
        days: defaultDays,
        startTime: p.workSchedule?.startTime || '08:00',
        endTime: p.workSchedule?.endTime || '18:00',
        dailySchedules: existingDaily,
      },
      isActive: p.isActive !== false,
      joinedAt: new Date().toISOString(),
    };
  });
}

export const TeamManager: React.FC<TeamManagerProps> = ({
  salonProfessionals,
  onUpdateSalonProfessionals,
  services = [],
}) => {
  const { isDark } = useTheme();

  const [team, setTeam] = useState<ProfessionalTeamMember[]>(() => {
    if (Array.isArray(salonProfessionals) && salonProfessionals.length > 0) {
      return mapSalonProsToTeamMembers(salonProfessionals);
    }
    try {
      const saved =
        localStorage.getItem('vagou_salon_team_members') ||
        localStorage.getItem('vagou_team_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_TEAM;
  });

  useEffect(() => {
    if (Array.isArray(salonProfessionals) && salonProfessionals.length > 0) {
      setTeam(mapSalonProsToTeamMembers(salonProfessionals));
    }
  }, [salonProfessionals]);

  // Controle de navegação: 'list' (lista de botões dos profissionais) vs 'detail' (seção do profissional selecionado)
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list');
  const [editingMember, setEditingMember] = useState<ProfessionalTeamMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProfessionalTeamMember | null>(null);

  // Estados da Seção do Profissional
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formName, setFormName] = useState('');
  const [formJobFunction, setFormJobFunction] = useState<ProfessionalJobFunctionType>('autonomo');
  const [formCustomJobFunction, setFormCustomJobFunction] = useState('');
  const [formAccessType, setFormAccessType] = useState<ProfessionalAccessType>('professional');
  const [formCategories, setFormCategories] = useState<string[]>(['Cabelo']);
  const [formServiceIds, setFormServiceIds] = useState<string[]>([]);
  const [formScheduleDays, setFormScheduleDays] = useState<DayOperatingHours[]>(() =>
    createDefaultProDays('09:00', '18:00', true)
  );

  // Categorias disponíveis no salão (combinando catálogo + localStorage + padrão)
  const availableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    try {
      const savedCats = localStorage.getItem('vagou_custom_categories');
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed)) {
          parsed.forEach((c) => {
            if (typeof c === 'string' && c.trim()) set.add(c.trim());
          });
        }
      }
    } catch {}
    services.forEach((s) => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return Array.from(set);
  }, [services]);

  // Serviços disponíveis no salão (do catálogo ou localStorage)
  const allCatalogServices = useMemo<CatalogServiceItem[]>(() => {
    if (Array.isArray(services) && services.length > 0) return services;
    try {
      const saved = localStorage.getItem('vagou_catalog_services');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  }, [services]);

  // Filtra os serviços pelas categorias selecionadas pelo profissional (ou mostra todos se nenhuma categoria filtrar)
  const filteredServicesForPro = useMemo(() => {
    if (formCategories.length === 0) return allCatalogServices;
    const lowerCats = new Set(formCategories.map((c) => c.toLowerCase()));
    const matching = allCatalogServices.filter(
      (srv) => srv.category && lowerCats.has(srv.category.toLowerCase())
    );
    return matching.length > 0 ? matching : allCatalogServices;
  }, [allCatalogServices, formCategories]);

  const resolveJobFunctionLabel = (
    fnType: ProfessionalJobFunctionType,
    customText: string
  ): string => {
    if (fnType === 'atendente') return 'Atendente';
    if (fnType === 'recepcionista') return 'Recepcionista';
    if (fnType === 'autonomo') return 'Prof. Autônomo';
    return customText.trim() || 'Outros';
  };

  const generateShiftSummaryLabel = (scheduleDays: DayOperatingHours[]): string => {
    const activeDays = scheduleDays.filter((d) => d.isOpen);
    if (activeDays.length === 0) return 'Sem expediente definido';
    const first = activeDays[0];
    const daysText =
      activeDays.length === 5 &&
      activeDays.some((d) => d.dayKey === 'seg') &&
      activeDays.some((d) => d.dayKey === 'sex') &&
      !activeDays.some((d) => d.dayKey === 'sab') &&
      !activeDays.some((d) => d.dayKey === 'dom')
        ? 'Seg a Sex'
        : activeDays.map((d) => d.dayLabel).join(', ');

    const timeRange = first.hasBreak
      ? `${first.openTime} às ${first.breakStart || '12:00'} - ${first.breakEnd || '13:00'} às ${first.closeTime}`
      : `${first.openTime} às ${first.closeTime}`;

    return `${daysText} • ${timeRange}`;
  };

  const saveTeam = (newTeam: ProfessionalTeamMember[]) => {
    setTeam(newTeam);
    try {
      localStorage.setItem('vagou_team_members', JSON.stringify(newTeam));
      localStorage.setItem('vagou_salon_team_members', JSON.stringify(newTeam));
      window.dispatchEvent(new Event('storage'));
    } catch {}

    if (onUpdateSalonProfessionals) {
      const mappedPros: SalonProfessionalItem[] = newTeam.map((member) => ({
        id: member.id,
        name: member.name,
        role: resolveJobFunctionLabel(
          member.jobFunctionType || 'autonomo',
          member.customJobFunction || ''
        ),
        systemRole:
          member.accessType === 'superadmin'
            ? 'superadmin'
            : member.accessType === 'admin'
            ? 'admin'
            : 'member',
        accessType: member.accessType || 'professional',
        jobFunctionType: member.jobFunctionType || 'autonomo',
        customJobFunction: member.customJobFunction || '',
        categories: member.categories || member.specialties,
        serviceIds: member.serviceIds || [],
        serviceNames: member.serviceNames || [],
        avatar: member.avatarUrl,
        avatarUrl: member.avatarUrl,
        phone: member.phone,
        email: member.email,
        commissionRate: member.commissionRate,
        specialties:
          member.categories && member.categories.length > 0
            ? member.categories
            : member.specialties,
        workSchedule: member.workSchedule,
        isActive: member.isActive,
        rating: 5.0,
      }));
      onUpdateSalonProfessionals(mappedPros);
    }
  };

  // Abrir Seção do Profissional (edição ou criação)
  const handleOpenProfessionalSection = (member?: ProfessionalTeamMember) => {
    hapticLight();
    if (member) {
      setEditingMember(member);
      setFormAvatarUrl(member.avatarUrl || '');
      setFormName(member.name || '');
      setFormJobFunction(member.jobFunctionType || 'autonomo');
      setFormCustomJobFunction(member.customJobFunction || '');
      setFormAccessType(
        member.accessType ||
          (member.role === 'superadmin'
            ? 'superadmin'
            : member.role === 'admin'
            ? 'admin'
            : 'professional')
      );
      setFormCategories(
        Array.isArray(member.categories) && member.categories.length > 0
          ? member.categories
          : Array.isArray(member.specialties) && member.specialties.length > 0
          ? member.specialties
          : ['Cabelo']
      );
      setFormServiceIds(
        Array.isArray(member.serviceIds) && member.serviceIds.length > 0
          ? member.serviceIds
          : allCatalogServices.map((s) => s.id)
      );

      setFormScheduleDays(mapMemberToScheduleDays(member));
    } else {
      setEditingMember(null);
      setFormAvatarUrl('');
      setFormName('');
      setFormJobFunction('autonomo');
      setFormCustomJobFunction('');
      setFormAccessType('professional');
      setFormCategories(availableCategories.slice(0, 1));
      setFormServiceIds(allCatalogServices.map((s) => s.id));
      setFormScheduleDays(createDefaultProDays('09:00', '18:00', true));
    }
    setActiveView('detail');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleCategory = (cat: string) => {
    hapticLight();
    setFormCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const toggleServiceId = (srvId: string) => {
    hapticLight();
    setFormServiceIds((prev) =>
      prev.includes(srvId) ? prev.filter((id) => id !== srvId) : [...prev, srvId]
    );
  };

  const toggleScheduleDay = (dayKey: string) => {
    hapticLight();
    setFormScheduleDays((prev) =>
      prev.map((d) => (d.dayKey === dayKey ? { ...d, isOpen: !d.isOpen } : d))
    );
  };

  const updateScheduleDayField = <K extends keyof DayOperatingHours>(
    dayKey: string,
    field: K,
    value: DayOperatingHours[K]
  ) => {
    setFormScheduleDays((prev) =>
      prev.map((d) => (d.dayKey === dayKey ? { ...d, [field]: value } : d))
    );
  };

  const replicateFirstDayScheduleToAll = () => {
    hapticSuccess();
    const firstActive = formScheduleDays.find((d) => d.isOpen) || formScheduleDays[0];
    if (!firstActive) return;
    setFormScheduleDays((prev) =>
      prev.map((d) =>
        d.isOpen
          ? {
              ...d,
              openTime: firstActive.openTime,
              closeTime: firstActive.closeTime,
              hasBreak: firstActive.hasBreak,
              breakStart: firstActive.breakStart,
              breakEnd: firstActive.breakEnd,
            }
          : d
      )
    );
  };

  const handleSaveProfessional = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName.trim()) return;

    const cleanedAvatarUrl = formAvatarUrl.trim();
    const mappedRole: ProfessionalRole =
      formAccessType === 'superadmin'
        ? 'superadmin'
        : formAccessType === 'admin'
        ? 'admin'
        : formJobFunction === 'recepcionista'
        ? 'receptionist'
        : 'professional';

    const selectedServiceNames = allCatalogServices
      .filter((s) => formServiceIds.includes(s.id))
      .map((s) => s.title);

    const activeDayKeys = formScheduleDays.filter((d) => d.isOpen).map((d) => d.dayKey);
    const firstActiveDay = formScheduleDays.find((d) => d.isOpen) || formScheduleDays[0];

    const dailySchedules: Record<string, ProfessionalDayScheduleSlot> = {};
    formScheduleDays.forEach((d) => {
      dailySchedules[d.dayKey] = {
        dayKey: d.dayKey,
        isOpen: d.isOpen,
        morningStart: d.openTime,
        morningEnd: d.hasBreak ? (d.breakStart || '12:00') : d.closeTime,
        afternoonStart: d.hasBreak ? (d.breakEnd || '13:00') : d.openTime,
        afternoonEnd: d.closeTime,
        openTime: d.openTime,
        closeTime: d.closeTime,
        hasBreak: d.hasBreak,
        breakStart: d.breakStart,
        breakEnd: d.breakEnd,
      };
    });

    const workSchedule: ProfessionalWorkSchedule = {
      shiftType: 'personalizado',
      shiftLabel: generateShiftSummaryLabel(formScheduleDays),
      days: activeDayKeys,
      startTime: firstActiveDay.openTime,
      endTime: firstActiveDay.closeTime,
      dailySchedules,
    };

    const specsArray =
      formCategories.length > 0
        ? formCategories
        : [resolveJobFunctionLabel(formJobFunction, formCustomJobFunction)];

    const targetMemberId = editingMember ? editingMember.id : generateUuidV4();

    let updatedTeam: ProfessionalTeamMember[];

    if (editingMember) {
      updatedTeam = team.map((m) =>
        m.id === editingMember.id
          ? {
              ...m,
              name: formName.trim(),
              role: mappedRole,
              accessType: formAccessType,
              jobFunctionType: formJobFunction,
              customJobFunction: formCustomJobFunction.trim(),
              categories: formCategories,
              serviceIds: formServiceIds,
              serviceNames: selectedServiceNames,
              specialties: specsArray,
              workSchedule,
              avatarUrl: cleanedAvatarUrl || undefined,
            }
          : m
      );
    } else {
      const newMember: ProfessionalTeamMember = {
        id: targetMemberId,
        name: formName.trim(),
        role: mappedRole,
        accessType: formAccessType,
        jobFunctionType: formJobFunction,
        customJobFunction: formCustomJobFunction.trim(),
        categories: formCategories,
        serviceIds: formServiceIds,
        serviceNames: selectedServiceNames,
        specialties: specsArray,
        commissionRate: mappedRole === 'admin' || mappedRole === 'superadmin' ? 100 : 50,
        workSchedule,
        avatarUrl: cleanedAvatarUrl || undefined,
        isActive: true,
        joinedAt: new Date().toISOString(),
      };
      updatedTeam = [...team, newMember];
    }

    // Sincronização automática com a agenda de profissionais de vagou_admin_settings
    try {
      const rawAdmin = localStorage.getItem('vagou_admin_settings');
      if (rawAdmin) {
        const parsed = JSON.parse(rawAdmin);
        if (!parsed.operatingSchedule) {
          parsed.operatingSchedule = { preset: 'personalizado', days: [] };
        }
        if (!parsed.operatingSchedule.professionalSchedules) {
          parsed.operatingSchedule.professionalSchedules = {};
        }
        parsed.operatingSchedule.professionalSchedules[targetMemberId] = formScheduleDays;
        localStorage.setItem('vagou_admin_settings', JSON.stringify(parsed));
      }
    } catch {}

    saveTeam(updatedTeam);
    hapticSuccess();
    setActiveView('list');
  };

  const handleDelete = (id: string) => {
    const updatedTeam = team.filter((m) => m.id !== id);
    saveTeam(updatedTeam);
    setDeleteConfirm(null);
    setActiveView('list');
    hapticMedium();
  };

  // ============================================================================
  // VISÃO 2: SEÇÃO DEDICADA DO PROFISSIONAL SELECIONADO (EDIÇÃO COMPLETA)
  // ============================================================================
  if (activeView === 'detail') {
    const isMainAdmin = editingMember?.role === 'admin' && editingMember?.id === 'prof_admin_1';

    return (
      <div
        className={`flex flex-col h-full justify-between overflow-y-auto no-scrollbar ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Cabeçalho da Seção do Profissional */}
        <div
          className={`px-3.5 py-2.5 border-b shrink-0 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md ${
            isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveView('list');
              }}
              className={`p-1.5 rounded-[4px] transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar à lista de profissionais"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-500" />
            </button>
            <h2 className="text-xs sm:text-sm font-bold font-['Poppins'] truncate">
              {editingMember ? editingMember.name : 'Novo Profissional'}
            </h2>
          </div>

          {editingMember && !isMainAdmin && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setDeleteConfirm(editingMember);
              }}
              className="px-2.5 py-1 rounded-[4px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>
          )}
        </div>

        {/* Formulário Completo da Seção do Profissional */}
        <form onSubmit={handleSaveProfessional} className="p-3.5 space-y-4 pb-24 flex-1">
          {/* 1. FOTO DE PERFIL & NOME */}
          <div
            className={`p-3.5 rounded-[4px] border space-y-3.5 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`w-16 h-16 rounded-[4px] shrink-0 border flex items-center justify-center relative overflow-hidden ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                {formAvatarUrl ? (
                  <img
                    src={formAvatarUrl}
                    alt={formName || 'Foto de perfil'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="w-7 h-7 text-slate-500" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Foto de Perfil
                </span>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer transition">
                  <Camera className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Selecionar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>

            {/* Nome do Profissional */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nome *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Carlos Silva"
                className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
              />
            </div>

            {/* 2. FUNÇÃO (Atendente, Recepcionista, Prof. Autônomo ou Outros com Input de Texto) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                <span>Função</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'atendente' as ProfessionalJobFunctionType, label: 'Atendente' },
                  { id: 'recepcionista' as ProfessionalJobFunctionType, label: 'Recepcionista' },
                  { id: 'autonomo' as ProfessionalJobFunctionType, label: 'Prof. Autônomo' },
                  { id: 'outros' as ProfessionalJobFunctionType, label: 'Outros' },
                ].map((opt) => {
                  const isSel = formJobFunction === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setFormJobFunction(opt.id);
                      }}
                      className={`py-2 px-2.5 rounded-[4px] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        isSel
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : isDark
                          ? 'bg-slate-950 text-slate-300 hover:text-white'
                          : 'bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span className={isSel ? 'text-white' : ''}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {formJobFunction === 'outros' && (
                <input
                  type="text"
                  value={formCustomJobFunction}
                  onChange={(e) => setFormCustomJobFunction(e.target.value)}
                  placeholder="Digite a função (ex: Barbeiro, Manicure, Esteticista...)"
                  className={`w-full px-3 py-2 rounded-[4px] border text-xs outline-hidden transition animate-in fade-in ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              )}
            </div>

            {/* 3. TIPO (Profissional, Administrador, Superadministrador) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tipo</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'professional' as ProfessionalAccessType, label: 'Profissional' },
                  { id: 'admin' as ProfessionalAccessType, label: 'Administrador' },
                  { id: 'superadmin' as ProfessionalAccessType, label: 'Superadministrador' },
                ].map((opt) => {
                  const isSel = formAccessType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setFormAccessType(opt.id);
                      }}
                      className={`py-2 px-2 rounded-[4px] text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap truncate ${
                        isSel
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : isDark
                          ? 'bg-slate-950 text-slate-300 hover:text-white'
                          : 'bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span className={`truncate ${isSel ? 'text-white' : ''}`}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. CATEGORIAS & SERVIÇOS QUE ELE TRABALHA */}
          <div
            className={`p-3.5 rounded-[4px] border space-y-3.5 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            {/* Categorias que ele atende */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Categorias que Atende</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-400">
                  {formCategories.length} selecionadas
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {availableCategories.map((cat) => {
                  const isSel = formCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-[4px] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        isSel
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : isDark
                          ? 'bg-slate-950 text-slate-300 hover:text-white'
                          : 'bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {isSel && <Check className="w-3 h-3 text-white shrink-0" />}
                      <span className={isSel ? 'text-white' : ''}>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lista de Serviços que ele trabalha */}
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Serviços que Trabalha</span>
                </label>
                {filteredServicesForPro.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      const allVisibleIds = filteredServicesForPro.map((s) => s.id);
                      const allSelected = allVisibleIds.every((id) => formServiceIds.includes(id));
                      if (allSelected) {
                        setFormServiceIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
                      } else {
                        setFormServiceIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
                      }
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  >
                    Alternar Todos
                  </button>
                )}
              </div>

              {filteredServicesForPro.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">
                  Nenhum serviço cadastrado ainda na seção Serviços.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredServicesForPro.map((srv) => {
                    const isSel = formServiceIds.includes(srv.id);
                    return (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => toggleServiceId(srv.id)}
                        className={`p-2 rounded-[4px] text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer text-left ${
                          isSel
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : isDark
                            ? 'bg-slate-950 text-slate-300 hover:text-white'
                            : 'bg-slate-100 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <div className="min-w-0 truncate">
                          <span className={`block truncate ${isSel ? 'text-white' : ''}`}>
                            {srv.title}
                          </span>
                          <span
                            className={`text-[10px] font-normal ${
                              isSel ? 'text-white/90' : 'text-slate-400'
                            }`}
                          >
                            {srv.category} • R$ {srv.price}
                          </span>
                        </div>
                        {isSel && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 5. ATENDIMENTO: DIAS DE FUNCIONAMENTO + HORÁRIOS COM INTERVALO/PAUSA (MODELO OFICIAL) */}
          <div
            className={`p-3.5 rounded-[4px] border space-y-3.5 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                  Atendimento
                </h3>
              </div>
              <button
                type="button"
                onClick={replicateFirstDayScheduleToAll}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                title="Copiar o horário do primeiro dia para todos os dias selecionados"
              >
                Repetir 1º dia em todos
              </button>
            </div>

            {/* Dias de Funcionamento (Grid de 7 Dias com Aberto / Off) */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Dias de Atendimento
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {formScheduleDays.map((d) => (
                  <button
                    key={d.dayKey}
                    type="button"
                    onClick={() => toggleScheduleDay(d.dayKey)}
                    className={`py-2 rounded-[4px] text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                      d.isOpen
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : isDark
                        ? 'bg-slate-950 text-slate-500'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span className={d.isOpen ? 'text-white' : ''}>{d.dayLabel}</span>
                    <span className={`text-[9px] mt-0.5 ${d.isOpen ? 'text-white font-semibold' : 'text-slate-500'}`}>
                      {d.isOpen ? 'Aberto' : 'Off'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Horários de Atendimento (Ajuste por Dia • Intervalo / Pausa) */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Horários de Atendimento (Ajuste por Dia • Intervalo / Pausa)
              </label>

              <div className="divide-y divide-slate-800/60">
                {formScheduleDays.map((d) => (
                  <div
                    key={d.dayKey}
                    className={`py-2.5 flex flex-col gap-2 text-xs transition ${
                      !d.isOpen ? 'opacity-45' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-9">{d.dayLabel}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-bold ${
                            d.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {d.isOpen ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>

                      {d.isOpen ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {d.hasBreak ? (
                            <>
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={d.openTime}
                                  onChange={(e) => updateScheduleDayField(d.dayKey, 'openTime', e.target.value)}
                                  className={`px-1.5 py-1 rounded-[4px] border text-[11px] font-mono outline-hidden ${
                                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                  }`}
                                />
                                <span className="text-[10px] text-slate-400">às</span>
                                <input
                                  type="time"
                                  value={d.breakStart || '12:00'}
                                  onChange={(e) => updateScheduleDayField(d.dayKey, 'breakStart', e.target.value)}
                                  className={`px-1.5 py-1 rounded-[4px] border text-[11px] font-mono outline-hidden ${
                                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                  }`}
                                />
                              </div>

                              <span className="text-xs font-bold text-emerald-400">-</span>

                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={d.breakEnd || '13:00'}
                                  onChange={(e) => updateScheduleDayField(d.dayKey, 'breakEnd', e.target.value)}
                                  className={`px-1.5 py-1 rounded-[4px] border text-[11px] font-mono outline-hidden ${
                                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                  }`}
                                />
                                <span className="text-[10px] text-slate-400">às</span>
                                <input
                                  type="time"
                                  value={d.closeTime}
                                  onChange={(e) => updateScheduleDayField(d.dayKey, 'closeTime', e.target.value)}
                                  className={`px-1.5 py-1 rounded-[4px] border text-[11px] font-mono outline-hidden ${
                                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                  }`}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => updateScheduleDayField(d.dayKey, 'hasBreak', false)}
                                className="p-1 rounded-[4px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                title="Remover intervalo / pausa"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <input
                                type="time"
                                value={d.openTime}
                                onChange={(e) => updateScheduleDayField(d.dayKey, 'openTime', e.target.value)}
                                className={`px-1.5 py-1 rounded-[4px] border text-[11px] font-mono outline-hidden ${
                                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                              <span className="text-[10px] text-slate-400">às</span>
                              <input
                                type="time"
                                value={d.closeTime}
                                onChange={(e) => updateScheduleDayField(d.dayKey, 'closeTime', e.target.value)}
                                className={`px-1.5 py-1 rounded-[4px] border text-[11px] font-mono outline-hidden ${
                                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  hapticLight();
                                  updateScheduleDayField(d.dayKey, 'hasBreak', true);
                                }}
                                className="px-2 py-1 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                              >
                                <Plus className="w-3 h-3 text-white" />
                                <span className="text-white">Pausa</span>
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Sem expediente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Modal de Confirmação de Exclusão */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className={`w-full max-w-sm rounded-[4px] overflow-hidden shadow-2xl border p-4 space-y-4 ${
                isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[4px] bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold font-['Poppins']">Excluir Profissional?</h3>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Tem certeza que deseja remover <strong>{deleteConfirm.name}</strong> da equipe?
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className={`px-4 py-2 rounded-[4px] text-xs font-bold transition cursor-pointer border ${
                    isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="px-4 py-2 rounded-[4px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Excluir</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé Fixo de Ação (sticky bottom-0 z-20) */}
        <div
          className={`sticky bottom-0 z-20 p-3 border-t backdrop-blur-md flex items-center justify-between gap-3 ${
            isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setActiveView('list');
            }}
            className={`px-4 py-2.5 rounded-[4px] border text-xs font-bold transition cursor-pointer ${
              isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => handleSaveProfessional()}
            className="flex-1 py-2.5 px-4 rounded-[4px] brand-btn font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
          >
            <Save className="w-4 h-4 text-white" />
            <span className="text-white">Salvar Profissional</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VISÃO 1: LISTA DE PROFISSIONAIS (BOTÕES LIMPOS QUE LEVAM À SEÇÃO DO PROFISSIONAL)
  // ============================================================================
  return (
    <div
      className={`flex flex-col h-full ${
        isDark ? 'bg-slate-950 text-slate-200' : 'bg-[var(--brand-canvas-bg)] text-slate-800'
      }`}
    >
      {/* HEADER */}
      <div
        className={`p-3.5 border-b shrink-0 flex items-center justify-between sticky top-0 z-20 ${
          isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200'
        } backdrop-blur-md`}
      >
        <div>
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 brand-icon" />
            <span>Gestão de Equipe</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => handleOpenProfessionalSection()}
          className="px-3 py-1.5 rounded-[4px] brand-btn font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <UserPlus className="w-3.5 h-3.5 text-white" />
          <span className="text-white">Adicionar</span>
        </button>
      </div>

      {/* LISTAGEM: CADA CARD É APENAS UM BOTÃO QUE LEVA O GESTOR À SEÇÃO DO PROFISSIONAL SELECIONADO */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-2.5">
        {team.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => handleOpenProfessionalSection(member)}
            className={`w-full p-3 rounded-[4px] border flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99] ${
              isDark
                ? 'bg-slate-900/70 hover:bg-slate-900 border-slate-800 hover:border-[var(--brand-primary)]'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-[var(--brand-primary)] shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-[4px] flex items-center justify-center shrink-0 overflow-hidden ${
                  isDark ? 'bg-slate-950' : 'bg-slate-100'
                }`}
              >
                {member.avatarUrl &&
                !member.avatarUrl.includes('unsplash.com') &&
                !member.avatarUrl.startsWith('data:image/svg+xml') ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon
                    className={`w-5 h-5 stroke-[1.8] ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  />
                )}
              </div>

              <h3
                className={`text-sm font-bold truncate ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {member.name}
              </h3>
            </div>

            <ChevronRight className="w-4 h-4 brand-icon shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};
