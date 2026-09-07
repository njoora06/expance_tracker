import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  showValues?: boolean;
  maxValue?: number;
}

const CHART_COLORS = ['#208AEF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#F0A500', '#6C5CE7', '#A0A0A0'];

export function BarChart({ data, height = 200, showValues = true, maxValue }: BarChartProps) {
  const theme = useTheme();
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.barsContainer}>
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 40);
          const barColor = item.color || CHART_COLORS[index % CHART_COLORS.length];
          return (
            <View key={index} style={styles.barWrapper}>
              <View style={styles.barColumn}>
                {showValues && item.value > 0 && (
                  <Text style={[styles.barValue, { color: theme.textSecondary }]}>
                    {item.value.toFixed(0)}
                  </Text>
                )}
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(barHeight, item.value > 0 ? 4 : 0),
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[styles.barLabel, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    flex: 1,
    paddingTop: 20,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 60,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    borderRadius: 6,
    minHeight: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
