import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ArrowLeft, MapPin, Clock, 
  Heart, Zap, 
  Calendar, Coffee, Wifi, Car, Wind,
  Bell, Users, Store,
  ChevronLeft, ChevronRight, ChevronDown, ArrowRight,
  Share2, Check, MessageCircle,
  Scissors, Hand, Smile, Eye, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServiceOffer } from '../types';
import { SalonBookingModal, CatalogServiceItem } from './SalonBookingModal';
import { formatSlotDateTime } from '../utils/dateFormatter';
import { useTheme } from '../context/ThemeContext';
import { getSalonLogo } from '../utils/salonLogos';
import { BottomNav } from './BottomNav';
import { ProfileDrawer } from './ProfileDrawer';
import { getAvailableSlotsForDate } from '../utils/bookingSlots';
import { hapticSuccess, hapticLight } from '../utils/haptics';

export interface SalonProfileViewProps {
  salonName: string;
  offers: ServiceOffer[];
  onBack?: () => void;
  onDirectBook: (offer: ServiceOffer) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (salonName: string) => void;
  userName?: string;
  userAvatarUrl?: string;
}

// Cabeçalho de Seção Fixo Padrão que gruda perfeitamente abaixo do cabeçalho principal
interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
  isDark?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({ title, action, className = '', isDark = true }) => (
  <div
    className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border-y flex items-center justify-between transition-colors shadow-xs shrink-0 ${
      isDark
        ? 'bg-gradient-to-r from-emerald-950/95 via-emerald-900/70 to-slate-950/95 border-emerald-500/30'
        : 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-emerald-50/95 border-emerald-500/30'
    } ${className}`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-1 h-3.5 sm:h-4 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
      <h2
        className={`text-[12px] font-bold uppercase tracking-wider font-['Poppins'] truncate ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </h2>
    </div>
    {action && (
      <div className="flex items-center gap-2 shrink-0">
        {action}
      </div>
    )}
  </div>
));

export const SalonProfileView: React.FC<SalonProfileViewProps> = ({
  salonName,
  offers,
  onBack,
  onDirectBook,
  isFavorite = false,
  onToggleFavorite,
  userName = 'Lucas Silva',
  userAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
}) => {
  const { isDark } = useTheme();
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>(userName);

  useEffect(() => {
    if (userName) {
      setCurrentUserName(userName);
    }
  }, [userName]);

  const [activeTab, setActiveTab] = useState<'home' | 'servicos' | 'vagas' | 'espaco'>('home');
  const [bookingService, setBookingService] = useState<CatalogServiceItem | null>(null);
  const [skipDateStep, setSkipDateStep] = useState<boolean>(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  // Refs para controle do scroll snap da landing page
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const homeSectionRef = useRef<HTMLElement>(null);
  const servicosSectionRef = useRef<HTMLElement>(null);
  const vagasSectionRef = useRef<HTMLElement>(null);
  const espacoSectionRef = useRef<HTMLElement>(null);
  const isProgrammaticScroll = useRef<boolean>(false);

  // Paginação e efeito swap para o catálogo enquadrado de serviços (4 por visualização)
  const [servicePage, setServicePage] = useState<number>(0);
  const [swapDirection, setSwapDirection] = useState<number>(1);

  // Swipe/Carrossel para a seção de Espaço & Equipe (0: Espaço & Mapa, 1: Equipe & Especialistas)
  const [espacoSlideIndex, setEspacoSlideIndex] = useState<number>(0);
  const [espacoSwipeDirection, setEspacoSwipeDirection] = useState<number>(1);

  // Estado para agendamento confirmado exibido dentro da seção do salão
  const [confirmedBookingData, setConfirmedBookingData] = useState<{
    protocolCode: string;
    serviceTitle: string;
    professionalName: string;
    salonName: string;
    dateTime: string;
    totalPrice: number;
    address: string;
  } | null>(null);

  // Sincronização da tabela de horários com o modal
  const [selectedTimeSlotForBooking, setSelectedTimeSlotForBooking] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayIso = useMemo(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedCalendarDateIso, setSelectedCalendarDateIso] = useState<string>(todayIso);
  const [calendarViewMonth, setCalendarViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Geração do calendário mensal inline
  const inlineMonthData = useMemo(() => {
    const year = calendarViewMonth.getFullYear();
    const month = calendarViewMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNameFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
    const monthLabel = monthNameFormatter.format(calendarViewMonth);

    const daysGrid: Array<{
      dayNumber: number | null;
      isoString: string | null;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
      isClosed: boolean;
    }> = [];

    // Slots vazios antes do 1º dia do mês
    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.push({ dayNumber: null, isoString: null, isToday: false, isSelected: false, isDisabled: true, isClosed: false });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      dateObj.setHours(0, 0, 0, 0);

      const iso = dateObj.toISOString().split('T')[0];
      const isPast = dateObj < today;
      const isSunday = dateObj.getDay() === 0;

      const isDisabled = isPast || isSunday;
      const isToday = dateObj.getTime() === today.getTime();
      const isSelected = selectedCalendarDateIso === iso;

      daysGrid.push({
        dayNumber: d,
        isoString: iso,
        isToday,
        isSelected,
        isDisabled,
        isClosed: isSunday,
      });
    }

    return {
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      daysGrid,
      year,
      month,
    };
  }, [calendarViewMonth, today, selectedCalendarDateIso]);

  const handlePrevInlineMonth = () => {
    const prev = new Date(calendarViewMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev.getFullYear() < today.getFullYear() || (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())) {
      return;
    }
    setCalendarViewMonth(prev);
  };

  const handleNextInlineMonth = () => {
    const next = new Date(calendarViewMonth);
    next.setMonth(next.getMonth() + 1);
    setCalendarViewMonth(next);
  };

  // Horários disponíveis da data selecionada no calendário
  const agendaSlots = useMemo(() => {
    return getAvailableSlotsForDate(selectedCalendarDateIso, 'any');
  }, [selectedCalendarDateIso]);

  // Formatação resumida da data selecionada para o cabeçalho
  const selectedDateFormattedLabel = useMemo(() => {
    if (selectedCalendarDateIso === todayIso) {
      return 'Hoje';
    }
    const [, selM, selD] = selectedCalendarDateIso.split('-');
    return `${selD}/${selM}`;
  }, [selectedCalendarDateIso, todayIso]);

  // Filtrar ofertas desse salão
  const salonOffers = useMemo(() => offers.filter((o) => o.salonName === salonName), [offers, salonName]);
  const primaryOffer = salonOffers[0] || offers[0];

  // Informações consolidadas do salão
  const salonInfo = useMemo(() => ({
    name: salonName,
    avatar: getSalonLogo(salonName, primaryOffer?.salonLogo),
    coverImage: primaryOffer?.galleryImages?.[0] || primaryOffer?.imageUrl || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
    rating: primaryOffer?.rating || 4.9,
    reviewsCount: primaryOffer?.reviewsCount || 84,
    distance: primaryOffer?.distance || '850m',
    address: primaryOffer?.salonAddress || 'Rua das Flores, 1420 - Centro',
    city: 'Curitiba, PR',
    phone: '(41) 99882-1140',
    hours: 'Seg a Sáb: 09:00 às 20:00',
    verified: true,
    description: primaryOffer?.description || 'Espaço premium especializado em estética masculina e feminina de alta precisão, barboterapia, cortes modernos e bem-estar.',
    isHomeCare: false,
    amenities: [
      { icon: Wifi, label: 'Wi-Fi 5G' },
      { icon: Wind, label: 'Ar Climatizado' },
      { icon: Coffee, label: 'Café Expresso / Bar' },
      { icon: Car, label: 'Estacionamento' },
    ],
    professionals: [
      {
        name: primaryOffer?.professionalName || 'Carlos Henrique',
        role: 'Master Barber & Hair Stylist',
        avatar: primaryOffer?.professionalAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        rating: 4.9,
      },
      {
        name: 'Mateus Ramos',
        role: 'Barber & Visagista',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        rating: 4.8,
      },
      {
        name: 'Juliana Costa',
        role: 'Especialista em Mechas e Cor',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
        rating: 5.0,
      }
    ],
  }), [salonName, primaryOffer]);

  // Dinâmica: Equipe vs Perfil / Espaço vs Atendimento
  const hasMultipleProfessionals = salonInfo.professionals.length > 1;

  const spaceTabLabel = salonInfo.isHomeCare ? 'Atendimento' : 'Espaço';
  const SpaceIcon = salonInfo.isHomeCare ? Car : Store;

  // Ícone dinâmico da aba Serviços baseado na categoria e especialidade do estabelecimento
  const ServicesIcon = useMemo(() => {
    const mainCategory = (primaryOffer?.serviceCategory || '').toLowerCase();
    const nameLower = salonName.toLowerCase();
    const serviceTitles = (salonOffers.length > 0 ? salonOffers : offers)
      .map((o) => `${o.serviceTitle} ${o.serviceCategory || ''}`.toLowerCase())
      .join(' ');

    // 1. Unhas / Manicure / Pedicure / Nails / Esmaltação
    if (
      mainCategory === 'unhas' ||
      nameLower.includes('unha') ||
      nameLower.includes('nail') ||
      nameLower.includes('manicure') ||
      nameLower.includes('pedicure') ||
      nameLower.includes('esmalte') ||
      serviceTitles.includes('unha') ||
      serviceTitles.includes('manicure') ||
      serviceTitles.includes('pedicure') ||
      serviceTitles.includes('esmaltação')
    ) {
      return Hand;
    }

    // 2. Estética Facial / Rosto / Skincare / Limpeza de Pele / Visagismo
    if (
      (mainCategory === 'estetica' || mainCategory === 'beleza') &&
      (nameLower.includes('facial') ||
        nameLower.includes('rosto') ||
        nameLower.includes('pele') ||
        nameLower.includes('estética') ||
        nameLower.includes('estetica') ||
        nameLower.includes('skincare') ||
        nameLower.includes('face') ||
        serviceTitles.includes('facial') ||
        serviceTitles.includes('limpeza de pele') ||
        serviceTitles.includes('peeling') ||
        serviceTitles.includes('visagismo facial'))
    ) {
      return Smile;
    }

    // 3. Sobrancelhas / Olhar / Cílios / Lash
    if (
      nameLower.includes('sobrancelha') ||
      nameLower.includes('lash') ||
      nameLower.includes('cílios') ||
      nameLower.includes('cilios') ||
      nameLower.includes('brow') ||
      serviceTitles.includes('sobrancelha') ||
      serviceTitles.includes('extensão de cílios') ||
      serviceTitles.includes('micropigmentação')
    ) {
      return Eye;
    }

    // 4. Barbearia / Corte de Cabelo / Barba / Hair / Salão Tradicional
    if (
      mainCategory === 'cabelo' ||
      mainCategory === 'barba' ||
      nameLower.includes('barber') ||
      nameLower.includes('barba') ||
      nameLower.includes('corte') ||
      nameLower.includes('cabelo') ||
      nameLower.includes('hair') ||
      nameLower.includes('salão') ||
      nameLower.includes('salao') ||
      serviceTitles.includes('corte') ||
      serviceTitles.includes('degradê') ||
      serviceTitles.includes('barba') ||
      serviceTitles.includes('mechas') ||
      serviceTitles.includes('escova')
    ) {
      return Scissors;
    }

    // 5. Estética / Beleza geral
    if (mainCategory === 'estetica' || mainCategory === 'beleza') {
      return Smile;
    }

    // Fallback universal
    return Sparkles;
  }, [primaryOffer, salonName, salonOffers, offers]);

  // Navegação direta com scroll-snap para as seções da landing page
  const handleSelectTab = useCallback((tab: 'home' | 'servicos' | 'vagas' | 'espaco') => {
    setActiveTab(tab);
    isProgrammaticScroll.current = true;
    const targetMap: Record<'home' | 'servicos' | 'vagas' | 'espaco', HTMLElement | null> = {
      home: homeSectionRef.current,
      servicos: servicosSectionRef.current,
      vagas: vagasSectionRef.current,
      espaco: espacoSectionRef.current,
    };
    const target = targetMap[tab];
    if (target && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: target.offsetTop,
        behavior: 'smooth',
      });
    }
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 600);
  }, []);

  // Observer para sincronizar a aba ativa do rodapé ao deslizar o dedo pelas seções da landing page
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const sections = [
      { id: 'home' as const, el: homeSectionRef.current },
      { id: 'servicos' as const, el: servicosSectionRef.current },
      { id: 'vagas' as const, el: vagasSectionRef.current },
      { id: 'espaco' as const, el: espacoSectionRef.current },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const tabId = entry.target.getAttribute('data-tab-id') as 'home' | 'servicos' | 'vagas' | 'espaco';
            if (tabId) {
              setActiveTab(tabId);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      }
    );

    sections.forEach(({ el }) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Catálogo completo de serviços com fotos e cards enquadrados de tamanho uniforme
  const catalogServices: CatalogServiceItem[] = useMemo(() => [
    {
      id: 'srv-1',
      title: 'Corte Degradê / Fade Moderno',
      duration: '40 min',
      price: 55,
      description: 'Corte com acabamento preciso na lâmina, lavagem especial e finalização com pomada matte.',
      category: 'Cabelo',
      image: primaryOffer?.imageUrl || 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-[3/4]', // Vertical Alto
    },
    {
      id: 'srv-2',
      title: 'Barba Terapia Premium',
      duration: '35 min',
      price: 45,
      description: 'Design de barba com toalha quente aromática, óleos essenciais e balm pós-barba.',
      category: 'Barba',
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-square', // Quadrado
    },
    {
      id: 'srv-3',
      title: 'Combo Corte + Barba VIP',
      duration: '60 min',
      price: 90,
      description: 'Experiência completa de corte de cabelo e tratamento completo de barba.',
      category: 'Combos',
      image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-[4/3]', // Horizontal Panorâmico
    },
    {
      id: 'srv-4',
      title: 'Corte na Tesoura & Textura',
      duration: '45 min',
      price: 65,
      description: 'Técnica de corte à mão livre na tesoura com alinhamento e finalização personalizada.',
      category: 'Cabelo',
      image: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-[4/5]', // Vertical Elegante
    },
    {
      id: 'srv-5',
      title: 'Acabamento na Navalha & Visagismo',
      duration: '20 min',
      price: 30,
      description: 'Desenho de linhas com navalha descartável, visagismo facial e pós-barba calmante.',
      category: 'Rosto',
      image: 'https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-square', // Quadrado
    },
    {
      id: 'srv-6',
      title: 'Mechas & Iluminação de Fios',
      duration: '90 min',
      price: 130,
      description: 'Técnica personalizada de iluminação dos fios e tonalização exclusiva.',
      category: 'Cabelo',
      image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-[3/4]', // Vertical Alto
    },
    {
      id: 'srv-7',
      title: 'Lavagem & Hidratação Especial',
      duration: '35 min',
      price: 50,
      description: 'Higienização com massagem no couro cabeludo e máscara reconstrutora intensiva.',
      category: 'Tratamentos',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-[4/3]', // Horizontal Panorâmico
    },
    {
      id: 'srv-8',
      title: 'Cuidado Facial & Toalha Quente',
      duration: '40 min',
      price: 60,
      description: 'Higienização facial com esfoliação suave e vapor de toalha aquecida com ervas.',
      category: 'Estética',
      image: 'https://images.unsplash.com/photo-1507081323647-4d250478b919?auto=format&fit=crop&w=800&q=80',
      aspectRatio: 'aspect-[4/5]', // Vertical Elegante
    },
  ], [primaryOffer?.imageUrl]);

  const handleOpenBooking = (srv?: CatalogServiceItem, directToTimeGrid = false, timeSlot?: string, dateIso?: string) => {
    setBookingService(srv || catalogServices[0]);
    setSkipDateStep(directToTimeGrid);
    setSelectedTimeSlotForBooking(timeSlot || null);
    if (dateIso) {
      setSelectedCalendarDateIso(dateIso);
    }
    handleSelectTab('vagas');
  };

  // Slides de portfólio para o Slider da Página Inicial (Apresentação publicitária e instrução de cada seção)
  const portfolioSlides = useMemo(() => [
    {
      id: 'slide-servicos',
      title: 'Nossos Serviços',
      tagline: 'Cortes modernos, barboterapia, visagismo e procedimentos com valores transparentes.',
      image: primaryOffer?.imageUrl || 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80',
      ctaText: 'VER NOSSOS SERVIÇOS',
      ctaAction: () => handleSelectTab('servicos'),
      ctaIcon: Scissors,
    },
    {
      id: 'slide-agendamento',
      title: 'Agende de Forma Rápida',
      tagline: 'Escolha seu procedimento e confirme seu atendimento em poucos toques, de forma rápida e segura.',
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
      ctaText: 'AGENDAR AGORA',
      ctaAction: () => handleOpenBooking(catalogServices[0]),
      ctaIcon: Zap,
    },
    {
      id: 'slide-horarios',
      title: 'Consulte os Horários',
      tagline: 'Consulte os horários de forma eficiente: vagas abertas para hoje ou agende para até 60 dias.',
      image: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80',
      ctaText: 'VER HORÁRIOS DISPONÍVEIS',
      ctaAction: () => handleSelectTab('vagas'),
      ctaIcon: Calendar,
    },
    {
      id: 'slide-espaco',
      title: 'Conheça a Nossa Equipe',
      tagline: 'Profissionais renomados e ambiente climatizado com café, Wi-Fi e estacionamento privativo.',
      image: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=80',
      ctaText: 'CONHECER NOSSO ESPAÇO',
      ctaAction: () => handleSelectTab('espaco'),
      ctaIcon: Store,
    },
  ], [primaryOffer?.imageUrl, catalogServices]);

  // Autoplay suave para o slider da página inicial
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % portfolioSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [portfolioSlides.length]);

  const handleConfirmSchedule = (bookingData: {
    service: CatalogServiceItem;
    professional: string;
    professionalAvatar?: string;
    dateIso: string;
    dateFormatted: string;
    timeSlot: string;
    salonName: string;
    salonAddress: string;
    price: number;
  }) => {
    hapticSuccess();
    const rawCode = `VGA-${Math.floor(10000 + Math.random() * 90000)}`;
    if (primaryOffer) {
      onDirectBook({
        ...primaryOffer,
        id: `sched-${Date.now()}`,
        salonName: bookingData.salonName,
        serviceTitle: bookingData.service.title,
        price: bookingData.price,
        timeSlot: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
        dayLabel: bookingData.dateFormatted,
        serviceCategory: (bookingData.service.category.toLowerCase().includes('barba') ? 'barba' : 'cabelo') as any,
      });
      setConfirmedBookingData({
        protocolCode: `#${rawCode}`,
        serviceTitle: bookingData.service.title,
        professionalName: bookingData.professional,
        salonName: bookingData.salonName,
        dateTime: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
        totalPrice: bookingData.price,
        address: bookingData.salonAddress,
      });

      // Salvar nos agendamentos do usuário para visualização em Minha Agenda
      try {
        const savedList = JSON.parse(localStorage.getItem('vagou_user_appointments') || '[]');
        const newRecord = {
          protocolCode: rawCode,
          service: bookingData.service.title,
          professional: bookingData.professional,
          salonName: bookingData.salonName,
          dateTime: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
          dayGroup: bookingData.dateFormatted,
          time: bookingData.timeSlot,
          totalPrice: bookingData.price,
          status: 'CONFIRMADO',
          address: bookingData.salonAddress,
        };
        localStorage.setItem('vagou_user_appointments', JSON.stringify([newRecord, ...savedList]));
      } catch {
        // ignore
      }
    }
  };

  // Paginação e controle de swap para a seção de serviços (4 por visualização em grid enquadrado 2x2)
  const SERVICES_PER_PAGE = 4;
  const totalServicePages = Math.ceil(catalogServices.length / SERVICES_PER_PAGE);

  const handlePrevServicePage = () => {
    if (totalServicePages <= 1) return;
    setSwapDirection(-1);
    setServicePage((prev) => (prev - 1 + totalServicePages) % totalServicePages);
  };

  const handleNextServicePage = () => {
    if (totalServicePages <= 1) return;
    setSwapDirection(1);
    setServicePage((prev) => (prev + 1) % totalServicePages);
  };

  const currentServices = useMemo(() => {
    const start = servicePage * SERVICES_PER_PAGE;
    return catalogServices.slice(start, start + SERVICES_PER_PAGE);
  }, [catalogServices, servicePage]);

  // Controles de swipe/swap para os três blocos da Seção Espaço (0: Estrutura, 1: Endereço & Mapa, 2: Equipe)
  const handleNextEspacoSlide = () => {
    setEspacoSwipeDirection(1);
    setEspacoSlideIndex((prev) => (prev + 1) % 3);
  };

  const handlePrevEspacoSlide = () => {
    setEspacoSwipeDirection(-1);
    setEspacoSlideIndex((prev) => (prev - 1 + 3) % 3);
  };

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Poppins'] transition-colors duration-200`}>
      {/* 1. CABEÇALHO DO APLICATIVO DO SALÃO (Logo Full Height & Botões Selecionados) */}
      <header className={`sticky top-0 z-40 ${isDark ? 'bg-[#151A1E]/95 border-slate-800/80' : 'bg-white/95 border-slate-200/90 shadow-xs'} backdrop-blur-md border-b pr-4 shadow-md flex items-center justify-between gap-3 transition-colors h-14 sm:h-16 overflow-hidden shrink-0`}>
        {/* Lado Esquerdo: Logotipia em Texto da Empresa (Moderna, estilosa e limpa, 103px de largura) */}
        <div 
          className="h-full w-[103px] pl-3.5 pr-1 flex items-center shrink-0 select-none cursor-pointer"
          title={salonInfo.name}
        >
          <span className={`font-sans text-xs sm:text-[13px] font-extrabold tracking-tight uppercase leading-tight line-clamp-2 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            <span className="text-emerald-500">{salonInfo.name.split(' ')[0]}</span>{' '}
            {salonInfo.name.split(' ').slice(1).join(' ')}
          </span>
        </div>

        {/* Lado Direito: Favoritar + Notificação + Foto do Usuário */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Favoritar Rápido */}
          <button
            onClick={() => onToggleFavorite?.(salonInfo.name)}
            className={`w-10 h-10 rounded flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800'
                : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs'
            }`}
            title="Favoritar este estabelecimento"
            aria-label="Favoritar estabelecimento"
          >
            <Heart className={`w-4.5 h-4.5 ${isFavorite ? 'fill-rose-500 text-rose-500' : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>

          {/* Notificações / Menu do Usuário */}
          <button
            onClick={() => {
              hapticLight();
              setIsProfileDrawerOpen(true);
            }}
            className={`relative w-10 h-10 rounded flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-950 shadow-xs'
            }`}
            title="Notificações e Perfil"
            aria-label="Notificações e Perfil"
          >
            <Bell className="w-5 h-5" />
            <span className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ${isDark ? 'ring-slate-950' : 'ring-white'}`} />
          </button>

          {/* Foto do Usuário / Abrir Perfil */}
          <button
            onClick={() => {
              hapticLight();
              setIsProfileDrawerOpen(true);
            }}
            className="relative flex items-center justify-center shrink-0 w-10 h-10 rounded overflow-hidden ring-1.5 ring-emerald-500 hover:ring-emerald-400 active:scale-95 transition shadow-xs bg-slate-800 cursor-pointer"
            title={`Perfil de ${currentUserName}`}
            aria-label="Perfil do Usuário"
          >
            <img
              src={userAvatarUrl}
              alt={currentUserName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
        </div>
      </header>

      {/* 2. ÁREA DE CONTEÚDO LANDING PAGE COM SCROLL SNAP NATIVO (ENCAIXE PERFEITO ENTRE SEÇÕES) */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 w-full relative overflow-y-auto snap-y snap-mandatory snap-y-mandatory scroll-smooth no-scrollbar overscroll-y-contain touch-pan-y"
      >
        {/* SEÇÃO 1: INÍCIO */}
        <section
          id="section-home"
          ref={homeSectionRef}
          data-tab-id="home"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-between"
        >
          {/* SUBCABEÇALHO DE BOAS-VINDAS DENTRO DA SEÇÃO INÍCIO */}
          <div className={`px-3.5 border-b flex items-center justify-between gap-3 transition-colors h-11 shrink-0 ${
            isDark ? 'bg-slate-900/80 border-slate-800/80' : 'bg-slate-100/90 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0 py-1">
              {onBack && (
                <button
                  onClick={onBack}
                  className={`w-7 h-7 rounded flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                    isDark
                      ? 'bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white'
                      : 'bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-950 shadow-xs'
                  }`}
                  title="Voltar"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" />
                </button>
              )}

              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />

              <div className="min-w-0">
                <h2 className={`text-xs sm:text-sm font-bold truncate leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Seja bem-vindo, <span className="text-emerald-500">{currentUserName ? currentUserName.trim().split(' ')[0] : ''}</span>
                </h2>
              </div>
            </div>
          </div>

          {/* SLIDER / CARROSSEL PUBLICITÁRIO TOTALMENTE RESPONSIVO */}
          <div className={`relative w-full h-full flex-1 min-h-0 overflow-hidden select-none touch-pan-y ${
            isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-slate-200 border-b border-slate-300'
          }`}>
            <AnimatePresence mode="wait">
              {portfolioSlides.map((slide, idx) => {
                if (idx !== activeSlideIndex) return null;
                const IconComponent = slide.ctaIcon;
                return (
                  <motion.div
                    key={slide.id}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -40 || info.velocity.x < -300) {
                        setActiveSlideIndex((prev) => (prev + 1) % portfolioSlides.length);
                      } else if (info.offset.x > 40 || info.velocity.x > 300) {
                        setActiveSlideIndex((prev) => (prev - 1 + portfolioSlides.length) % portfolioSlides.length);
                      }
                    }}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                  >
                    {/* Imagem de Fundo Fullscreen */}
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    {/* Degradês Publicitários de Alta Qualidade para Leitura Impecável */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/35" />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90" />

                    {/* Conteúdo Publicitário Integrado */}
                    <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between z-10 max-w-[90%] sm:max-w-[78%]">
                      {/* Topo do Slide: Título Principal e Tagline */}
                      <div className="pt-1 sm:pt-2 space-y-1">
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md font-['Poppins']">
                          {slide.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-200/95 font-normal leading-relaxed line-clamp-2 sm:line-clamp-3 drop-shadow-xs max-w-md">
                          {slide.tagline}
                        </p>
                      </div>

                      {/* Base do Slide: Botão CTA + Dica de Rolagem */}
                      <div className="space-y-2 pb-2 sm:pb-3">
                        {/* Botão Chamativo de Ação (Com Z-Index Seguro e Touch Acessível) */}
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              slide.ctaAction();
                            }}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded bg-gradient-to-r from-emerald-600 via-[#20C933] to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 text-white font-bold text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(32,201,51,0.4)] transition-all cursor-pointer whitespace-nowrap z-20 pointer-events-auto"
                          >
                            <IconComponent className="w-4 h-4 text-white drop-shadow-xs shrink-0" />
                            <span>{slide.ctaText}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-white shrink-0" />
                          </button>
                        </div>

                        {/* Dica de Navegação Rolar para Ver Mais Seções */}
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectTab('servicos');
                            }}
                            className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-300 hover:text-white transition cursor-pointer pt-0.5"
                          >
                            <span>Role para navegar</span>
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Setas Sutis de Navegação Lateral em moldura quadrada com borda arredondada de 4px */}
            <button
              onClick={() => setActiveSlideIndex((prev) => (prev - 1 + portfolioSlides.length) % portfolioSlides.length)}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-950/70 hover:bg-slate-900 text-white/90 hover:text-white flex items-center justify-center transition border border-white/15 cursor-pointer backdrop-blur-xs active:scale-90"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveSlideIndex((prev) => (prev + 1) % portfolioSlides.length)}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded bg-slate-950/70 hover:bg-slate-900 text-white/90 hover:text-white flex items-center justify-center transition border border-white/15 cursor-pointer backdrop-blur-xs active:scale-90"
              aria-label="Próximo slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* SEÇÃO 2: SERVIÇOS */}
        <section
          id="section-servicos"
          ref={servicosSectionRef}
          data-tab-id="servicos"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-between"
        >
          <SectionHeader title="Serviços & Procedimentos" isDark={isDark} />

          {/* Grid de Serviços Fullwidth sem Espaçamentos (Laterais, Topo e Rodapé zerados) */}
          <div className="relative overflow-hidden select-none w-full flex-1 min-h-0 flex flex-col justify-between">
            <AnimatePresence mode="wait" custom={swapDirection}>
              <motion.div
                key={servicePage}
                custom={swapDirection}
                initial={{ opacity: 0, x: swapDirection > 0 ? 40 : -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: swapDirection > 0 ? -40 : 40 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                drag={totalServicePages > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -35 || info.velocity.x < -200) {
                    handleNextServicePage();
                  } else if (info.offset.x > 35 || info.velocity.x > 200) {
                    handlePrevServicePage();
                  }
                }}
                className={`grid grid-cols-2 grid-rows-2 gap-0 w-full flex-1 min-h-0 cursor-grab active:cursor-grabbing touch-pan-y ${
                  isDark ? 'bg-slate-950' : 'bg-slate-100'
                }`}
              >
                {currentServices.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => handleOpenBooking(srv)}
                    className="group relative overflow-hidden transition-all duration-300 cursor-pointer bg-slate-950 h-full w-full"
                    title={`${srv.title} - R$ ${srv.price}`}
                  >
                    {/* Imagem com Aspect Ratio Enquadrado e Zoom no Hover */}
                    <div className="relative w-full h-full overflow-hidden bg-slate-950">
                      <img
                        src={srv.image || 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80'}
                        alt={srv.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />

                      {/* Gradiente Cinematográfico Escuro para Máximo Contraste */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-black/25 group-hover:via-slate-950/65 transition-colors duration-300 pointer-events-none" />

                      {/* Topo do Card: Badge de Categoria com Frosted Glass & Ponto Esmeralda */}
                      <div className="absolute top-2 left-2 z-10 pointer-events-none">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                          {srv.category}
                        </span>
                      </div>

                      {/* Base do Card: Título + Preço + Indicador Interativo de Agendamento */}
                      <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 z-10 flex flex-col justify-end pointer-events-none">
                        <div className="flex items-end justify-between gap-1.5">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-tight leading-tight line-clamp-1 font-['Poppins'] drop-shadow-sm group-hover:text-emerald-300 transition-colors">
                              {srv.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-emerald-400 font-black text-xs sm:text-sm tracking-tight drop-shadow-xs">
                                R$ {srv.price}
                              </span>
                              {srv.duration && (
                                <span className="text-[10px] text-slate-300/80 font-medium">
                                  • {srv.duration}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Botão de Agendamento Rápido em Destaque */}
                          <div className="shrink-0">
                            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.4)] group-hover:scale-110 group-hover:bg-emerald-400 transition-all duration-200">
                              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Barra de Paginação e Navegação de Alta Precisão */}
            {totalServicePages > 1 && (
              <div
                className={`w-full px-4 py-2 flex items-center justify-between border-t transition-colors select-none shrink-0 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800/80 text-white'
                    : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                {/* Indicador de Página e Total */}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-['Poppins'] ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-200'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="text-emerald-400 font-extrabold">{servicePage + 1}</span>
                    <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/</span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{totalServicePages}</span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold tracking-wide uppercase ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    Procedimentos
                  </span>
                </div>

                {/* Controles de Navegação com Setas e Indicadores em Pílula */}
                <div className="flex items-center gap-2">
                  {/* Botão Anterior */}
                  <button
                    type="button"
                    onClick={handlePrevServicePage}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isDark
                        ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 active:scale-95'
                    }`}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Pílulas de Navegação com Brilho Esmeralda */}
                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalServicePages }).map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        type="button"
                        onClick={() => {
                          setSwapDirection(dotIdx > servicePage ? 1 : -1);
                          setServicePage(dotIdx);
                        }}
                        className={`transition-all rounded-full cursor-pointer ${
                          dotIdx === servicePage
                            ? 'w-5 h-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                            : isDark
                            ? 'w-2 h-2 bg-slate-800 hover:bg-slate-700'
                            : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                        }`}
                        aria-label={`Ir para página ${dotIdx + 1}`}
                      />
                    ))}
                  </div>

                  {/* Botão Próximo */}
                  <button
                    type="button"
                    onClick={handleNextServicePage}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isDark
                        ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 active:scale-95'
                    }`}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SEÇÃO 3: AGENDAR */}
        <section
          id="section-vagas"
          ref={vagasSectionRef}
          data-tab-id="vagas"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-start"
        >
          <SectionHeader
            title="Agendar"
            isDark={isDark}
          />

          <div className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden w-full">
            <SalonBookingModal
              isOpen={true}
              inline={true}
              salonName={salonInfo.name}
              salonAddress={salonInfo.address}
              services={catalogServices}
              professionals={salonInfo.professionals}
              initialService={bookingService}
              skipDateStep={skipDateStep}
              initialTimeSlot={selectedTimeSlotForBooking}
              initialDateIso={selectedCalendarDateIso}
              onConfirmAppointment={handleConfirmSchedule}
            />
          </div>
        </section>

        {/* SEÇÃO 4: ESPAÇO, LOCALIZAÇÃO & EQUIPE */}
        <section
          id="section-espaco"
          ref={espacoSectionRef}
          data-tab-id="espaco"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-start"
        >
          <SectionHeader
            title={
              espacoSlideIndex === 0
                ? (hasMultipleProfessionals ? 'Equipe & Especialistas' : 'Perfil do Profissional')
                : espacoSlideIndex === 1
                ? (salonInfo.isHomeCare ? 'Modalidade de Atendimento' : 'Estrutura do Espaço')
                : 'Endereço & Localização'
            }
            isDark={isDark}
          />

          <div className="px-3.5 sm:px-4 py-2.5 space-y-2.5 flex-1 min-h-0 flex flex-col justify-start overflow-y-auto">
          <div className="grid grid-cols-3 gap-1.5 w-full">
            {/* Aba 1: Equipe */}
            <button
              type="button"
              onClick={() => {
                setEspacoSwipeDirection(0 < espacoSlideIndex ? -1 : 1);
                setEspacoSlideIndex(0);
              }}
              className={`py-2 px-1 rounded text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                espacoSlideIndex === 0
                  ? 'bg-slate-100 text-slate-950 font-bold border border-slate-300 shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200 hover:text-slate-950 font-medium border border-slate-300/60'
              }`}
            >
              <Users className={`w-3.5 h-3.5 shrink-0 ${
                espacoSlideIndex === 0 ? 'text-slate-950' : 'text-slate-600'
              }`} />
              <span className="text-[11px] sm:text-xs tracking-tight truncate">
                Equipe
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold leading-none ${
                espacoSlideIndex === 0
                  ? 'bg-slate-200 text-slate-900'
                  : 'bg-slate-300/80 text-slate-700'
              }`}>
                {salonInfo.professionals.length}
              </span>
            </button>

            {/* Aba 2: Estrutura */}
            <button
              type="button"
              onClick={() => {
                setEspacoSwipeDirection(1 < espacoSlideIndex ? -1 : 1);
                setEspacoSlideIndex(1);
              }}
              className={`py-2 px-1 rounded text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                espacoSlideIndex === 1
                  ? 'bg-slate-100 text-slate-950 font-bold border border-slate-300 shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200 hover:text-slate-950 font-medium border border-slate-300/60'
              }`}
            >
              <Store className={`w-3.5 h-3.5 shrink-0 ${
                espacoSlideIndex === 1 ? 'text-slate-950' : 'text-slate-600'
              }`} />
              <span className="text-[11px] sm:text-xs tracking-tight truncate">
                Estrutura
              </span>
            </button>

            {/* Aba 3: Localização */}
            <button
              type="button"
              onClick={() => {
                setEspacoSwipeDirection(2 < espacoSlideIndex ? -1 : 1);
                setEspacoSlideIndex(2);
              }}
              className={`py-2 px-1 rounded text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                espacoSlideIndex === 2
                  ? 'bg-slate-100 text-slate-950 font-bold border border-slate-300 shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200 hover:text-slate-950 font-medium border border-slate-300/60'
              }`}
            >
              <MapPin className={`w-3.5 h-3.5 shrink-0 ${
                espacoSlideIndex === 2 ? 'text-slate-950' : 'text-slate-600'
              }`} />
              <span className="text-[11px] sm:text-xs tracking-tight truncate">
                Localização
              </span>
            </button>
          </div>

          {/* Container com Suporte a Gesto Swipe (Arrasto Horizontal para Esquerda e Direita) */}
          <div className="relative overflow-hidden select-none">
            <AnimatePresence mode="wait" custom={espacoSwipeDirection}>
              {/* SLIDE 0: EQUIPE & ESPECIALISTAS */}
              {espacoSlideIndex === 0 && (
                <motion.div
                  key="slide-equipe"
                  custom={espacoSwipeDirection}
                  initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -35 || info.velocity.x < -200) {
                      handleNextEspacoSlide();
                    } else if (info.offset.x > 35 || info.velocity.x > 200) {
                      handlePrevEspacoSlide();
                    }
                  }}
                  className="cursor-grab active:cursor-grabbing touch-pan-y"
                >
                  {/* ABA 1: EQUIPE / NOSSO TIME (LAYOUT PLANO, SEM BOX DENTRO DE BOX, IGUALITÁRIO) */}
                  <div className={`border rounded p-4 min-h-[380px] flex flex-col justify-between transition-colors ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex-1 min-h-0 flex flex-col">
                      {/* Título direto e discreto */}
                      <div className={`flex items-center justify-between pb-3 border-b shrink-0 mb-3 ${
                        isDark ? 'border-slate-800/80' : 'border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-400" />
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {hasMultipleProfessionals ? 'Nosso Time' : 'Profissional'}
                          </h4>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {salonInfo.professionals.length} {salonInfo.professionals.length === 1 ? 'especialista' : 'especialistas'}
                        </span>
                      </div>

                      {/* Grade Aberta e Plana da Equipe (Sem caixas ou bordas individuais ao redor de cada um) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-4 py-3 overflow-y-auto pr-1 flex-1 min-h-0 no-scrollbar items-start">
                        {salonInfo.professionals.map((prof, idx) => (
                          <div 
                            key={idx} 
                            className="flex flex-col items-center text-center"
                          >
                            <img
                              src={prof.avatar}
                              alt={prof.name}
                              className={`w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded object-cover shadow-xs mb-2 border ${
                                isDark ? 'border-slate-800' : 'border-slate-200'
                              }`}
                              referrerPolicy="no-referrer"
                            />
                            <h5 className={`text-xs font-bold leading-tight truncate w-full px-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {prof.name}
                            </h5>
                            <p className={`text-[11px] leading-snug mt-0.5 truncate w-full px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {prof.role}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SLIDE 1: ESTRUTURA DO ESPAÇO */}
              {espacoSlideIndex === 1 && (
                <motion.div
                  key="slide-espaco-estrutura"
                  custom={espacoSwipeDirection}
                  initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -35 || info.velocity.x < -200) {
                      handleNextEspacoSlide();
                    } else if (info.offset.x > 35 || info.velocity.x > 200) {
                      handlePrevEspacoSlide();
                    }
                  }}
                  className="cursor-grab active:cursor-grabbing touch-pan-y"
                >
                  {/* ABA 2: CARD DE ESTRUTURA DO ESPAÇO & COMODIDADES */}
                  <div className={`border rounded p-3.5 space-y-3 shadow-sm min-h-[380px] flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="space-y-2">
                      <h3 className={`text-xs font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <Store className="w-4 h-4 text-emerald-500" />
                        <span>{salonInfo.isHomeCare ? 'Modalidade de Atendimento' : 'Estrutura do Espaço'}</span>
                      </h3>
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {salonInfo.description}
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {salonInfo.amenities.map((amenity, idx) => (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded border text-xs ${
                            isDark
                              ? 'bg-slate-950 border-slate-800 text-slate-300'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <amenity.icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{amenity.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`pt-2 border-t text-[11px] flex items-center justify-between ${
                      isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                    }`}>
                      <span>Ambiente climatizado e confortável</span>
                      <span className="text-emerald-400 font-bold">100% Verificado</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SLIDE 2: ENDEREÇO & MAPA EMBED */}
              {espacoSlideIndex === 2 && (
                <motion.div
                  key="slide-espaco-mapa"
                  custom={espacoSwipeDirection}
                  initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -35 || info.velocity.x < -200) {
                      handleNextEspacoSlide();
                    } else if (info.offset.x > 35 || info.velocity.x > 200) {
                      handlePrevEspacoSlide();
                    }
                  }}
                  className="cursor-grab active:cursor-grabbing touch-pan-y"
                >
                  {/* ABA 3: CARD DE ENDEREÇO, COMO CHEGAR & MAPA EMBED */}
                  <div className={`border rounded p-3.5 space-y-3.5 shadow-sm min-h-[380px] flex flex-col justify-between ${
                    isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    {/* Endereço e Horário */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2.5 text-xs">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className={`font-semibold block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {salonInfo.address}
                          </span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {salonInfo.city}
                          </span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{salonInfo.hours}</span>
                      </div>
                    </div>

                    {/* Botão Como Chegar */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonInfo.name + ' ' + salonInfo.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 uppercase tracking-wider"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>COMO CHEGAR (GOOGLE MAPS)</span>
                    </a>

                    {/* Abaixo: Mapa Embed */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className={`relative w-full h-48 sm:h-56 rounded overflow-hidden border shadow-xs ${
                        isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-100'
                      }`}>
                        <iframe
                          title={`Localização no Google Maps - ${salonInfo.name}`}
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(salonInfo.name + ', ' + salonInfo.address + ', ' + salonInfo.city)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          className="w-full h-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                        {/* Botão flutuante compacto para abrir direto no aplicativo do Maps */}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonInfo.name + ' ' + salonInfo.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-2 right-2 px-2.5 py-1.5 bg-slate-950/90 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded text-[10px] font-bold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 uppercase tracking-wider"
                        >
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>Rota no Maps</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dica de Swipe e Indicador de Pontos */}
            <div className="mt-2.5 flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400">
                Deslize para alternar entre as abas
              </span>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((dotIdx) => (
                  <button
                    key={dotIdx}
                    onClick={() => {
                      setEspacoSwipeDirection(dotIdx > espacoSlideIndex ? 1 : -1);
                      setEspacoSlideIndex(dotIdx);
                    }}
                    className={`transition-all rounded-full cursor-pointer ${
                      dotIdx === espacoSlideIndex
                        ? 'w-5 h-1.5 bg-slate-400'
                        : 'w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500'
                    }`}
                    aria-label={`Aba ${dotIdx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

      {/* Barra de Navegação Inferior Nativa do Estabelecimento (4 Abas: Início, Serviços, Agendar, Espaço) */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        spaceTabLabel={spaceTabLabel}
        SpaceIcon={SpaceIcon}
        ServicesIcon={ServicesIcon}
      />

      {/* 2. MODAL DE AGENDAMENTO CONFIRMADO (DENTRO DA SEÇÃO DO ESTABELECIMENTO) */}
      {confirmedBookingData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className={`w-full max-w-md border rounded p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center space-y-4 transition-colors ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Ícone de Sucesso */}
            <div className="w-16 h-16 rounded bg-[#20C933] text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 animate-in zoom-in-75 duration-300">
              <Check className="w-9 h-9 stroke-[3] text-white" />
            </div>

            <div className="space-y-1">
              <h2 className={`text-xl font-bold font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Agendamento confirmado!
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Sua vaga está garantida. Apresente o código abaixo ao chegar no estabelecimento.
              </p>
            </div>

            {/* Card com Detalhes do Voucher */}
            <div className={`w-full rounded p-4 border text-left space-y-3 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                <span className="text-xs font-bold text-slate-400">Código Protocolo</span>
                <span className="text-xs font-mono font-bold text-[#20C933] bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                  {confirmedBookingData.protocolCode}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Serviço:</span>
                  <span className={`font-bold truncate max-w-[200px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {confirmedBookingData.serviceTitle}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Profissional:</span>
                  <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {confirmedBookingData.professionalName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estabelecimento:</span>
                  <span className="font-bold text-emerald-500 truncate max-w-[200px]">
                    {confirmedBookingData.salonName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Data / Hora:</span>
                  <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {confirmedBookingData.dateTime}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-bold">Total pago no local:</span>
                  <span className="text-sm font-black text-emerald-400">
                    R$ {confirmedBookingData.totalPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações do Agendamento Concluído */}
            <div className="w-full space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmedBookingData(null)}
                className="w-full py-3.5 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition shadow-md shadow-emerald-900/30 uppercase tracking-wider font-['Poppins'] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>OK, ENTENDIDO</span>
                <Check className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* WhatsApp do Estabelecimento */}
            <a
              href={`https://wa.me/5511987654321?text=${encodeURIComponent(
                `Olá! Acabei de agendar ${confirmedBookingData.serviceTitle} na ${confirmedBookingData.salonName}. Protocolo: ${confirmedBookingData.protocolCode}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#20C933] hover:underline font-medium pt-1 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Falar com o estabelecimento no WhatsApp</span>
            </a>
          </div>
        </div>
      )}

      {/* Drawer do Perfil do Usuário com Menus, Dados Privados, Agenda e Configurações */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        userName={currentUserName}
        userAvatarUrl={userAvatarUrl}
        onUpdateUserName={(newName) => setCurrentUserName(newName)}
        onNavigateToSchedule={() => handleSelectTab('vagas')}
        salonName={salonInfo.name}
        salonPhone="5511987654321"
      />
    </div>
  );
};
