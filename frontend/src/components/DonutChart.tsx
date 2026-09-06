import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, macroColors, spacing, type } from '../theme';

interface Segment {
  key: 'carbs' | 'protein' | 'fat';
  value: number;
  color: string;
  label: string;
}

interface DonutProps {
  size?: number;
  stroke?: number;
  calories: number;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
}

// Calorie contribution: carbs 4kcal/g, protein 4kcal/g, fat 9kcal/g
export const DonutChart: React.FC<DonutProps> = ({ size = 160, stroke = 18, calories, carbs_g, protein_g, fat_g }) => {
  const carbsKcal = carbs_g * 4;
  const proteinKcal = protein_g * 4;
  const fatKcal = fat_g * 9;
  const totalKcal = carbsKcal + proteinKcal + fatKcal || 1;

  const segments: Segment[] = [
    { key: 'carbs', value: carbsKcal / totalKcal, color: macroColors.carbs, label: 'Carbs' },
    { key: 'protein', value: proteinKcal / totalKcal, color: macroColors.protein, label: 'Protein' },
    { key: 'fat', value: fatKcal / totalKcal, color: macroColors.fat, label: 'Fat' },
  ];

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.wrap} testID="macro-donut-chart">
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation="-90" originX={size / 2} originY={size / 2}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.surfaceTertiary}
              strokeWidth={stroke}
              fill="none"
            />
            {segments.map((s) => {
              const length = circumference * s.value;
              const gap = circumference - length;
              const el = (
                <Circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={s.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${length} ${gap}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  fill="none"
                />
              );
              offset += length;
              return el;
            })}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.calNum} testID="calorie-value">{calories}</Text>
          <Text style={styles.calLabel}>kcal</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.key} style={styles.legendRow} testID={`macro-legend-${s.key}`}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendVal}>{Math.round(s.value * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  calNum: { fontSize: type.xxl, fontWeight: '700', color: colors.onSurface },
  calLabel: { fontSize: type.sm, color: colors.mutedText, marginTop: 2 },
  legend: { flex: 1, gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: type.base, color: colors.onSurfaceSecondary },
  legendVal: { fontSize: type.base, fontWeight: '600', color: colors.onSurface },
});
