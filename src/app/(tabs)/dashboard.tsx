import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings';
import { useAuth } from '@/hooks/use-auth';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { CustomerCard } from '@/components/ui/CustomerCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { onDataRefresh } from '@/store/dataRefresh';
import {
  getCustomerCount,
  getCustomerBalance,
  getAllCustomersBalance,
  getTodayTransactions,
  getCustomers,
  getTodayTransactions as getTodayTxns,
} from '@/store/storage';
import { formatAmount, formatDate } from '@/utils/helpers';
import { Customer } from '@/store/types';

const RECENT_CUSTOMERS_COUNT = 3;

const COLORS = {
  customers: '#208AEF',
  receivable: '#4ECDC4',
  payable: '#FF6B6B',
  today: '#45B7D1',
};

function getGreeting(userName?: string): string {
  const hour = new Date().getHours();
  let greeting: string;
  if (hour >= 5 && hour < 12) greeting = 'Good Morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good Evening';
  else greeting = 'Good Night';
  return userName ? `${greeting}, ${userName}` : greeting;
}

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { currency } = useSettings();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [customerCount, setCustomerCount] = useState(0);
  const [totals, setTotals] = useState({ totalReceivable: 0, totalPayable: 0 });
  const [todayCount, setTodayCount] = useState(0);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [customerBalances, setCustomerBalances] = useState<Record<string, number>>({});

  const userId = user?.id || '';

  const loadData = useCallback(async () => {
    if (!userId) return;
    const count = await getCustomerCount(userId);
    const balances = await getAllCustomersBalance(userId);
    const todayTxns = await getTodayTxns(userId);
    const customers = await getCustomers(userId);

    setCustomerCount(count);
    setTotals(balances);
    setTodayCount(todayTxns.reduce((s, t) => s + t.transaction.amount, 0));

    // getCustomers() returns newest first.
    const recent = customers.slice(0, RECENT_CUSTOMERS_COUNT);
    const balancesArr = await Promise.all(
      recent.map((c) => getCustomerBalance(c.id, userId))
    );
    const balMap: Record<string, number> = {};
    recent.forEach((c, i) => { balMap[c.id] = balancesArr[i]; });
    setCustomerBalances(balMap);
    setRecentCustomers(recent);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const unsub = onDataRefresh(() => loadData());
    return unsub;
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.greetingRow}>
          <View style={styles.greetingTextCol}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              {getGreeting(user?.fullName)} 👋
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
          </View>
          {user?.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.avatarInitial, { color: theme.textSecondary }]}>
                {user?.fullName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Primary summary: Receivable & Payable */}
        <View style={styles.primaryRow}>
          <View style={styles.primaryCard}>
            <SummaryCard label="Total Receivable" amount={formatAmount(totals.totalReceivable, currency)} color={COLORS.receivable} />
          </View>
          <View style={styles.primaryCard}>
            <SummaryCard label="Total Payable" amount={formatAmount(totals.totalPayable, currency)} color={COLORS.payable} />
          </View>
        </View>

        {/* Secondary row: Today's Transactions & Total Customers */}
        <View style={styles.primaryRow}>
          <View style={styles.primaryCard}>
            <SummaryCard label="Today's Transactions" amount={formatAmount(todayCount, currency)} color={COLORS.today} />
          </View>
          <View style={styles.primaryCard}>
            <SummaryCard label="Total Customers" amount={String(customerCount)} color={COLORS.customers} />
          </View>
        </View>

        <Pressable
          style={[styles.quickAddBtn, { backgroundColor: '#208AEF' }]}
          onPress={() => router.push('/(tabs)/add-customer')}
        >
          <Text style={styles.quickAddText}>+ Quick Add Customer</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Customers</Text>

        {recentCustomers.length === 0 ? (
          <EmptyState title="No customers yet" subtitle="Tap the button above to add your first customer" />
        ) : (
          recentCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              balance={customerBalances[customer.id]}
              onPress={(c) => router.push(`/customer/${c.id}`)}
            />
          ))
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(tabs)/add-customer')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingTextCol: { flex: 1 },
  greeting: { fontSize: 14, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginLeft: 12 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24, marginLeft: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700' },
  primaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  primaryCard: {
    flex: 1,
  },
  quickAddBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  quickAddText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    lineHeight: 30,
  },
});
