import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

interface FloatingItem {
  emoji: string;
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
}

// Instead of emojis we use themed circles with Ionicons for a stylized floater
const ITEMS: FloatingItem[] = [
  { emoji: 'leaf', size: 42, left: width * 0.08, top: height * 0.12, delay: 0, duration: 3800 },
  { emoji: 'nutrition', size: 34, left: width * 0.78, top: height * 0.18, delay: 400, duration: 4200 },
  { emoji: 'leaf-outline', size: 28, left: width * 0.65, top: height * 0.06, delay: 900, duration: 3400 },
  { emoji: 'flower', size: 30, left: width * 0.15, top: height * 0.3, delay: 1200, duration: 4600 },
  { emoji: 'leaf', size: 24, left: width * 0.85, top: height * 0.42, delay: 500, duration: 3900 },
];

const iconColors = [colors.brandPrimary, colors.brandSecondary, '#66BB6A', '#F48F51'];

const Float: React.FC<{ item: FloatingItem; index: number }> = ({ item, index }) => {
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    ty.value = withDelay(item.delay, withRepeat(withTiming(-24, { duration: item.duration, easing: Easing.inOut(Easing.quad) }), -1, true));
    rot.value = withDelay(item.delay, withRepeat(withTiming(1, { duration: item.duration * 1.4, easing: Easing.linear }), -1, false));
  }, [ty, rot, item.delay, item.duration]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: ty.value },
      { rotate: `${rot.value * 360}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.item, { left: item.left, top: item.top, width: item.size, height: item.size, borderRadius: item.size / 2, backgroundColor: iconColors[index % iconColors.length] + '22' }, style]} pointerEvents="none">
      <Ionicons name={item.emoji as any} size={item.size * 0.55} color={iconColors[index % iconColors.length]} />
    </Animated.View>
  );
};

export const FloatingVeggies: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none" testID="floating-veggies">
      {ITEMS.map((it, i) => (
        <Float key={i} item={it} index={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  item: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
