import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { CustomerCard } from '@/components/ui/CustomerCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { onDataRefresh } from '@/store/dataRefresh';
import { searchCustomers, deleteCustomer, getCustomerBalance } from '@/store/storage';
import { Customer, CustomerFilter } from '@/store/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [balances, setBalances] = useState<Record<string, number>>({});

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

  const handleDelete = (customer: Customer) => {
    Alert.alert('Delete Customer', `Delete "${customer.name}" and all their transactions?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCustomer(customer.id, userId);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            loadCustomers();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete customer');
          }
        },
      },
    ]);
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
          onChangeText={setSearchQuery}
          onSubmitEditing={loadCustomers}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => { setSearchQuery(''); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); loadCustomers(); }}>
            <View style={[styles.clearBtn, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.clearBtnIcon, { color: theme.textSecondary }]}>✕</Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Customer List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {customers.length === 0 ? (
          <EmptyState title="No customers found" subtitle="Add your first customer to get started" />
        ) : (
          customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              balance={balances[customer.id]}
              onPress={handleCustomerPress}
            />
          ))
        )}
      </ScrollView>
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
  listContent: { padding: 20, paddingBottom: 40 },
});
