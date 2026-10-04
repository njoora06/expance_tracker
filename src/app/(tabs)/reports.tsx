import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SymbolView } from 'expo-symbols';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings';
import { useAuth } from '@/hooks/use-auth';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PickerModal } from '@/components/ui/PickerModal';
import {
  getCustomers,
  getCustomerReport,
  getAllCustomersReport,
} from '@/store/storage';
import { formatAmount, formatDate } from '@/utils/helpers';
import { exportCustomerReport } from '@/utils/export';
import { notify } from '@/utils/notify';
import { Customer } from '@/store/types';
import { Spacing } from '@/constants/theme';

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

const PERIOD_ICONS: Record<ReportPeriod, { ios: string; android: string; web: string }> = {
  daily: { ios: 'calendar.day.fill', android: 'calendar_today', web: 'calendar_today' },
  weekly: { ios: 'calendar.week', android: 'calendar_week', web: 'calendar_week' },
  monthly: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  yearly: { ios: 'calendar.badge.clock', android: 'calendar_clock', web: 'calendar_clock' },
  custom: { ios: 'slider.horizontal.3', android: 'tune', web: 'tune' },
};

export default function ReportsScreen() {
  const theme = useTheme();
  const { currency } = useSettings();
  const { user } = useAuth();

  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const [totalCredit, setTotalCredit] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [txnCount, setTxnCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const userId = user?.id || '';

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start: Date, end: Date;
    switch (period) {
      case 'daily':
        start = new Date(now); start.setHours(0, 0, 0, 0);
        end = new Date(now); end.setHours(23, 59, 59, 999);
        break;
      case 'weekly': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now); start.setDate(diff); start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
        break;
      }
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'yearly':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        start = new Date(customStart); start.setHours(0, 0, 0, 0);
        end = new Date(customEnd); end.setHours(23, 59, 59, 999);
        break;
    }
    return { start: start!, end: end! };
  }, [period, customStart, customEnd]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const allCustomers = await getCustomers(userId);
    setCustomers(allCustomers);

    const range = getDateRange();

    if (selectedCustomerId) {
      const report = await getCustomerReport(selectedCustomerId, range.start, range.end, userId);
      setTotalCredit(report.totalCredit);
      setTotalDebit(report.totalDebit);
      setClosingBalance(report.closingBalance);
      setTxnCount(report.transactions.length);
    } else {
      const reports = await getAllCustomersReport(range.start, range.end, userId);
      setTotalCredit(reports.reduce((s, r) => s + r.totalCredit, 0));
      setTotalDebit(reports.reduce((s, r) => s + r.totalDebit, 0));
      setClosingBalance(reports.reduce((s, r) => s + r.closingBalance, 0));
      setTxnCount(reports.length);
    }
    setLoading(false);
  }, [period, selectedCustomerId, customStart, customEnd, userId, getDateRange]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const showExportResult = (exporting: Promise<boolean>) => {
    notify.promise(
      exporting.then((success) => {
        if (!success) throw new Error('Export failed');
      }),
      { loading: 'Exporting report…', success: 'Report exported', error: "Couldn't export report" }
    ).catch(() => {});
  };

  const handleExport = async () => {
    if (!userId) return;
    const range = getDateRange();
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const periodLabel = `${PERIOD_LABELS[period]}: ${formatDate(range.start.toISOString())} – ${formatDate(range.end.toISOString())}`;
    if (selectedCustomerId && customer) {
      const report = await getCustomerReport(selectedCustomerId, range.start, range.end, userId);
      showExportResult(exportCustomerReport({
        scope: customer.name,
        period: periodLabel,
        filename: `${period}_${customer.name}`,
        currency,
        rows: report.transactions.map((txn) => ({ customerName: customer.name, txn })),
        openingBalance: report.closingBalance - report.totalCredit + report.totalDebit,
        closingBalance: report.closingBalance,
      }));
    } else {
      const reports = await getAllCustomersReport(range.start, range.end, userId);
      const rows = reports.flatMap((r) => r.transactions.map((txn) => ({ customerName: r.customerName, txn })));
      if (rows.length === 0) {
        notify.info('Nothing to export', 'There are no transactions in the selected period.');
        return;
      }
      const closingBalance = reports.reduce((s, r) => s + r.closingBalance, 0);
      const totalCredit = reports.reduce((s, r) => s + r.totalCredit, 0);
      const totalDebit = reports.reduce((s, r) => s + r.totalDebit, 0);
      rows.sort((a, b) => new Date(b.txn.date).getTime() - new Date(a.txn.date).getTime());
      showExportResult(exportCustomerReport({
        scope: 'All customers',
        period: periodLabel,
        filename: `${period}_all_customers`,
        currency,
        rows,
        openingBalance: closingBalance - totalCredit + totalDebit,
        closingBalance,
        customers: reports.map((r) => ({ id: r.customerId, name: r.customerName, closingBalance: r.closingBalance })),
      }));
    }
  };

  const handleClearFilters = useCallback(() => {
    setPeriod('monthly');
    setSelectedCustomerId('');
    const today = new Date();
    setCustomStart(today);
    setCustomEnd(today);
  }, []);

  const handleApply = useCallback(() => {
    loadData();
  }, [loadData]);

  const onStartChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (d) setCustomStart(d);
  };
  const onEndChange = (_: DateTimePickerEvent, d?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (d) setCustomEnd(d);
  };

  const customerOptions = [
    { label: 'All Customers', value: '' },
    ...customers.map((c) => ({ label: c.name, value: c.id })),
  ];

  const selectedCustomerName = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId)?.name || 'Customer'
    : 'All Customers';

  const formatDateShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const periods = Object.keys(PERIOD_LABELS) as ReportPeriod[];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Reports</Text>
        <Pressable style={[styles.exportBtn, { backgroundColor: theme.backgroundElement }]} onPress={handleExport}>
          <Text style={[styles.exportBtnText, { color: theme.text }]}>Export</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Filter Panel */}
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={[styles.filterCard, { backgroundColor: theme.backgroundElement }]}>
            {/* Filter Header */}
            <View style={styles.filterHeaderRow}>
              <View style={styles.filterHeaderLeft}>
                <SymbolView
                  name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }}
                  size={18}
                  weight="medium"
                  tintColor={theme.text}
                />
                <Text style={[styles.filterTitle, { color: theme.text }]}>Filters</Text>
              </View>
            </View>

            {/* Date Range Group */}
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Date Range</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
              {periods.map((p) => {
                const active = period === p;
                return (
                  <Pressable
                    key={p}
                    style={[
                      styles.periodPill,
                      { borderColor: theme.textSecondary + '30' },
                      active && { backgroundColor: '#208AEF', borderColor: '#208AEF' },
                    ]}
                    onPress={() => setPeriod(p)}
                  >
                    <SymbolView
                      name={PERIOD_ICONS[p] as any}
                      size={14}
                      weight={active ? 'bold' : 'regular'}
                      tintColor={active ? '#fff' : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.periodPillText,
                        { color: theme.textSecondary },
                        active && { color: '#fff' },
                      ]}
                    >
                      {PERIOD_LABELS[p]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Custom Date Range */}
            {period === 'custom' && (
              <View style={styles.customDateRow}>
                <Pressable
                  style={[styles.dateBtn, { backgroundColor: theme.background }]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <SymbolView
                    name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                    size={14}
                    weight="medium"
                    tintColor={theme.text}
                  />
                  <Text style={[styles.dateBtnLabel, { color: theme.textSecondary }]}>From</Text>
                  <Text style={[styles.dateBtnValue, { color: theme.text }]}>
                    {formatDateShort(customStart)}
                  </Text>
                </Pressable>
                <Text style={[styles.dateSep, { color: theme.textSecondary }]}>—</Text>
                <Pressable
                  style={[styles.dateBtn, { backgroundColor: theme.background }]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <SymbolView
                    name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                    size={14}
                    weight="medium"
                    tintColor={theme.text}
                  />
                  <Text style={[styles.dateBtnLabel, { color: theme.textSecondary }]}>To</Text>
                  <Text style={[styles.dateBtnValue, { color: theme.text }]}>
                    {formatDateShort(customEnd)}
                  </Text>
                </Pressable>
                {showStartPicker && (
                  <DateTimePicker value={customStart} mode="date" onChange={onStartChange} />
                )}
                {showEndPicker && (
                  <DateTimePicker value={customEnd} mode="date" onChange={onEndChange} />
                )}
              </View>
            )}

            {/* Customer Group */}
            <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Customer</Text>
            <Pressable
              style={[styles.customerRow, { backgroundColor: theme.background }]}
              onPress={() => setShowCustomerPicker(true)}
            >
              <SymbolView
                name={{ ios: 'person.circle', android: 'person', web: 'person' }}
                size={20}
                weight="medium"
                tintColor={theme.text}
              />
              <Text style={[styles.customerRowText, { color: theme.text }]} numberOfLines={1}>
                {selectedCustomerName}
              </Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                weight="bold"
                tintColor={theme.textSecondary}
              />
            </Pressable>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable style={styles.clearBtn} onPress={handleClearFilters}>
                <SymbolView
                  name={{ ios: 'arrow.counterclockwise', android: 'refresh', web: 'refresh' }}
                  size={14}
                  weight="medium"
                  tintColor={theme.textSecondary}
                />
                <Text style={[styles.clearBtnText, { color: theme.textSecondary }]}>Clear</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={handleApply}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={14}
                  weight="bold"
                  tintColor="#fff"
                />
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Active Filter Chips */}
        <View style={styles.chipsRow}>
          <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.chipText, { color: theme.text }]}>{PERIOD_LABELS[period]}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.chipText, { color: theme.text }]}>
              {selectedCustomerName === 'All Customers' ? 'All Customers' : selectedCustomerName}
            </Text>
          </View>
          {period === 'custom' && (
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.chipText, { color: theme.text }]}>
                {formatDateShort(customStart)} – {formatDateShort(customEnd)}
              </Text>
            </View>
          )}
        </View>

        {/* Summary Cards */}
        {loading ? null : (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard label="Total Credit" amount={formatAmount(totalCredit, currency)} color="#4ECDC4" />
              <SummaryCard label="Total Debit" amount={formatAmount(totalDebit, currency)} color="#FF6B6B" />
            </View>
            <SummaryCard
              label="Closing Balance"
              amount={formatAmount(closingBalance, currency)}
              color={closingBalance >= 0 ? '#4ECDC4' : '#FF6B6B'}
            />

            {txnCount === 0 && selectedCustomerId ? (
              <EmptyState title="No transactions" subtitle="No transactions for this period" />
            ) : null}
            {txnCount === 0 && !selectedCustomerId ? (
              <EmptyState title="No data" subtitle="No customer data for this period" />
            ) : null}
          </>
        )}
      </ScrollView>

      <PickerModal
        visible={showCustomerPicker}
        title="Select Customer"
        options={customerOptions}
        selected={selectedCustomerId}
        onSelect={(v) => { setSelectedCustomerId(v); setShowCustomerPicker(false); }}
        onClose={() => setShowCustomerPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800' },
  exportBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  exportBtnText: { fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },

  /* Filter Card */
  filterCard: {
    borderRadius: 20,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  filterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  /* Group Labels */
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.two,
    marginTop: Spacing.two,
  },

  /* Period Pills */
  periodScroll: {
    marginBottom: 4,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  periodPillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Custom Date */
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.two,
  },
  dateBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    gap: 4,
  },
  dateBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dateBtnValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateSep: {
    fontSize: 16,
    fontWeight: '300',
  },

  /* Customer */
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  customerRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },

  /* Action Buttons */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#208AEF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Active Filter Chips */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  summaryRow: { flexDirection: 'row', gap: 12 },
});
