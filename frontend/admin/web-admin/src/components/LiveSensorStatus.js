import React from 'react';
import { View, Text, ScrollView, Animated, Platform, Easing, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { styles } from '../styles/globalStyles';

const getStatusColor = (status) => {
    switch ((status || '').toUpperCase()) {
        case 'NORMAL':
        case 'SAFE':
            return '#4ade80';
        case 'ADVISORY':
            return '#fbbf24';
        case 'WARNING':
            return '#f97316';
        case 'ALARM':
        case 'CRITICAL':
            return '#ef4444';
        case 'OFFLINE':
            return '#94a3b8';
        default:
            return '#cbd5e1';
    }
};

const getStatusBgColor = (status) => {
    switch ((status || '').toUpperCase()) {
        case 'NORMAL':
        case 'SAFE':
            return 'rgba(74, 222, 128, 0.15)';
        case 'ADVISORY':
            return 'rgba(251, 191, 36, 0.15)';
        case 'WARNING':
            return 'rgba(249, 115, 22, 0.15)';
        case 'ALARM':
        case 'CRITICAL':
            return 'rgba(239, 68, 68, 0.15)';
        case 'OFFLINE':
            return 'rgba(148, 163, 184, 0.15)';
        default:
            return 'rgba(203, 213, 225, 0.15)';
    }
};

// ── Wave animation — stops when offline ──────────────────────────────────────
const WaterWave = ({ color, isOffline }) => {
    const animatedValue = React.useRef(new Animated.Value(0)).current;
    const animatedValue2 = React.useRef(new Animated.Value(0)).current;
    const anim1Ref = React.useRef(null);
    const anim2Ref = React.useRef(null);

    React.useEffect(() => {
        if (isOffline) {
            anim1Ref.current && anim1Ref.current.stop();
            anim2Ref.current && anim2Ref.current.stop();
            animatedValue.setValue(0);
            animatedValue2.setValue(0);
            return;
        }

        anim1Ref.current = Animated.loop(
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: false,
            })
        );
        anim1Ref.current.start();

        anim2Ref.current = Animated.loop(
            Animated.timing(animatedValue2, {
                toValue: 1,
                duration: 3500,
                easing: Easing.linear,
                useNativeDriver: false,
            })
        );
        anim2Ref.current.start();

        return () => {
            anim1Ref.current && anim1Ref.current.stop();
            anim2Ref.current && anim2Ref.current.stop();
        };
    }, [isOffline]);

    const translateX1 = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -150],
    });
    const translateX2 = animatedValue2.interpolate({
        inputRange: [0, 1],
        outputRange: [-150, 0],
    });

    const waveSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 40' preserveAspectRatio='none'%3E%3Cpath d='M0,20 C37.5,0 112.5,40 150,20 L150,40 L0,40 Z' fill='${encodeURIComponent(color)}' /%3E%3C/svg%3E`;
    const waveHighlightSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 40' preserveAspectRatio='none'%3E%3Cpath d='M0,20 C37.5,0 112.5,40 150,20 L150,40 L0,40 Z' fill='rgba(255,255,255,0.2)' /%3E%3C/svg%3E`;

    return (
        <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            backgroundColor: 'transparent',
            overflow: 'hidden',
        }}>
            {/* Liquid body */}
            <LinearGradient
                colors={[color, color, 'rgba(0,0,0,0.15)']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 15 }}
            />

            {!isOffline && (
                <>
                    <Animated.View style={{
                        position: 'absolute',
                        top: -12,
                        left: 0,
                        width: 300,
                        height: 40,
                        flexDirection: 'row',
                        transform: [{ translateX: translateX2 }],
                        opacity: 0.6,
                    }}>
                        <Image source={{ uri: waveHighlightSvg }} style={{ width: 150, height: 40 }} resizeMode="stretch" />
                        <Image source={{ uri: waveHighlightSvg }} style={{ width: 150, height: 40 }} resizeMode="stretch" />
                    </Animated.View>

                    <Animated.View style={{
                        position: 'absolute',
                        top: -8,
                        left: 0,
                        width: 300,
                        height: 40,
                        flexDirection: 'row',
                        transform: [{ translateX: translateX1 }],
                    }}>
                        <Image source={{ uri: waveSvg }} style={{ width: 150, height: 40 }} resizeMode="stretch" />
                        <Image source={{ uri: waveSvg }} style={{ width: 150, height: 40 }} resizeMode="stretch" />
                    </Animated.View>
                </>
            )}

            {/* Glass shine */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: '15%',
                width: '10%',
                height: '100%',
                backgroundColor: 'rgba(255,255,255,0.1)',
                opacity: 0.4,
            }} />
        </View>
    );
};

// ── Each card is its own component with its own Animated state ───────────────
const SensorCard = ({ sensor, isLast, thresholds }) => {
    const isOffline = (sensor.status || '').toUpperCase() === 'OFFLINE';
    const maxLevel = thresholds?.critical_level || 50;
    const targetFill = isOffline ? 0 : Math.min((Number(sensor.waterLevel) / maxLevel) * 100, 100);
    const color = getStatusColor(sensor.status);

    // Smooth animated height — prevents flicker on 1s refresh
    const animFill = React.useRef(new Animated.Value(targetFill)).current;

    React.useEffect(() => {
        Animated.timing(animFill, {
            toValue: targetFill,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
        }).start();
    }, [targetFill]);

    const animatedHeight = animFill.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={[
            styles.liveSensorCard,
            {
                marginRight: isLast ? 0 : 24,
                ...Platform.select({
                    web: { boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)' }
                })
            }
        ]}>
            {/* Header */}
            <View style={styles.sensorCardHeader}>
                <Text style={styles.sensorCardName}>{sensor.name}</Text>
                <Text style={styles.sensorCardLocation}>{sensor.location}</Text>
            </View>

            {/* Pill Gauge */}
            <View style={styles.sensorPillContainer}>
                <View style={styles.sensorPillTrack}>
                    {/* Animated fill — height drives gauge rise/fall */}
                    <Animated.View style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: animatedHeight,
                        overflow: 'hidden',
                    }}>
                        <WaterWave color={color} isOffline={isOffline} />
                    </Animated.View>

                    {/* Scale Markers — Dynamic based on critical threshold */}
                    <View style={styles.sensorPillMarkers}>
                        <View style={styles.sensorPillMarkerLine}>
                            <Text style={styles.sensorPillMarkerText}>{Math.round(maxLevel)}cm</Text>
                        </View>
                        <View style={styles.sensorPillMarkerLine}>
                            <Text style={styles.sensorPillMarkerText}>{Math.round(maxLevel * 0.75)}cm</Text>
                        </View>
                        <View style={styles.sensorPillMarkerLine}>
                            <Text style={styles.sensorPillMarkerText}>{Math.round(maxLevel * 0.5)}cm</Text>
                        </View>
                        <View style={styles.sensorPillMarkerLine}>
                            <Text style={styles.sensorPillMarkerText}>{Math.round(maxLevel * 0.25)}cm</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Value & Badge */}
            <View style={styles.sensorCardValueSection}>
                {isOffline ? (
                    <Text style={[styles.sensorCardValueLabel, { color: '#94a3b8' }]}>
                        0.0<Text style={styles.sensorCardValueUnit}>cm</Text>
                    </Text>
                ) : (
                    <Text style={styles.sensorCardValueLabel}>
                        {Number(sensor.waterLevel).toFixed(1)}
                        <Text style={styles.sensorCardValueUnit}>cm</Text>
                    </Text>
                )}
                {/* Raw distance — lets you verify the IoT device is sending data */}
                <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Poppins_400Regular', marginTop: 2 }}>
                    {isOffline
                        ? 'Raw: 0.0 cm'
                        : `Raw dist: ${Number(sensor.rawDistance || 0).toFixed(1)} cm`}
                </Text>
                <View style={[styles.sensorCardBadge, { backgroundColor: getStatusBgColor(sensor.status) }]}>
                    <Text style={[styles.sensorCardBadgeText, { color: getStatusColor(sensor.status) }]}>
                        {isOffline ? 'SENSOR OFFLINE' : (sensor.status || '').toUpperCase()}
                    </Text>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.sensorCardFooter}>
                <View style={styles.sensorCardFooterStat}>
                    <Feather name="battery" size={12} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.sensorCardFooterText}>{sensor.battery}%</Text>
                </View>
                <Text style={styles.sensorCardFooterTime}>Updated: {sensor.updatedAgo}</Text>
                <View style={styles.sensorCardFooterStat}>
                    <Feather name="bar-chart-2" size={12} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.sensorCardFooterText}>{sensor.signal}%</Text>
                </View>
            </View>
        </View>
    );
};

// ── Main export ───────────────────────────────────────────────────────────────
const LiveSensorStatus = ({ sensors = [], thresholds = { advisory_level: 15, warning_level: 30, critical_level: 50 } }) => {
    return (
        <View style={styles.liveSensorSection}>
            <View style={styles.liveSensorHeader}>
                <Feather name="wind" size={20} color="#001D39" style={{ marginRight: 8 }} />
                <Text style={styles.liveSensorTitle}>Live Sensor Status</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                persistentScrollbar={true}
                contentContainerStyle={styles.liveSensorScrollContent}
            >
                {sensors.map((sensor, index) => (
                    <SensorCard
                        key={sensor.name || index}
                        sensor={sensor}
                        isLast={index === sensors.length - 1}
                        thresholds={thresholds}
                    />
                ))}

                {sensors.length === 0 && (
                    <View style={styles.liveSensorEmpty}>
                        <Text style={styles.liveSensorEmptyText}>No active sensors found.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

export default LiveSensorStatus;