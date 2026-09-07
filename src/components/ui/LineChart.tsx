import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

interface LineDataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineDataPoint[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 200, color = '#208AEF' }: LineChartProps) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.chartArea}>
        {data.map((point, index) => {
          const dotY = (1 - point.value / max) * (height - 60) + 10;
          const isLast = index === data.length - 1;
          return (
            <View key={index} style={styles.pointWrapper}>
              <View style={[styles.dot, { top: dotY, backgroundColor: color }]}>
                <Text style={[styles.dotValue, { color: theme.textSecondary }]}>
                  {point.value.toFixed(0)}
                </Text>
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    {
                      top: dotY + 4,
                      left: '50%',
                      width: '100%',
                      backgroundColor: color,
                    },
                  ]}
                />
              )}
              <Text
                style={[styles.pointLabel, { color: theme.textSecondary, top: height - 30 }]}
                numberOfLines={1}
              >
                {point.label}
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
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    flex: 1,
    paddingTop: 10,
  },
  pointWrapper: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    alignItems: 'center',
  },
  dotValue: {
    fontSize: 9,
    fontWeight: '600',
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
  },
  line: {
    position: 'absolute',
    height: 2,
  },
  pointLabel: {
    fontSize: 10,
    position: 'absolute',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
