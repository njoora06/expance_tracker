import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { CustomerCard } from '@/components/ui/CustomerCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { onDataRefresh } from '@/store/dataRefresh';
import { searchCustomers, deleteCustomer, getCustomerBalance } from '@/store/storage';
import { Customer, CustomerFilter } from '@/store/types';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { notify } from '@/utils/notify';

const PAGE_SIZE = 7;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const listRef = useRef<ScrollView>(null);

  const userId = user?.id || '';

  const loadCustomers = useCallback(async () => {
    const filter: CustomerFilter = {
      searchQuery: searchQuery || undefined,
      sortBy: 'name',
    };
    const results = await searchCustomers(filter, userId);
    setCustomers(results);

    const balMap: Record<string, number> = {};
    for (const c of results) {
      balMap[c.id] = await getCustomerBalance(c.id, userId);
    }
    setBalances(balMap);
  }, [searchQuery, userId]);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  useEffect(() => {
    const unsub = onDataRefresh(() => loadCustomers());
    return unsub;
  }, [loadCustomers]);

  const handleDelete = async (customer: Customer) => {
    const ok = await confirm({
      title: 'Delete customer?',
      message: `"${customer.name}" and all their transactions will be permanently deleted.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteCustomer(customer.id, userId);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      loadCustomers();
      notify.success('Customer deleted', `${customer.name} has been removed.`);
    } catch (e) {
      notify.error("Couldn't delete customer");
    }
  };

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  // Clamp instead of resetting in an effect, so deleting the last item on a page falls back a page.
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageCustomers = customers.slice(pageStart, pageStart + PAGE_SIZE);

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(next, 1), totalPages));
    listRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleCustomerPress = (customer: Customer) => {
    router.push(`/customer/${customer.id}`);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Customers</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.searchIcon, { color: theme.textSecondary }]}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search customers..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={(text) => { setSearchQuery(text); setPage(1); }}
          onSubmitEditing={loadCustomers}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => { setSearchQuery(''); setPage(1); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); loadCustomers(); }}>
            <View style={[styles.clearBtn, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.clearBtnIcon, { color: theme.textSecondary }]}>✕</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Customer List */}
      <ScrollView ref={listRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {customers.length === 0 ? (
          <EmptyState title="No customers found" subtitle="Add your first customer to get started" />
        ) : (
          pageCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              balance={balances[customer.id]}
              onPress={handleCustomerPress}
            />
          ))
        )}
      </ScrollView>

      {/* Pagination */}
      {customers.length > PAGE_SIZE && (
        <View style={[styles.pager, { borderTopColor: theme.backgroundElement, backgroundColor: theme.background }]}>
          <Pressable
            style={[styles.pageBtn, { backgroundColor: theme.backgroundElement }, currentPage === 1 && styles.pageBtnDisabled]}
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            accessibilityLabel="Previous page"
          >
            <Text style={[styles.pageBtnText, { color: theme.text }]}>‹ Prev</Text>
          </Pressable>
          <View style={styles.pageInfo}>
            <Text style={[styles.pageLabel, { color: theme.text }]}>
              Page {currentPage} of {totalPages}
            </Text>
            <Text style={[styles.pageRange, { color: theme.textSecondary }]}>
              {pageStart + 1}–{pageStart + pageCustomers.length} of {customers.length}
            </Text>
          </View>
          <Pressable
            style={[styles.pageBtn, { backgroundColor: theme.primary }, currentPage === totalPages && styles.pageBtnDisabled]}
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            accessibilityLabel="Next page"
          >
            <Text style={[styles.pageBtnText, { color: '#fff' }]}>Next ›</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnIcon: { fontSize: 12, fontWeight: '700' },

  // List
  list: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 24 },

  // Pagination
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  pageBtn: {
    minWidth: 84,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 14, fontWeight: '600' },
  pageInfo: { alignItems: 'center' },
  pageLabel: { fontSize: 14, fontWeight: '700' },
  pageRange: { fontSize: 12, marginTop: 2 },
});
