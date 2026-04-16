import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing, ActivityIndicator } from 'react-native';

const LoadingOverlay = ({
    message = "Loading...",
    accentColor = "#7BBDE8",
    overlayBg = 'rgba(0, 29, 57, 0.85)'
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulsing animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                })
            ])
        ).start();

        // Rotation animation
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
            <View style={styles.blurContainer}>
                <Animated.View style={[styles.loaderContainer, { transform: [{ scale: pulseAnim }] }]}>
                    <Animated.View style={[styles.spinnerWrapper, { transform: [{ rotate: spin }] }]}>
                        <View style={[styles.spinnerCore, { borderTopColor: accentColor }]} />
                        <View style={[styles.spinnerOrb, { backgroundColor: accentColor, shadowColor: accentColor }]} />
                    </Animated.View>

                    <View style={styles.innerContent}>
                        <ActivityIndicator size="small" color={accentColor} />
                    </View>
                </Animated.View>

                <Text style={styles.messageText}>{message}</Text>
                <View style={styles.progressBarContainer}>
                    <Animated.View style={[styles.progressBarFill, { backgroundColor: accentColor }]} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 29, 57, 0.85)', // Deep Navy Space matches LandingPage theme
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    blurContainer: {
        alignItems: 'center',
        padding: 32,
        borderRadius: 24,
    },
    loaderContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    spinnerWrapper: {
        position: 'absolute',
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerCore: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(123, 189, 232, 0.1)',
        borderTopColor: '#7BBDE8',
    },
    spinnerOrb: {
        position: 'absolute',
        top: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#7BBDE8',
        shadowColor: '#7BBDE8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    innerContent: {
        width: 40,
        height: 40,
        borderRadius: 16,
        backgroundColor: 'rgba(10, 65, 116, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageText: {
        color: '#ffffff',
        fontSize: 18,
        fontFamily: 'Poppins_600SemiBold',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    progressBarContainer: {
        width: 120,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        width: '60%',
        height: '100%',
        backgroundColor: '#7BBDE8',
        borderRadius: 2,
    }
});

export default LoadingOverlay;
