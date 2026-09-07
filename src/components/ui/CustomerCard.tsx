import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/hooks/use-settings';
import { Customer } from '@/store/types';
import { formatAmount } from '@/utils/helpers';

interface CustomerCardProps {
  customer: Customer;
  balance?: number;
  onPress: (customer: Customer) => void;
}

export function CustomerCard({ customer, balance, onPress }: CustomerCardProps) {
  const theme = useTheme();
  const { currency } = useSettings();
  const bal = balance ?? 0;

  const isPositive = bal >= 0;

  return (
    <Pressable
      onPress={() => onPress(customer)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.balanceDot, { backgroundColor: isPositive ? '#4ECDC4' : '#FF6B6B' }]} />
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {customer.mobile || 'No phone'}
          {customer.mobile && customer.email ? ' • ' : ''}
          {customer.email || ''}
        </Text>
        <Text style={[styles.balanceLabel, { color: isPositive ? '#4ECDC4' : '#FF6B6B' }]}>
          {isPositive ? 'Receivable' : 'Payable'}: {formatAmount(Math.abs(bal), currency)}
        </Text>
      </View>
      <Text style={[styles.arrow, { color: theme.textSecondary }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  balanceDot: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    marginBottom: 2,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 24,
    fontWeight: '300',
    marginLeft: 8,
  },
});
