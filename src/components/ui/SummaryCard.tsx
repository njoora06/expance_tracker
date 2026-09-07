import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface SummaryCardProps {
  label: string;
  amount: string;
  icon?: string;
  color?: string;
}

export function SummaryCard({ label, amount, color = '#208AEF' }: SummaryCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.amount, { color }]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    minWidth: 140,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  amount: {
    fontSize: 22,
    fontWeight: '700',
  },
});
