import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import * as api from '../../api/client';
import type { AdminUserItem, CampaignItem, CampaignWriteBody } from '../../types';
import { PRESENTACIONES } from '../../constants/presentaciones';
import { errorToAlertMessage } from '../../utils/errors';

// ---------------------------------------------------------------------------
// Helpers de formato y parseo
// ---------------------------------------------------------------------------

function formatPct(x: number) {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(2)}%`;
}

function parseCurrency(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parsePctInput(s: string): number {
  // El usuario escribe en porcentaje (0-100). Se persiste como decimal (0..1).
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n)) / 100;
}

function pctToInput(decimal: number): string {
  if (!Number.isFinite(decimal)) return '';
  return String(Math.round(decimal * 10000) / 100);
}

function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function refsFromString(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function refsToString(json: string): string {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.join(', ') : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Estado del formulario (string para inputs; se normaliza al guardar)
// ---------------------------------------------------------------------------

interface FormState {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  minSubtotalElegible: string;
  pctBono: string;
  pctTopeCosto: string;
  bonoVigenciaDias: string;
  probabilidadBase: string;
  estado: 'activa' | 'inactiva';
  refs: string;
  leyendaFacturaBono: string;
  bonoUnSoloUso: boolean;
  bonoNoAcumulable: boolean;
  redencionSoloFacturaFutura: boolean;
  redencionMinIgualOrigen: boolean;
  presupuestoTotal: string;
  presupuestoModo: 'ratio' | 'absoluto' | 'mixto';
}

function emptyForm(): FormState {
  return {
    nombre: '',
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaFin: '2035-12-31',
    minSubtotalElegible: '0',
    pctBono: '50',
    pctTopeCosto: '5',
    bonoVigenciaDias: '30',
    probabilidadBase: '10',
    estado: 'activa',
    refs: '',
    leyendaFacturaBono: 'ESTA FACTURA CONTIENE UN BONO',
    bonoUnSoloUso: true,
    bonoNoAcumulable: true,
    redencionSoloFacturaFutura: true,
    redencionMinIgualOrigen: true,
    presupuestoTotal: '',
    presupuestoModo: 'ratio',
  };
}

function formFromCampaign(c: CampaignItem): FormState {
  return {
    nombre: c.nombre || '',
    fechaInicio: String(c.fechaInicio).slice(0, 10),
    fechaFin: String(c.fechaFin).slice(0, 10),
    minSubtotalElegible: String(Math.round(Number(c.minSubtotalElegible) || 0)),
    pctBono: pctToInput(Number(c.pctBono) || 0),
    pctTopeCosto: pctToInput(Number(c.pctTopeCosto) || 0),
    bonoVigenciaDias: String(Number(c.bonoVigenciaDias) || 30),
    probabilidadBase: pctToInput(Number(c.probabilidadBase) || 0),
    estado: c.estado === 'inactiva' ? 'inactiva' : 'activa',
    refs: refsToString(c.refsElegiblesJson || '[]'),
    leyendaFacturaBono: c.leyendaFacturaBono || 'ESTA FACTURA CONTIENE UN BONO',
    bonoUnSoloUso: c.bonoUnSoloUso ?? true,
    bonoNoAcumulable: c.bonoNoAcumulable ?? true,
    redencionSoloFacturaFutura: c.redencionSoloFacturaFutura ?? true,
    redencionMinIgualOrigen: c.redencionMinIgualOrigen ?? true,
    presupuestoTotal:
      c.presupuestoTotal != null && c.presupuestoTotal > 0
        ? String(Math.round(Number(c.presupuestoTotal)))
        : '',
    presupuestoModo: c.presupuestoModo ?? 'ratio',
  };
}

function formToBody(f: FormState): CampaignWriteBody | { error: string } {
  if (!f.nombre.trim()) return { error: 'El nombre es obligatorio.' };
  if (!isValidYmd(f.fechaInicio)) return { error: 'Fecha inicio inválida (YYYY-MM-DD).' };
  if (!isValidYmd(f.fechaFin)) return { error: 'Fecha fin inválida (YYYY-MM-DD).' };
  if (f.fechaInicio > f.fechaFin) return { error: 'Fecha inicio no puede ser mayor a fecha fin.' };

  const dias = parseInt(f.bonoVigenciaDias || '0', 10);
  if (!Number.isFinite(dias) || dias < 1 || dias > 3650) {
    return { error: 'Vigencia del bono debe estar entre 1 y 3650 días.' };
  }

  return {
    nombre: f.nombre.trim(),
    fechaInicio: f.fechaInicio,
    fechaFin: f.fechaFin,
    minSubtotalElegible: parseCurrency(f.minSubtotalElegible),
    pctBono: parsePctInput(f.pctBono),
    pctTopeCosto: parsePctInput(f.pctTopeCosto),
    bonoVigenciaDias: dias,
    probabilidadBase: parsePctInput(f.probabilidadBase),
    estado: f.estado,
    refsElegibles: refsFromString(f.refs),
    leyendaFacturaBono: f.leyendaFacturaBono.trim() || 'ESTA FACTURA CONTIENE UN BONO',
    bonoUnSoloUso: f.bonoUnSoloUso,
    bonoNoAcumulable: f.bonoNoAcumulable,
    redencionSoloFacturaFutura: f.redencionSoloFacturaFutura,
    redencionMinIgualOrigen: f.redencionMinIgualOrigen,
    presupuestoTotal: f.presupuestoTotal.trim()
      ? parseCurrency(f.presupuestoTotal)
      : null,
    presupuestoModo: f.presupuestoModo,
  };
}

type ConfigSection = 'general' | 'economico' | 'elegibilidad' | 'redencion' | 'resumen';

const CONFIG_SECTIONS: {
  key: ConfigSection;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'general', label: 'General', icon: 'information-circle-outline' },
  { key: 'economico', label: 'Económico', icon: 'cash-outline' },
  { key: 'elegibilidad', label: 'Elegibilidad', icon: 'egg-outline' },
  { key: 'redencion', label: 'Redención', icon: 'shield-checkmark-outline' },
  { key: 'resumen', label: 'Resumen', icon: 'list-outline' },
];

const PRESENTACIONES_OPCIONES = PRESENTACIONES.map((p) => p.nombre);

function boolLabel(v: boolean) {
  return v ? 'Sí' : 'No';
}

function presupuestoModoLabel(m: FormState['presupuestoModo']) {
  if (m === 'ratio') return 'Ratio (solo % tope)';
  if (m === 'mixto') return 'Mixto (% + $)';
  return 'Absoluto (solo $)';
}

// ---------------------------------------------------------------------------
// Resumen de todos los parámetros de configuración
// ---------------------------------------------------------------------------

function CampaignParamsSummary({
  form,
  campaignId,
}: {
  form: FormState;
  campaignId?: string;
}) {
  const { theme } = useAppTheme();
  const refs = refsFromString(form.refs);

  return (
    <View style={{ gap: 10 }}>
      <Card style={styles.summaryBlock}>
        <Text style={[styles.summaryGroupTitle, { color: theme.colors.text }]}>Identidad y vigencia</Text>
        <DetailRow label="Nombre" value={form.nombre.trim() || '—'} />
        <DetailRow label="Fecha inicio" value={form.fechaInicio || '—'} />
        <DetailRow label="Fecha fin" value={form.fechaFin || '—'} />
        <DetailRow label="Estado" value={form.estado} />
        {campaignId ? <DetailRow label="ID" value={campaignId} /> : null}
      </Card>

      <Card style={styles.summaryBlock}>
        <Text style={[styles.summaryGroupTitle, { color: theme.colors.text }]}>Parámetros económicos</Text>
        <DetailRow label="% Bono" value={form.pctBono ? `${form.pctBono}%` : '—'} />
        <DetailRow label="Tope costo promocional" value={form.pctTopeCosto ? `${form.pctTopeCosto}%` : '—'} />
        <DetailRow label="Probabilidad base" value={form.probabilidadBase ? `${form.probabilidadBase}%` : '—'} />
        <DetailRow label="Vigencia del bono" value={`${form.bonoVigenciaDias || '0'} días`} />
        <DetailRow
          label="Valor mínimo elegible"
          value={`$${Math.round(parseCurrency(form.minSubtotalElegible)).toLocaleString('es-CO')}`}
        />
        <DetailRow
          label="Presupuesto total"
          value={
            form.presupuestoTotal.trim()
              ? `$${Math.round(parseCurrency(form.presupuestoTotal)).toLocaleString('es-CO')}`
              : 'Sin tope absoluto'
          }
        />
        <DetailRow label="Modo presupuesto" value={presupuestoModoLabel(form.presupuestoModo)} />
      </Card>

      <Card style={styles.summaryBlock}>
        <Text style={[styles.summaryGroupTitle, { color: theme.colors.text }]}>Elegibilidad y sorteo</Text>
        <DetailRow
          label="Presentaciones elegibles"
          value={refs.length > 0 ? refs.join(', ') : 'Todas las presentaciones'}
        />
        <DetailRow
          label="Cantidad de referencias"
          value={refs.length > 0 ? String(refs.length) : 'Sin filtro'}
        />
        <DetailRow label="Leyenda en factura del bono" value={form.leyendaFacturaBono.trim() || '—'} />
      </Card>

      <Card style={styles.summaryBlock}>
        <Text style={[styles.summaryGroupTitle, { color: theme.colors.text }]}>Restricciones de redención</Text>
        <DetailRow label="Solo en factura futura" value={boolLabel(form.redencionSoloFacturaFutura)} />
        <DetailRow
          label="Compra mínima = valor elegible original"
          value={boolLabel(form.redencionMinIgualOrigen)}
        />
        <DetailRow label="No acumulable con otros bonos" value={boolLabel(form.bonoNoAcumulable)} />
        <DetailRow label="Bono de un solo uso" value={boolLabel(form.bonoUnSoloUso)} />
      </Card>

      <Text style={[styles.explain, { color: theme.colors.mutedText }]}>
        La probabilidad final se ajusta dinámicamente según ventas elegibles, bonos emitidos y el tope
        configurado. Los porcentajes se almacenan como decimales en el servidor (10% = 0.10).
      </Text>
    </View>
  );
}

function CampaignParamsViewModal({
  visible,
  campaign,
  onClose,
}: {
  visible: boolean;
  campaign: CampaignItem | null;
  onClose: () => void;
}) {
  const { theme } = useAppTheme();
  const form = useMemo(
    () => (campaign ? formFromCampaign(campaign) : emptyForm()),
    [campaign]
  );

  if (!campaign) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]} numberOfLines={1}>
            Configuración
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={[styles.hint, { color: theme.colors.mutedText, marginBottom: 4 }]}>
            Parámetros completos de «{campaign.nombre}».
          </Text>
          <CampaignParamsSummary form={form} campaignId={campaign.id} />
          <View style={{ height: 12 }} />
          <Button title="Cerrar" onPress={onClose} variant="secondary" />
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ===========================================================================
// Formulario reutilizable Crear/Editar (modal)
// ===========================================================================

function CampaignFormModal({
  visible,
  initial,
  mode,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initial?: CampaignItem | null;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSaved: (c: CampaignItem) => void;
}) {
  const { theme } = useAppTheme();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<ConfigSection>('general');

  const selectedRefs = useMemo(() => refsFromString(form.refs), [form.refs]);

  useEffect(() => {
    if (!visible) return;
    setForm(initial ? formFromCampaign(initial) : emptyForm());
    setSection('general');
  }, [visible, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const togglePresentacion = (nombre: string) => {
    const next = selectedRefs.includes(nombre)
      ? selectedRefs.filter((p) => p !== nombre)
      : [...selectedRefs, nombre];
    set('refs', next.join(', '));
  };

  const seleccionarTodasPresentaciones = () => set('refs', PRESENTACIONES_OPCIONES.join(', '));
  const quitarTodasPresentaciones = () => set('refs', '');

  const onSubmit = async () => {
    const body = formToBody(form);
    if ('error' in body) {
      Alert.alert('Datos inválidos', body.error);
      return;
    }
    setSaving(true);
    try {
      const saved =
        mode === 'create'
          ? await api.createCampaign(body)
          : await api.updateCampaign(initial!.id, body);
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      const raw = (e as any)?.response?.data?.error;
      Alert.alert(
        'Error',
        errorToAlertMessage(raw, e instanceof Error ? e.message : 'No se pudo guardar la campaña.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {mode === 'create' ? 'Nueva campaña' : 'Modificar campaña'}
          </Text>
          <Pressable
            onPress={() => setSection('resumen')}
            style={styles.iconBtn}
            hitSlop={10}
            accessibilityLabel="Ver resumen de parámetros"
          >
            <Ionicons name="list-outline" size={22} color={theme.colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.sectionNavWrap, { borderBottomColor: theme.colors.border }]}
          contentContainerStyle={styles.sectionNavContent}
        >
          {CONFIG_SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSection(s.key)}
                style={[
                  styles.sectionChip,
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.card,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <Ionicons name={s.icon} size={14} color={active ? '#fff' : theme.colors.text} />
                <Text
                  style={[
                    styles.sectionChipText,
                    { color: active ? '#fff' : theme.colors.text },
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          {section === 'general' ? (
          <Card style={styles.block}>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>Identidad</Text>
            <FormText
              label="Nombre"
              value={form.nombre}
              onChangeText={(v) => set('nombre', v)}
              placeholder="Ej: Promo enero"
            />
            <FormRow>
              <FormText
                label="Fecha inicio"
                value={form.fechaInicio}
                onChangeText={(v) => set('fechaInicio', v)}
                placeholder="YYYY-MM-DD"
                style={{ flex: 1 }}
              />
              <FormText
                label="Fecha fin"
                value={form.fechaFin}
                onChangeText={(v) => set('fechaFin', v)}
                placeholder="YYYY-MM-DD"
                style={{ flex: 1 }}
              />
            </FormRow>
            <FormRow>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.colors.mutedText }]}>Estado</Text>
                <View style={styles.estadoBtns}>
                  <Pressable
                    onPress={() => set('estado', 'activa')}
                    style={[
                      styles.estadoBtn,
                      {
                        backgroundColor:
                          form.estado === 'activa' ? theme.colors.primary : theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.estadoBtnText,
                        { color: form.estado === 'activa' ? '#fff' : theme.colors.text },
                      ]}
                    >
                      Activa
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => set('estado', 'inactiva')}
                    style={[
                      styles.estadoBtn,
                      {
                        backgroundColor:
                          form.estado === 'inactiva' ? theme.colors.mutedText : theme.colors.card,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.estadoBtnText,
                        { color: form.estado === 'inactiva' ? '#fff' : theme.colors.text },
                      ]}
                    >
                      Inactiva
                    </Text>
                  </Pressable>
                </View>
              </View>
            </FormRow>
          </Card>
          ) : null}

          {section === 'economico' ? (
          <Card style={styles.block}>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>Parámetros económicos</Text>
            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
              Brief: porcentaje del bono, tope de costo promocional y mínimo elegible.
            </Text>
            <FormRow>
              <FormText
                label="% Bono"
                value={form.pctBono}
                onChangeText={(v) => set('pctBono', v)}
                placeholder="50"
                keyboardType="decimal-pad"
                suffix="%"
                style={{ flex: 1 }}
                helper="Bono = % × valor elegible (10% = $10.000 sobre $100.000)."
              />
              <FormText
                label="Tope costo promocional"
                value={form.pctTopeCosto}
                onChangeText={(v) => set('pctTopeCosto', v)}
                placeholder="5"
                keyboardType="decimal-pad"
                suffix="%"
                style={{ flex: 1 }}
                helper="Máximo bonos / ventas elegibles. La probabilidad se ajusta dinámicamente."
              />
            </FormRow>
            <FormRow>
              <FormText
                label="Probabilidad base"
                value={form.probabilidadBase}
                onChangeText={(v) => set('probabilidadBase', v)}
                placeholder="10"
                keyboardType="decimal-pad"
                suffix="%"
                style={{ flex: 1 }}
                helper="Punto de partida; baja sola al acercarse al tope."
              />
              <FormText
                label="Vigencia bono (días)"
                value={form.bonoVigenciaDias}
                onChangeText={(v) => set('bonoVigenciaDias', v)}
                placeholder="30"
                keyboardType="number-pad"
                style={{ flex: 1 }}
              />
            </FormRow>
            <FormText
              label="Valor mínimo elegible"
              value={form.minSubtotalElegible}
              onChangeText={(v) => set('minSubtotalElegible', v)}
              placeholder="0"
              keyboardType="decimal-pad"
              prefix="$"
              helper="Si la factura tiene menos elegible, no entra al sorteo."
            />
            <FormText
              label="Presupuesto total ($)"
              value={form.presupuestoTotal}
              onChangeText={(v) => set('presupuestoTotal', v)}
              placeholder="Vacío = solo control por %"
              keyboardType="decimal-pad"
              prefix="$"
              helper="Tope absoluto en pesos. Ej: 5.000.000"
            />
            <Text style={[styles.label, { color: theme.colors.mutedText }]}>Modo presupuesto</Text>
            <View style={styles.estadoBtns}>
              {(['ratio', 'mixto', 'absoluto'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => set('presupuestoModo', m)}
                  style={[
                    styles.estadoBtn,
                    {
                      backgroundColor:
                        form.presupuestoModo === m ? theme.colors.primary : theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.estadoBtnText,
                      { color: form.presupuestoModo === m ? '#fff' : theme.colors.text, fontSize: 11 },
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.helper, { color: theme.colors.mutedText }]}>
              ratio = solo % tope; mixto = % + $; absoluto = solo presupuesto en pesos.
            </Text>
          </Card>
          ) : null}

          {section === 'elegibilidad' ? (
          <Card style={styles.block}>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>Referencias elegibles</Text>
            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
              Selecciona las presentaciones que cuentan para el sorteo. Si no eliges ninguna, todas
              las presentaciones son elegibles.
            </Text>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Button title="Todas" onPress={seleccionarTodasPresentaciones} variant="secondary" />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Button title="Ninguna" onPress={quitarTodasPresentaciones} variant="secondary" />
              </View>
            </View>
            {PRESENTACIONES_OPCIONES.map((nombre) => (
              <View key={nombre} style={styles.checkRow}>
                <Switch
                  value={selectedRefs.includes(nombre)}
                  onValueChange={() => togglePresentacion(nombre)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
                <Text style={[styles.checkLabel, { color: theme.colors.text }]}>{nombre}</Text>
              </View>
            ))}
            <FormText
              label="Referencias adicionales (opcional)"
              value={form.refs}
              onChangeText={(v) => set('refs', v)}
              placeholder="Ej: AA, EXTRA, X-30"
              multiline
              helper="Puedes editar manualmente o usar los interruptores de arriba."
            />
            <FormText
              label="Leyenda en factura del bono"
              value={form.leyendaFacturaBono}
              onChangeText={(v) => set('leyendaFacturaBono', v)}
              placeholder="ESTA FACTURA CONTIENE UN BONO"
            />
          </Card>
          ) : null}

          {section === 'redencion' ? (
          <Card style={styles.block}>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>Restricciones de redención</Text>
            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
              Reglas del brief para proteger la rentabilidad de la campaña.
            </Text>
            <ToggleRow
              label="Solo en factura futura"
              description="El bono no se puede usar en la misma factura que lo generó."
              value={form.redencionSoloFacturaFutura}
              onChange={(v) => set('redencionSoloFacturaFutura', v)}
            />
            <ToggleRow
              label="Compra mínima = valor elegible original"
              description="La nueva compra debe igualar al menos el valor elegible que generó el bono."
              value={form.redencionMinIgualOrigen}
              onChange={(v) => set('redencionMinIgualOrigen', v)}
            />
            <ToggleRow
              label="No acumulable con otros bonos/promos"
              description="Solo un bono o promoción por factura."
              value={form.bonoNoAcumulable}
              onChange={(v) => set('bonoNoAcumulable', v)}
            />
            <ToggleRow
              label="Bono de un solo uso"
              description="Si se usa parcialmente, el saldo se pierde."
              value={form.bonoUnSoloUso}
              onChange={(v) => set('bonoUnSoloUso', v)}
            />
          </Card>
          ) : null}

          {section === 'resumen' ? (
            <>
              <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
                Revisa todos los parámetros antes de guardar la campaña.
              </Text>
              <CampaignParamsSummary form={form} campaignId={mode === 'edit' ? initial?.id : undefined} />
            </>
          ) : null}

          <View style={{ height: 12 }} />
          {section !== 'resumen' ? (
            <Button
              title="Siguiente: ver resumen"
              onPress={() => setSection('resumen')}
              variant="secondary"
              disabled={saving}
            />
          ) : null}
          <View style={{ height: section !== 'resumen' ? 8 : 0 }} />
          <Button
            title={mode === 'create' ? 'Crear campaña' : 'Guardar cambios'}
            onPress={onSubmit}
            loading={saving}
            disabled={saving}
            variant="primary"
          />
          <View style={{ height: 8 }} />
          <Button title="Cancelar" onPress={onClose} variant="secondary" disabled={saving} />
          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Inputs auxiliares (estilo consistente con tema)
// ---------------------------------------------------------------------------

function FormRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.formRow}>{children}</View>;
}

function FormText({
  label,
  helper,
  prefix,
  suffix,
  style,
  multiline,
  ...rest
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  helper?: string;
  prefix?: string;
  suffix?: string;
  style?: any;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[{ marginBottom: 10 }, style]}>
      <Text style={[styles.label, { color: theme.colors.mutedText }]}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            paddingVertical: multiline ? 8 : 0,
          },
        ]}
      >
        {prefix ? (
          <Text style={[styles.affix, { color: theme.colors.mutedText }]}>{prefix}</Text>
        ) : null}
        <TextInput
          {...rest}
          placeholderTextColor={theme.colors.mutedText}
          multiline={multiline}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              minHeight: multiline ? 60 : 42,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
        {suffix ? (
          <Text style={[styles.affix, { color: theme.colors.mutedText }]}>{suffix}</Text>
        ) : null}
      </View>
      {helper ? (
        <Text style={[styles.helper, { color: theme.colors.mutedText }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.toggleDesc, { color: theme.colors.mutedText }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ===========================================================================
// Pantalla principal
// ===========================================================================

export default function AdminCampaignsScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [presupuesto, setPresupuesto] = useState<Awaited<
    ReturnType<typeof api.getCampaignPresupuesto>
  > | null>(null);
  const [showCampaignDetails, setShowCampaignDetails] = useState(false);
  const [showPresupuestoDetails, setShowPresupuestoDetails] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<CampaignItem | null>(null);
  const [paramsViewOpen, setParamsViewOpen] = useState(false);

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [camps, us] = await Promise.all([api.getCampaigns(), api.getAdminUsers()]);
      setCampaigns(camps);
      setUsers(us);
      setSelectedId((prev) => {
        if (prev && camps.find((c) => c.id === prev)) return prev;
        return camps[0]?.id ?? '';
      });
    } catch (e: unknown) {
      const raw = (e as any)?.response?.data?.error;
      Alert.alert(
        'Error',
        errorToAlertMessage(raw, e instanceof Error ? e.message : 'No se pudieron cargar campañas')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadAssigned = useCallback(async () => {
    if (!selectedId) {
      setAssigned(new Set());
      setPresupuesto(null);
      return;
    }
    try {
      const [asig, pres] = await Promise.all([
        api.getCampaignUsers(selectedId),
        api.getCampaignPresupuesto(selectedId),
      ]);
      setAssigned(new Set(asig.usuarios || []));
      setPresupuesto(pres);
    } catch (e: unknown) {
      const raw = (e as any)?.response?.data?.error;
      Alert.alert(
        'Error',
        errorToAlertMessage(raw, e instanceof Error ? e.message : 'No se pudo cargar la campaña')
      );
      setPresupuesto(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (user?.rol === 'administrador') load();
  }, [user?.rol, load]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  useEffect(() => {
    setShowCampaignDetails(false);
    setShowPresupuestoDetails(false);
  }, [selectedId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const toggleUser = (u: string) => {
    setAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });
  };

  const guardarVendedores = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const list = Array.from(assigned.values()).sort();
      await api.putCampaignUsers(selectedId, list);
      Alert.alert('Guardado', 'Vendedores asignados actualizados.');
      loadAssigned();
    } catch (e: unknown) {
      const raw = (e as any)?.response?.data?.error;
      Alert.alert(
        'Error',
        errorToAlertMessage(raw, e instanceof Error ? e.message : 'No se pudo guardar')
      );
    } finally {
      setSaving(false);
    }
  };

  const onCreate = () => {
    setFormMode('create');
    setFormInitial(null);
    setFormOpen(true);
  };

  const onEdit = () => {
    if (!selected) return;
    setFormMode('edit');
    setFormInitial(selected);
    setFormOpen(true);
  };

  const onToggleEstado = async () => {
    if (!selected) return;
    const target = selected.estado === 'activa' ? 'inactiva' : 'activa';
    const verb = target === 'activa' ? 'Activar' : 'Desactivar';
    Alert.alert(
      `${verb} campaña`,
      `¿${verb} "${selected.nombre}"? ${target === 'inactiva' ? 'Los vendedores dejarán de poder sortear con esta campaña.' : ''}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: verb,
          style: target === 'inactiva' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const updated = await api.setCampaignEstado(selected.id, target);
              setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            } catch (e: unknown) {
              const raw = (e as any)?.response?.data?.error;
              Alert.alert(
                'Error',
                errorToAlertMessage(
                  raw,
                  e instanceof Error ? e.message : 'No se pudo cambiar el estado'
                )
              );
            }
          },
        },
      ]
    );
  };

  const onDelete = () => {
    if (!selected) return;
    Alert.alert(
      'Eliminar campaña',
      `¿Eliminar "${selected.nombre}"? Esta acción no se puede deshacer. Si la campaña ya tiene historial, el servidor sugerirá desactivarla en su lugar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCampaign(selected.id);
              setCampaigns((prev) => prev.filter((c) => c.id !== selected.id));
              setSelectedId('');
              Alert.alert('Eliminada', 'La campaña fue eliminada.');
            } catch (e: unknown) {
              const raw = (e as any)?.response?.data?.error;
              Alert.alert(
                'No se pudo eliminar',
                errorToAlertMessage(
                  raw,
                  e instanceof Error ? e.message : 'No se pudo eliminar la campaña'
                )
              );
            }
          },
        },
      ]
    );
  };

  const onSavedFromForm = (saved: CampaignItem) => {
    setCampaigns((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSelectedId(saved.id);
  };

  if (user?.rol !== 'administrador') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.noAccess, { color: theme.colors.mutedText }]}>Sin permiso.</Text>
      </View>
    );
  }

  const usuariosParticipantes = useMemo(
    () => users.filter((u) => u.rol === 'asesor' || u.rol === 'administrador'),
    [users]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Lista + Crear ---------------------------------------------------- */}
      <Card style={styles.block}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.colors.text, flex: 1 }]}>Campañas</Text>
          <Pressable
            onPress={onCreate}
            style={({ pressed }) => [
              styles.iconAction,
              {
                backgroundColor: pressed ? theme.colors.border : theme.colors.primary,
              },
            ]}
            accessibilityLabel="Crear campaña"
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.iconActionText}>Nueva</Text>
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
          Crea, modifica y administra campañas. La probabilidad de ganar se ajusta dinámicamente
          para no superar el tope de costo promocional configurado.
        </Text>

        <Pressable
          onPress={() => navigation.navigate('AdminCampaignOperaciones')}
          style={({ pressed }) => [
            styles.guideBanner,
            {
              backgroundColor: pressed ? theme.colors.primary + '33' : theme.colors.primary + '18',
              borderColor: theme.colors.primary,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Ver guía de operaciones y probabilidades"
        >
          <View style={[styles.guideIconWrap, { backgroundColor: theme.colors.primary }]}>
            <Ionicons name="book-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.guideTitle, { color: theme.colors.text }]}>
              Guía de operaciones y probabilidades
            </Text>
            <Text style={[styles.guideSubtitle, { color: theme.colors.mutedText }]}>
              Para gerencia: parámetros, validaciones al participar y cómo se calcula el sorteo.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={theme.colors.primary} />
        </Pressable>

        {campaigns.length === 0 && !loading ? (
          <Text style={[styles.hint, { color: theme.colors.mutedText, marginTop: 6 }]}>
            Aún no hay campañas. Crea la primera con "Nueva".
          </Text>
        ) : null}

        {campaigns.map((c) => {
          const active = c.id === selectedId;
          const isInactiva = c.estado === 'inactiva';
          return (
            <Pressable
              key={c.id}
              onPress={() => setSelectedId(c.id)}
              style={({ pressed }) => [
                styles.campaignRow,
                {
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: pressed
                    ? theme.colors.border
                    : active
                    ? theme.colors.primary + '15'
                    : theme.colors.card,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.campaignName, { color: theme.colors.text }]} numberOfLines={1}>
                  {active ? '✓ ' : ''}
                  {c.nombre}
                </Text>
                <Text style={[styles.campaignMeta, { color: theme.colors.mutedText }]}>
                  {String(c.fechaInicio).slice(0, 10)} → {String(c.fechaFin).slice(0, 10)}
                </Text>
              </View>
              <View
                style={[
                  styles.estadoBadge,
                  {
                    backgroundColor: isInactiva
                      ? theme.colors.border
                      : theme.colors.primary + '22',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.estadoBadgeText,
                    { color: isInactiva ? theme.colors.mutedText : theme.colors.primary },
                  ]}
                >
                  {c.estado}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <View style={{ height: 8 }} />
        <Button
          title="Recargar"
          onPress={load}
          loading={loading}
          disabled={loading}
          variant="secondary"
        />
      </Card>

      {/* Detalle + Acciones ---------------------------------------------- */}
      {selected ? (
        <Card style={styles.block}>
          <View style={styles.headerRow}>
            <Text style={[styles.subtitle, { color: theme.colors.text, flex: 1, marginBottom: 0 }]}>
              {selected.nombre}
            </Text>
            <Pressable
              onPress={() => setParamsViewOpen(true)}
              style={({ pressed }) => [
                styles.detailToggle,
                {
                  backgroundColor: pressed ? theme.colors.border : theme.colors.primary + '22',
                  borderColor: theme.colors.primary,
                },
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="options-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.detailToggleText, { color: theme.colors.primary }]}>
                Parámetros
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCampaignDetails((v) => !v)}
              style={({ pressed }) => [
                styles.detailToggle,
                {
                  backgroundColor: pressed ? theme.colors.border : theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.detailToggleText, { color: theme.colors.text }]}>
                {showCampaignDetails ? 'Ocultar' : 'Vista rápida'}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.meta, { color: theme.colors.mutedText }]}>
            Vigencia: {String(selected.fechaInicio).slice(0, 10)} →{' '}
            {String(selected.fechaFin).slice(0, 10)}
          </Text>
          <Text style={[styles.meta, { color: theme.colors.mutedText }]}>
            Prob. base: {formatPct(Number(selected.probabilidadBase))} • Tope costo:{' '}
            {formatPct(Number(selected.pctTopeCosto))} • % Bono:{' '}
            {formatPct(Number(selected.pctBono))}
          </Text>

          <View style={styles.actionsGrid}>
            <ActionButton
              icon="options-outline"
              label="Configuración"
              onPress={() => setParamsViewOpen(true)}
              color={theme.colors.primary}
              bg={theme.colors.primary + '15'}
              border={theme.colors.primary}
            />
            <ActionButton
              icon="create-outline"
              label="Modificar"
              onPress={onEdit}
              color={theme.colors.text}
              bg={theme.colors.card}
              border={theme.colors.border}
            />
            <ActionButton
              icon={selected.estado === 'activa' ? 'pause-circle-outline' : 'play-circle-outline'}
              label={selected.estado === 'activa' ? 'Desactivar' : 'Activar'}
              onPress={onToggleEstado}
              color={selected.estado === 'activa' ? theme.colors.text : '#fff'}
              bg={selected.estado === 'activa' ? theme.colors.card : theme.colors.primary}
              border={
                selected.estado === 'activa' ? theme.colors.border : theme.colors.primary
              }
            />
          </View>
          <View style={styles.actionsGrid}>
            <ActionButton
              icon="trash-outline"
              label="Eliminar"
              onPress={onDelete}
              color="#fff"
              bg="#b91c1c"
              border="#b91c1c"
            />
          </View>

          {showCampaignDetails && selected ? (
            <CampaignParamsSummary form={formFromCampaign(selected)} campaignId={selected.id} />
          ) : null}
        </Card>
      ) : null}

      {/* Presupuesto / probabilidad dinámica ------------------------------ */}
      <Card style={styles.block}>
        <View style={styles.headerRow}>
          <Text style={[styles.subtitle, { color: theme.colors.text, flex: 1, marginBottom: 0 }]}>
            Presupuesto (por vendedor)
          </Text>
          <Pressable
            onPress={() => setShowPresupuestoDetails((v) => !v)}
            style={({ pressed }) => [
              styles.detailToggle,
              {
                backgroundColor: pressed ? theme.colors.border : theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.detailToggleText, { color: theme.colors.text }]}>
              {showPresupuestoDetails ? 'Ocultar' : 'Detalles'}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
          Headroom = (tope × ventas elegibles) − bonos emitidos. Si llega a 0, la probabilidad
          dinámica queda en 0%.
        </Text>
        {showPresupuestoDetails && presupuesto ? (
          <View
            style={[
              styles.detailsBox,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
            ]}
          >
            <Text style={[styles.explain, { color: theme.colors.mutedText }]}>
              V = ventas elegibles acumuladas; B = bonos emitidos. Tope = V × pctTope.
            </Text>
            <DetailRow label="pctTope (campaña)" value={formatPct(Number(presupuesto.pctTope))} />
            <DetailRow label="Modo presupuesto" value={presupuesto.presupuestoModo || 'ratio'} />
            {presupuesto.presupuestoTotal != null ? (
              <DetailRow
                label="Presupuesto total"
                value={`$${Math.round(presupuesto.presupuestoTotal).toLocaleString('es-CO')}`}
              />
            ) : null}
            {presupuesto.global ? (
              <>
                <DetailRow
                  label="Global V / B"
                  value={`$${Math.round(presupuesto.global.V).toLocaleString('es-CO')} / $${Math.round(presupuesto.global.B).toLocaleString('es-CO')}`}
                />
                <DetailRow
                  label="Participaciones / ganadores"
                  value={`${presupuesto.global.participaciones} / ${presupuesto.global.ganadores}`}
                />
                {presupuesto.global.headroomAbsoluto != null ? (
                  <DetailRow
                    label="Headroom absoluto ($)"
                    value={`$${Math.round(presupuesto.global.headroomAbsoluto).toLocaleString('es-CO')}`}
                  />
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
        {presupuesto?.items?.length ? (
          presupuesto.items.map((it) => (
            <View key={it.usuario} style={styles.rowCol}>
              <View style={styles.row}>
                <Text style={[styles.rowLeft, { color: theme.colors.text }]}>{it.usuario}</Text>
                <Text style={[styles.rowRight, { color: theme.colors.mutedText }]}>
                  Headroom: ${Math.round(it.headroom).toLocaleString('es-CO')}
                </Text>
              </View>
              {showPresupuestoDetails ? (
                <View
                  style={[
                    styles.detailsBox,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                  ]}
                >
                  <DetailRow
                    label="Ventas elegibles (V)"
                    value={`$${Math.round(Number(it.V) || 0).toLocaleString('es-CO')}`}
                  />
                  <DetailRow
                    label="Bonos emitidos (B)"
                    value={`$${Math.round(Number(it.B) || 0).toLocaleString('es-CO')}`}
                  />
                  <DetailRow
                    label="Tope (V × pct)"
                    value={`$${Math.round(
                      (Number(it.V) || 0) * (Number(presupuesto.pctTope) || 0)
                    ).toLocaleString('es-CO')}`}
                  />
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
            Aún no hay métricas para esta campaña (se crean al participar).
          </Text>
        )}
      </Card>

      {/* Asignación de usuarios ------------------------------------------ */}
      {selected ? (
        <Card style={styles.block}>
          <Text style={[styles.subtitle, { color: theme.colors.text }]}>Usuarios autorizados</Text>
          <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
            Asesores y administradores seleccionados podrán aplicar esta campaña al participar.
          </Text>
          {usuariosParticipantes.length === 0 ? (
            <Text style={[styles.hint, { color: theme.colors.mutedText }]}>
              No hay usuarios en el sistema.
            </Text>
          ) : (
            usuariosParticipantes.map((u) => (
              <View key={u.usuario} style={styles.checkRow}>
                <Switch
                  value={assigned.has(u.usuario)}
                  onValueChange={() => toggleUser(u.usuario)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor="#fff"
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkLabel, { color: theme.colors.text }]}>
                    {u.usuario}
                    {u.rol === 'administrador' ? ' (admin)' : ''}
                  </Text>
                  {u.nombre ? (
                    <Text style={[styles.checkSub, { color: theme.colors.mutedText }]}>
                      {u.nombre}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 10 }} />
          <Button
            title="Guardar asignación"
            onPress={guardarVendedores}
            loading={saving}
            disabled={saving || !selectedId}
            variant="primary"
          />
        </Card>
      ) : null}

      <CampaignFormModal
        visible={formOpen}
        mode={formMode}
        initial={formInitial}
        onClose={() => setFormOpen(false)}
        onSaved={onSavedFromForm}
      />

      <CampaignParamsViewModal
        visible={paramsViewOpen}
        campaign={selected}
        onClose={() => setParamsViewOpen(false)}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Pequeños componentes presentacionales
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailKey, { color: theme.colors.mutedText }]}>{label}</Text>
      <Text style={[styles.detailVal, { color: theme.colors.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  color,
  bg,
  border,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: pressed ? border : bg,
          borderColor: border,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  block: { padding: 14 },
  title: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  hint: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  meta: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  noAccess: { fontSize: 16, textAlign: 'center', marginTop: 40 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  iconAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  iconActionText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  guideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  guideIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  guideSubtitle: { fontSize: 11, fontWeight: '700', lineHeight: 15 },

  campaignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  campaignName: { fontSize: 14, fontWeight: '900' },
  campaignMeta: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  estadoBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },

  actionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtnText: { fontSize: 13, fontWeight: '900' },

  detailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  detailToggleText: { fontSize: 12, fontWeight: '900' },

  sectionNavWrap: {
    borderBottomWidth: 1,
    maxHeight: 52,
  },
  sectionNavContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sectionChipText: { fontSize: 12, fontWeight: '900' },

  summaryBlock: { padding: 12 },
  summaryGroupTitle: { fontSize: 14, fontWeight: '900', marginBottom: 8 },

  detailsBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  detailKey: { fontSize: 12, fontWeight: '800', flexShrink: 0 },
  detailVal: { fontSize: 12, fontWeight: '900', textAlign: 'right', flexShrink: 1 },
  explain: { fontSize: 12, fontWeight: '700', lineHeight: 16 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  checkLabel: { fontSize: 14, fontWeight: '900' },
  checkSub: { fontSize: 12, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowCol: { marginBottom: 8 },
  rowLeft: { fontSize: 13, fontWeight: '900' },
  rowRight: { fontSize: 13, fontWeight: '800' },

  // Modal del formulario
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  modalContent: { padding: 16, gap: 14, paddingBottom: 40 },
  iconBtn: { padding: 4 },

  // Formulario
  formRow: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  helper: { fontSize: 11, fontWeight: '700', marginTop: 4, lineHeight: 14 },
  inputBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 15, fontWeight: '700', paddingVertical: 0 },
  affix: { fontSize: 13, fontWeight: '800', paddingHorizontal: 4 },

  estadoBtns: { flexDirection: 'row', gap: 8 },
  estadoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  estadoBtnText: { fontSize: 13, fontWeight: '900' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 13, fontWeight: '900' },
  toggleDesc: { fontSize: 11, fontWeight: '700', marginTop: 2, lineHeight: 14 },
});
