import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Scissors, Check, X, 
  Sparkles, DollarSign, Clock, Tag, Image as ImageIcon,
  AlertCircle, Search, Eye
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../../utils/haptics';
import { CatalogServiceItem } from '../SalonBookingModal';

interface ProfessionalServicesManagerProps {
  services: CatalogServiceItem[];
  onUpdateServices: (services: CatalogServiceItem[]) => void;
  isAddingNewFromQuickAction?: boolean;
  onCloseQuickAction?: () => void;
}

const CATEGORY_OPTIONS = ['Cabelo', 'Barba', 'Combos', 'Estética', 'Tratamentos', 'Rosto', 'Unhas'];

const SAMPLE_SERVICE_IMAGES = [
  'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80',
];

export const ProfessionalServicesManager: React.FC<ProfessionalServicesManagerProps> = ({
  services,
  onUpdateServices,
  isAddingNewFromQuickAction = false,
  onCloseQuickAction,
}) => {
  const { isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal de Adicionar / Editar
  const [isModalOpen, setIsModalOpen] = useState<boolean>(isAddingNewFromQuickAction);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState<string>('');
  const [formPrice, setFormPrice] = useState<number>(50);
  const [formDuration, setFormDuration] = useState<string>('40 min');
  const [formCategory, setFormCategory] = useState<string>('Cabelo');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImage, setFormImage] = useState<string>(SAMPLE_SERVICE_IMAGES[0]);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Abrir modal para novo serviço
  const handleOpenNew = () => {
    hapticLight();
    setEditingServiceId(null);
    setFormTitle('');
    setFormPrice(50);
    setFormDuration('40 min');
    setFormCategory('Cabelo');
    setFormDescription('');
    setFormImage(SAMPLE_SERVICE_IMAGES[Math.floor(Math.random() * SAMPLE_SERVICE_IMAGES.length)]);
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEdit = (srv: CatalogServiceItem) => {
    hapticLight();
    setEditingServiceId(srv.id);
    setFormTitle(srv.title);
    setFormPrice(srv.price);
    setFormDuration(srv.duration || '40 min');
    setFormCategory(srv.category || 'Cabelo');
    setFormDescription(srv.description || '');
    setFormImage(srv.image || SAMPLE_SERVICE_IMAGES[0]);
    setIsModalOpen(true);
  };

  // Salvar serviço (novo ou existente)
  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingServiceId) {
      // Editar
      const updated = services.map((s) => {
        if (s.id === editingServiceId) {
          return {
            ...s,
            title: formTitle.trim(),
            price: Number(formPrice) || 0,
            duration: formDuration.trim() || '40 min',
            category: formCategory,
            description: formDescription.trim(),
            image: formImage,
          };
        }
        return s;
      });
      onUpdateServices(updated);
      hapticSuccess();
      showToast('Serviço atualizado com sucesso!');
    } else {
      // Criar novo
      const newService: CatalogServiceItem = {
        id: `srv-${Date.now()}`,
        title: formTitle.trim(),
        price: Number(formPrice) || 0,
        duration: formDuration.trim() || '40 min',
        category: formCategory,
        description: formDescription.trim(),
        image: formImage,
        aspectRatio: 'aspect-square',
      };
      const updated = [newService, ...services];
      onUpdateServices(updated);
      hapticSuccess();
      showToast('Novo serviço cadastrado no catálogo!');
    }

    setIsModalOpen(false);
    onCloseQuickAction?.();
  };

  // Excluir serviço
  const handleDeleteService = (id: string) => {
    hapticMedium();
    const updated = services.filter((s) => s.id !== id);
    onUpdateServices(updated);
    setDeletingServiceId(null);
    showToast('Serviço removido do catálogo.');
  };

  // Filtragem de serviços
  const filteredServices = services.filter((srv) => {
    const matchesCategory = selectedCategory === 'Todos' || srv.category?.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch = srv.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (srv.description && srv.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = ['Todos', ...Array.from(new Set(services.map((s) => s.category || 'Geral')))];

  return (
    <div className="w-full h-full flex flex-col justify-start overflow-hidden relative">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded bg-emerald-500 text-white font-bold text-xs shadow-lg animate-in fade-in flex items-center gap-1.5 whitespace-nowrap">
          <Check className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOPO: BARRA DE AÇÃO E CADASTRO */}
      <div className={`p-3.5 border-b transition-colors shrink-0 space-y-2.5 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className={`text-sm font-bold font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Gerenciamento de Serviços
            </h3>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {services.length} procedimentos dispostos para os clientes
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenNew}
            className="px-3 py-1.5 rounded bg-[#20C933] hover:bg-[#1bb32d] active:scale-95 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>NOVO SERVIÇO</span>
          </button>
        </div>

        {/* Barra de Busca e Filtros de Categoria */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar serviço..."
              className={`w-full pl-8 pr-3 py-1.5 rounded text-xs border transition ${
                isDark 
                  ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
              } outline-hidden`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Chips de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                hapticLight();
                setSelectedCategory(cat);
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-800 text-slate-400 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA PLANA DE SERVIÇOS (LAYOUT PLANO CONFORME DIRETRIZES) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-2.5 no-scrollbar">
        {filteredServices.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Scissors className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
            <p className="text-xs">Nenhum serviço encontrado.</p>
            <button
              type="button"
              onClick={handleOpenNew}
              className="mt-3 px-3 py-1.5 rounded bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Cadastrar Primeiro Serviço</span>
            </button>
          </div>
        ) : (
          filteredServices.map((srv) => (
            <div
              key={srv.id}
              className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              {/* Foto Thumbnail + Detalhes */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-14 h-14 rounded overflow-hidden bg-slate-800 shrink-0 relative">
                  <img
                    src={srv.image || SAMPLE_SERVICE_IMAGES[0]}
                    alt={srv.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] font-bold text-center text-white py-0.5 truncate">
                    {srv.category}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {srv.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-emerald-400 font-extrabold text-xs sm:text-sm font-['Poppins']">
                      R$ {srv.price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      • {srv.duration || '40 min'}
                    </span>
                  </div>
                  {srv.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {srv.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Botões de Ação: Editar / Excluir */}
              <div className="flex items-center gap-1.5 shrink-0">
                {deletingServiceId === srv.id ? (
                  <div className="flex items-center gap-1 animate-in fade-in">
                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition cursor-pointer"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingServiceId(null)}
                      className="p-1 rounded bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(srv)}
                      className={`p-2 rounded transition active:scale-95 cursor-pointer ${
                        isDark 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                      title="Editar Serviço"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingServiceId(srv.id)}
                      className={`p-2 rounded transition active:scale-95 cursor-pointer ${
                        isDark 
                          ? 'bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400' 
                          : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                      }`}
                      title="Excluir Serviço"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE SERVIÇO */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className={`w-full max-w-md rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold font-['Poppins']">
                  {editingServiceId ? 'Editar Serviço' : 'Cadastrar Novo Serviço'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveService} className="p-4 space-y-3.5 overflow-y-auto no-scrollbar flex-1">
              {/* Nome do Serviço */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nome do Procedimento *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Corte Degradê & Barboterapia"
                  className={`w-full px-3 py-2 rounded text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  } outline-hidden`}
                />
              </div>

              {/* Preço e Duração (Lado a Lado) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Preço (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                      className={`w-full pl-8 pr-3 py-2 rounded text-xs font-bold border ${
                        isDark 
                          ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                      } outline-hidden`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Duração *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    placeholder="Ex: 40 min"
                    className={`w-full px-3 py-2 rounded text-xs border ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    } outline-hidden`}
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Categoria *
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`py-1.5 px-2 rounded text-[11px] font-bold transition cursor-pointer text-center ${
                        formCategory === cat
                          ? 'bg-emerald-500 text-white'
                          : isDark
                          ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                          : 'bg-slate-100 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Descrição dos Benefícios
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descreva o procedimento, produtos utilizados, etc."
                  className={`w-full px-3 py-2 rounded text-xs border resize-none ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  } outline-hidden`}
                />
              </div>

              {/* Escolha de Foto Ilustrativa */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Foto do Serviço (Escolha Rápida)
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {SAMPLE_SERVICE_IMAGES.map((imgUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormImage(imgUrl)}
                      className={`aspect-square rounded overflow-hidden border-2 transition cursor-pointer ${
                        formImage === imgUrl ? 'border-emerald-500 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="Opção" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Botão de Salvar Fixo */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded bg-[#20C933] hover:bg-[#1bb32d] active:scale-98 text-white font-bold text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white stroke-[2.5]" />
                  <span>{editingServiceId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR SERVIÇO'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
