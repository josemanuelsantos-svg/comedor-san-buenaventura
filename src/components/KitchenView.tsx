import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChefHat, 
  Calendar, 
  Users, 
  UtensilsCrossed, 
  Backpack, 
  Ticket, 
  Salad, 
  CheckCircle, 
  RefreshCw, 
  Printer, 
  Download, 
  AlertTriangle,
  Shapes,
  Check
} from 'lucide-react';
import { DailyRecord, UserProfile, StudentOperational } from '../types/comedor';
import { subscribeKitchenDailyRecords, confirmRecordByKitchen } from '../services/attendanceService';
import { aggregateKitchenDaily } from '../utils/mathUtils';
import { getLocalISODate, formatHumanDate } from '../utils/dateUtils';

interface KitchenViewProps {
  user: UserProfile;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const KitchenView: React.FC<KitchenViewProps> = ({ user, showToast }) => {
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISODate());
  const [registros, setRegistros] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Escuchar registros de la fecha seleccionada en tiempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeKitchenDailyRecords(selectedDate, (records) => {
      setRegistros(records);
      setLoading(false);
    }, (err) => {
      setLoading(false);
      showToast('Error al conectar con la base de datos de Cocina.', 'error');
    });

    return () => unsubscribe();
  }, [selectedDate]);

  // Agregación de estadísticas consolidadas
  const stats = useMemo(() => {
    return aggregateKitchenDaily(registros);
  }, [registros]);

  // Consolidación de Dietas Especiales Confirmadas por Categoría
  const consolidatedDietGroups = useMemo(() => {
    const groups: Record<string, Array<{ nombre: string; clase: string; etapa: string; nota: string }>> = {};
    
    const normalizeCategory = (nota: string, isBlanda: boolean) => {
      if (isBlanda) return 'Dieta Blanda';
      const n = (nota || '').toLowerCase();
      if (n.includes('gluten') || n.includes('celiac')) return 'Celiaquía (Sin Gluten)';
      if (n.includes('huevo')) return 'Alergia al Huevo';
      if (n.includes('lactosa') || n.includes('leche') || n.includes('plv') || n.includes('aplv')) return 'Intolerancia / Alergia Lactosa';
      if (n.includes('fruto') || n.includes('nuez') || n.includes('cacahuete') || n.includes('almendra') || n.includes('pistacho') || n.includes('anacardo')) return 'Frutos Secos / Cacahuete';
      if (n.includes('legumbre') || n.includes('lenteja') || n.includes('guisante') || n.includes('alubia')) return 'Legumbres';
      if (n.includes('marisco') || n.includes('pescado') || n.includes('mejillón')) return 'Pescado / Marisco';
      if (n.includes('cerdo')) return 'Sin Cerdo (Religiosa / Cultural)';
      if (n.includes('fruta') || n.includes('plátano') || n.includes('melocotón') || n.includes('kiwi')) return 'Frutas / Verduras';
      return 'Otras Dietas Especiales';
    };

    registros.forEach(r => {
      const presentes = r.especialesPresentes || r.especiales || [];
      presentes.forEach(s => {
        const cat = normalizeCategory(s.nota, !!s.dietaBlanda);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({
          nombre: s.nombre,
          clase: `${r.curso} ${r.letra}`,
          etapa: r.etapa,
          nota: s.nota || (s.dietaBlanda ? 'Dieta Blanda' : 'Especial')
        });
      });
    });

    return groups;
  }, [registros]);

  // Confirmación por Cocina
  const handleConfirmRecord = async (recordId: string) => {
    setConfirmingId(recordId);
    try {
      await confirmRecordByKitchen(recordId, user);
      showToast('Aula confirmada por Cocina.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error al confirmar el aula.', 'error');
    } finally {
      setConfirmingId(null);
    }
  };

  // Exportar CSV seguro (sin teléfonos ni datos médicos confidenciales)
  const handleExportCSV = () => {
    if (registros.length === 0) {
      showToast('No hay datos para exportar en esta fecha.', 'warning');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Fecha,Etapa,Curso,Letra,Fijos,Tickets,Profesor,Modalidad,Total Platos,Estado,Observaciones\n';

    registros.forEach(r => {
      const row = [
        r.fecha,
        r.etapa,
        r.curso,
        r.letra,
        r.fijos,
        r.tickets,
        r.profesorSeQueda ? `Sí (${r.profesorNombre || 'Profesor'})` : 'No',
        r.modalidad === 'picnic' ? 'Picnic / Excursión' : 'Comedor',
        r.totalPlatos,
        r.estado,
        `"${(r.observaciones || '').replace(/"/g, '""')}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Comedor_SB_Consolidado_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Informe CSV descargado con éxito.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl mx-auto pb-24">
      {/* Selector de Fecha y Acciones */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Panel Consolidado de Cocina
            </h2>
            <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 mt-0.5">
              <span>{formatHumanDate(selectedDate)}</span>
              {loading && <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
          />
          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-300 transition-all"
            title="Imprimir resumen"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-slate-700 dark:text-slate-300 transition-all"
            title="Exportar a CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total General */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border-l-4 border-l-emerald-500 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            Total General
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            {stats.totFijos} fijos + {stats.totTickets} tickets
          </div>
        </div>

        {/* Menú Estándar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border-l-4 border-l-blue-500 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">
            Menú Estándar
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.totComedorEstandar + stats.totPicnicsEstandar}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            {stats.totComedorEstandar} calientes · {stats.totPicnicsEstandar} picnics
          </div>
        </div>

        {/* Dietas Especiales */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border-l-4 border-l-amber-500 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">
            Dietas Especiales
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.totComedorEspecial + stats.totPicnicsEspecial}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            {stats.totComedorEspecial} calientes · {stats.totPicnicsEspecial} picnics
          </div>
        </div>

        {/* Picnics / Excursiones */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border-l-4 border-l-purple-500 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">
            Bolsas Picnic
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {stats.totPicnics}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            Para excursiones de hoy
          </div>
        </div>
      </div>

      {/* Matriz de Emplatado Rápido de Dietas Especiales Confirmadas */}
      {Object.keys(consolidatedDietGroups).length > 0 && (
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-3xl p-4 sm:p-5 space-y-3 print:border-slate-400">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Salad className="w-4 h-4 text-amber-600" /> Matriz de Emplatado: Dietas Especiales Confirmadas
            </h3>
            <span className="text-[10px] font-black bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2.5 py-0.5 rounded-full">
              {stats.totComedorEspecial + stats.totPicnicsEspecial} raciones especiales
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(consolidatedDietGroups).map(([dietName, pupils]) => (
              <div key={dietName} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/60 dark:border-slate-800 shadow-sm flex flex-col justify-between text-xs">
                <div>
                  <div className="flex justify-between items-start font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-1.5">
                    <span className="text-amber-800 dark:text-amber-400">{dietName}</span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold px-1.5 py-0.5 rounded">
                      {pupils.length} {pupils.length === 1 ? 'ración' : 'raciones'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {pupils.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-medium truncate mr-2">• {p.nombre}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0 text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {p.clase} ({p.etapa})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Desglose por Etapas y Aulas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Infantil */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-pink-100 dark:border-pink-950/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-pink-100 dark:border-pink-950/40">
            <h3 className="font-black text-sm text-pink-900 dark:text-pink-300 flex items-center gap-2">
              <Shapes className="w-4 h-4 text-pink-500" /> Infantil ({stats.totInf} platos)
            </h3>
            <span className="text-[10px] font-bold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full">
              {stats.infantil.length} aulas enviadas
            </span>
          </div>

          <div className="space-y-2">
            {stats.infantil.map(r => (
              <div key={r.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <div className="font-black text-slate-900 dark:text-slate-100">
                    Aula {r.curso} {r.letra} {r.modalidad === 'picnic' && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[9px] font-bold">🎒 Picnic</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.fijos} fijos · {r.tickets} tickets {r.profesorSeQueda && `· Prof. ${r.profesorNombre}`}
                  </div>
                  {r.observaciones && (
                    <div className="text-[10.5px] text-amber-700 dark:text-amber-300 mt-1 italic">
                      Obs: {r.observaciones}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-800 dark:text-slate-200">
                    {r.totalPlatos}
                  </span>
                  {r.estado === 'confirmado_cocina' ? (
                    <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 rounded-xl text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> OK
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={confirmingId === r.id}
                      onClick={() => handleConfirmRecord(r.id)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold transition-all"
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {stats.infantil.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                No hay registros enviados de Infantil para esta fecha.
              </div>
            )}
          </div>
        </div>

        {/* Primaria */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-blue-100 dark:border-blue-950/40 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-950/40">
            <h3 className="font-black text-sm text-blue-900 dark:text-blue-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Primaria ({stats.totPri} platos)
            </h3>
            <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {stats.primaria.length} aulas enviadas
            </span>
          </div>

          <div className="space-y-2">
            {stats.primaria.map(r => (
              <div key={r.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <div className="font-black text-slate-900 dark:text-slate-100">
                    Aula {r.curso} {r.letra} {r.modalidad === 'picnic' && <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[9px] font-bold">🎒 Picnic</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {r.fijos} fijos · {r.tickets} tickets {r.profesorSeQueda && `· Prof. ${r.profesorNombre}`}
                  </div>
                  {r.observaciones && (
                    <div className="text-[10.5px] text-amber-700 dark:text-amber-300 mt-1 italic">
                      Obs: {r.observaciones}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-800 dark:text-slate-200">
                    {r.totalPlatos}
                  </span>
                  {r.estado === 'confirmado_cocina' ? (
                    <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 rounded-xl text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> OK
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={confirmingId === r.id}
                      onClick={() => handleConfirmRecord(r.id)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold transition-all"
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {stats.primaria.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                No hay registros enviados de Primaria para esta fecha.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
