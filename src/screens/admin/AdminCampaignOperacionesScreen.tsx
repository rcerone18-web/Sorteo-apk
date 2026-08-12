import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeProvider';
import { Card } from '../../components/ui/Card';

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primary + '22' }]}>
        <Ionicons name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: theme.colors.mutedText }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function FlowStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.flowStep}>
      <View style={[styles.stepBadge, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.stepBody, { color: theme.colors.mutedText }]}>{children}</Text>
      </View>
    </View>
  );
}

function ParamItem({
  name,
  queEs,
  ejemplo,
  impacto,
}: {
  name: string;
  queEs: string;
  ejemplo?: string;
  impacto: string;
}) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.paramItem, { borderColor: theme.colors.border }]}>
      <Text style={[styles.paramName, { color: theme.colors.primary }]}>{name}</Text>
      <Text style={[styles.paramQue, { color: theme.colors.text }]}>{queEs}</Text>
      {ejemplo ? (
        <Text style={[styles.paramEjemplo, { color: theme.colors.mutedText }]}>Ejemplo: {ejemplo}</Text>
      ) : null}
      <Text style={[styles.paramImpacto, { color: theme.colors.mutedText }]}>
        Impacto: {impacto}
      </Text>
    </View>
  );
}

function CollapsibleBlock({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={styles.block}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.collapseHeader}>
        <Text style={[styles.collapseTitle, { color: theme.colors.text, flex: 1 }]}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.mutedText}
        />
      </Pressable>
      {open ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </Card>
  );
}

export default function AdminCampaignOperacionesScreen() {
  const { theme } = useAppTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.hero}>
        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
          Guía de operaciones del sorteo
        </Text>
        <Text style={[styles.heroText, { color: theme.colors.mutedText }]}>
          Resumen para gerencia: qué se configura en una campaña, qué valida el sistema cuando un
          cliente participa y cómo se calcula la probabilidad de ganar en tiempo real.
        </Text>
      </Card>

      {/* CONFIGURACIÓN */}
      <Card style={styles.block}>
        <SectionTitle
          icon="settings-outline"
          title="Al configurar una campaña"
          subtitle="Operaciones que realiza el administrador y qué guarda el sistema"
        />
        <FlowStep n={1} title="Crear la campaña (identidad)">
          Se define nombre, fechas de vigencia y estado (activa/inactiva). Solo las campañas activas
          dentro del rango de fechas aplican al sorteo.
        </FlowStep>
        <FlowStep n={2} title="Definir parámetros económicos">
          Se configuran % del bono, tope de costo promocional, probabilidad base, vigencia del bono,
          valor mínimo elegible y opcionalmente presupuesto en pesos (modo ratio, mixto o absoluto).
        </FlowStep>
        <FlowStep n={3} title="Elegibilidad de productos">
          Se seleccionan las presentaciones que cuentan para el sorteo. Si no se elige ninguna, todas
          las presentaciones de la factura pueden participar.
        </FlowStep>
        <FlowStep n={4} title="Reglas de redención del bono">
          Se activan o desactivan restricciones: solo factura futura, compra mínima igual al valor
          elegible, no acumulable y bono de un solo uso.
        </FlowStep>
        <FlowStep n={5} title="Asignar usuarios autorizados">
          Solo los asesores y administradores asignados pueden aplicar esa campaña al participar. Sin
          asignación, el asesor recibe error; el administrador puede usar la campaña activa por
          defecto para pruebas.
        </FlowStep>
        <FlowStep n={6} title="Guardar y activar">
          Al guardar, los parámetros quedan en base de datos. Las métricas (ventas elegibles, bonos
          emitidos) empiezan en cero y se actualizan con cada venta y participación.
        </FlowStep>
      </Card>

      {/* PARÁMETROS */}
      <CollapsibleBlock title="Glosario de parámetros de campaña" defaultOpen>
        <ParamItem
          name="% Bono"
          queEs="Porcentaje del valor elegible que se otorga como descuento si el cliente gana."
          ejemplo="50% sobre $100.000 elegibles → bono de $50.000"
          impacto="A mayor % bono, mayor costo por ganador y menor headroom para seguir sorteando."
        />
        <ParamItem
          name="Tope costo promocional"
          queEs="Límite de bonos emitidos respecto a ventas elegibles acumuladas (ratio B/V)."
          ejemplo="5% → por cada $100 en ventas elegibles, máximo $5 en bonos"
          impacto="Cuando B/V se acerca al tope, la probabilidad baja automáticamente hasta 0%."
        />
        <ParamItem
          name="Probabilidad base"
          queEs="Punto de partida del sorteo antes de ajustes dinámicos."
          ejemplo="10% = 1 de cada 10 participaciones ganaría si no hubiera tope"
          impacto="Nunca supera el cap calculado por headroom y presupuesto."
        />
        <ParamItem
          name="Valor mínimo elegible"
          queEs="Subtotal mínimo de la factura (en referencias elegibles) para entrar al sorteo."
          ejemplo="$50.000 mínimo → facturas menores no participan"
          impacto="Filtra participaciones de bajo ticket."
        />
        <ParamItem
          name="Presupuesto total ($)"
          queEs="Tope absoluto en pesos para bonos de la campaña (opcional)."
          ejemplo="$5.000.000 → al agotarse, probabilidad = 0%"
          impacto="Modo ratio: solo %; mixto: % y $; absoluto: solo pesos."
        />
        <ParamItem
          name="Presentaciones elegibles"
          queEs="Referencias de huevo que suman al valor elegible y habilitan la participación."
          ejemplo="Solo EXTRA y AA"
          impacto="Si la factura no incluye ninguna, se rechaza la participación."
        />
        <ParamItem
          name="Vigencia del bono (días)"
          queEs="Días calendario para redimir el bono después de ganarlo."
          ejemplo="30 días"
          impacto="Pasado el plazo, el bono queda vencido."
        />
      </CollapsibleBlock>

      {/* PARTICIPACIÓN */}
      <Card style={styles.block}>
        <SectionTitle
          icon="shuffle-outline"
          title="Cuando una persona participa"
          subtitle="Validaciones y operaciones automáticas del servidor"
        />
        <FlowStep n={1} title="Validar factura">
          El sistema verifica que la venta exista en el servidor, que no haya participado antes, que
          esté emitida y que no haya usado bono en la compra.
        </FlowStep>
        <FlowStep n={2} title="Mismo día de emisión">
          La participación solo es válida el mismo día de la factura (zona horaria Colombia).
        </FlowStep>
        <FlowStep n={3} title="Resolver campaña del vendedor">
          Se busca la campaña activa asignada al usuario que registra la participación.
        </FlowStep>
        <FlowStep n={4} title="Verificar referencias y valor elegible">
          Se calcula el subtotal de las presentaciones elegibles. Debe cumplir el mínimo configurado.
        </FlowStep>
        <FlowStep n={5} title="Calcular valor del bono potencial">
          Bono = valor elegible × % bono. Este monto se usa para el cálculo de probabilidad.
        </FlowStep>
        <FlowStep n={6} title="Consultar métricas acumuladas">
          Se leen ventas elegibles (V) y bonos emitidos (B) del vendedor y de la campaña global.
        </FlowStep>
        <FlowStep n={7} title="Calcular probabilidad final">
          El motor aplica la fórmula dinámica (ver sección siguiente) y obtiene la probabilidad
          real del sorteo en ese momento.
        </FlowStep>
        <FlowStep n={8} title="Ejecutar el sorteo">
          Se genera un número aleatorio entre 0 y 1. Si es menor que la probabilidad final, el
          cliente gana.
        </FlowStep>
        <FlowStep n={9} title="Registrar resultado">
          Se guarda participación, sorteo y auditoría de probabilidad. Si gana, se emite bono con
          código, vigencia y reglas de redención.
        </FlowStep>
        <FlowStep n={10} title="Actualizar métricas">
          Se incrementan ventas elegibles y bonos emitidos para controlar futuras probabilidades.
        </FlowStep>
      </Card>

      {/* PROBABILIDAD */}
      <Card style={[styles.block, styles.formulaCard, { borderColor: theme.colors.primary + '55' }]}>
        <SectionTitle
          icon="analytics-outline"
          title="Cómo se calcula la probabilidad"
          subtitle="Motor dinámico — protege el margen promocional"
        />
        <View style={[styles.formulaBox, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.formulaLabel, { color: theme.colors.mutedText }]}>Headroom (margen)</Text>
          <Text style={[styles.formulaExpr, { color: theme.colors.text }]}>
            Headroom = (Tope% × Ventas elegibles) − Bonos emitidos
          </Text>
          <Text style={[styles.formulaLabel, { color: theme.colors.mutedText, marginTop: 10 }]}>
            Probabilidad por cap
          </Text>
          <Text style={[styles.formulaExpr, { color: theme.colors.text }]}>
            Cap = Headroom ÷ Valor del bono
          </Text>
          <Text style={[styles.formulaLabel, { color: theme.colors.mutedText, marginTop: 10 }]}>
            Probabilidad final
          </Text>
          <Text style={[styles.formulaExpr, { color: theme.colors.primary }]}>
            P final = mínimo(Prob. base, Cap vendedor, Cap campaña, Cap presupuesto $)
          </Text>
        </View>
        <Text style={[styles.explain, { color: theme.colors.mutedText }]}>
          En palabras simples: mientras más bonos se hayan entregado respecto a las ventas elegibles,
          menos probabilidad hay de ganar. Si el headroom no alcanza para cubrir otro bono del tamaño
          calculado, la probabilidad baja a 0% y nadie gana hasta que haya más ventas o se ajuste la
          campaña.
        </Text>
        <View style={[styles.exampleBox, { borderColor: theme.colors.border }]}>
          <Text style={[styles.exampleTitle, { color: theme.colors.text }]}>Ejemplo numérico</Text>
          <Text style={[styles.exampleLine, { color: theme.colors.mutedText }]}>
            • Ventas elegibles acumuladas: $10.000.000{'\n'}
            • Tope costo: 5% → tope en bonos = $500.000{'\n'}
            • Bonos ya emitidos: $400.000 → headroom = $100.000{'\n'}
            • Cliente actual con valor elegible $200.000 y bono 50% → bono = $100.000{'\n'}
            • Cap = $100.000 ÷ $100.000 = 100% (limitado por prob. base, ej. 10%){'\n'}
            • Si bonos emitidos fueran $500.000 → headroom = 0 → probabilidad = 0%
          </Text>
        </View>
      </Card>

      {/* ERRORES COMUNES */}
      <CollapsibleBlock title="Mensajes de rechazo frecuentes">
        <View style={styles.rejectionList}>
          <Text style={[styles.rejectionItem, { color: theme.colors.text }]}>
            • «No tienes campaña asignada» — el vendedor no está en usuarios autorizados.
          </Text>
          <Text style={[styles.rejectionItem, { color: theme.colors.text }]}>
            • «Referencias requeridas» — la factura no incluye presentaciones elegibles.
          </Text>
          <Text style={[styles.rejectionItem, { color: theme.colors.text }]}>
            • «Mismo día» — la factura no es del día actual.
          </Text>
          <Text style={[styles.rejectionItem, { color: theme.colors.text }]}>
            • «Valor elegible insuficiente» — no alcanza el mínimo de la campaña.
          </Text>
          <Text style={[styles.rejectionItem, { color: theme.colors.text }]}>
            • «Presupuesto agotado» — se alcanzó el tope en pesos o ratio.
          </Text>
          <Text style={[styles.rejectionItem, { color: theme.colors.text }]}>
            • «Ya participó» — una factura solo puede sortearse una vez.
          </Text>
        </View>
      </CollapsibleBlock>

      {/* FLUJO VISUAL */}
      <Card style={styles.block}>
        <SectionTitle
          icon="git-network-outline"
          title="Flujo resumido"
          subtitle="De la venta al bono"
        />
        <Text style={[styles.flowDiagram, { color: theme.colors.mutedText }]}>
          VENTA → Valor elegible calculado{'\n'}
          ↓{'\n'}
          PARTICIPACIÓN → Validaciones (campaña, refs, mínimo, mismo día){'\n'}
          ↓{'\n'}
          MOTOR → Probabilidad dinámica según V, B y tope{'\n'}
          ↓{'\n'}
          SORTEO → Aleatorio vs probabilidad{'\n'}
          ↓{'\n'}
          GANA → Bono emitido + métricas actualizadas{'\n'}
          PIERDE → Solo registro de participación
        </Text>
      </Card>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
  hero: { padding: 16 },
  heroTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  heroText: { fontSize: 14, fontWeight: '600', lineHeight: 21 },
  block: { padding: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2, lineHeight: 17 },
  flowStep: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  stepTitle: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  stepBody: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  paramItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  paramName: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  paramQue: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginBottom: 4 },
  paramEjemplo: { fontSize: 12, fontWeight: '600', fontStyle: 'italic', marginBottom: 4 },
  paramImpacto: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  collapseHeader: { flexDirection: 'row', alignItems: 'center' },
  collapseTitle: { fontSize: 16, fontWeight: '900' },
  formulaCard: { borderWidth: 1 },
  formulaBox: { borderRadius: 12, padding: 14, marginBottom: 12 },
  formulaLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  formulaExpr: { fontSize: 14, fontWeight: '800', marginTop: 4, lineHeight: 20 },
  explain: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginBottom: 12 },
  exampleBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  exampleTitle: { fontSize: 13, fontWeight: '900', marginBottom: 6 },
  exampleLine: { fontSize: 12, fontWeight: '600', lineHeight: 19 },
  rejectionList: { gap: 8 },
  rejectionItem: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  flowDiagram: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: 'monospace',
  },
});
