import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    TextInput,
    Switch,
    StyleSheet,
    ImageBackground,
    useWindowDimensions,
    Image,
    ScrollView,
    Animated,
    Easing
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { styles as globalStyles } from "../styles/globalStyles";
import LoadingOverlay from "../components/LoadingOverlay";
import { API_BASE_URL } from "../config/api";

// Animated Particle Component
const Particle = ({ delay, startX, startY, size, color }) => {
    const translateY = React.useRef(new Animated.Value(startY)).current;
    const translateX = React.useRef(new Animated.Value(startX)).current;
    const opacity = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: Math.random() * 0.5 + 0.2, // Random opacity between 0.2 and 0.7
                    duration: 1000,
                    delay: delay,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: startY - (Math.random() * 200 + 100), // Float up
                        duration: Math.random() * 3000 + 3000, // 3-6 seconds (faster)
                        easing: Easing.linear,
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                    Animated.timing(translateX, {
                        toValue: startX + (Math.random() * 100 - 50), // Slight horizontal drift
                        duration: Math.random() * 3000 + 3000,
                        easing: Easing.linear,
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                ]),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                // Reset positions instantly while invisible
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: startY,
                        duration: 0,
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                    Animated.timing(translateX, {
                        toValue: startX,
                        duration: 0,
                        useNativeDriver: Platform.OS !== 'web',
                    }),
                ])
            ])
        ).start();
    }, []);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity: opacity,
                transform: [
                    { translateX },
                    { translateY }
                ],
                zIndex: 1, // Behind main content
            }}
        />
    );
};

const FloatingParticles = () => {
    const { width, height } = useWindowDimensions();
    const particleCount = 50; // Reduced from 150 for performance
    const colors = ['#BDD8E9', '#7BBDE8', '#49769F', '#0A4174'];

    const particles = React.useMemo(() => {
        return Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            delay: Math.random() * 5000,
            startX: Math.random() * width,
            startY: Math.random() * height + height / 2, // Start lower half or below
            size: Math.random() * 10 + 4, // 4-14px size
            color: colors[Math.floor(Math.random() * colors.length)],
        }));
    }, [width, height]);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {particles.map((p) => (
                <Particle
                    key={p.id}
                    delay={p.delay}
                    startX={p.startX}
                    startY={p.startY}
                    size={p.size}
                    color={p.color}
                />
            ))}
        </View>
    );
};

// A small functional component for progress bars in the Sensor List
const ProgressBar = ({ label, location, progress, status }) => {
    let color = "#49769F"; // Default blue
    let bg = "rgba(255, 255, 255, 0.1)";

    if (status === "Normal") color = "#7BBDE8"; // Cyan/Ice blue
    if (status === "Warning") color = "#fbbf24"; // Amber/Orange

    return (
        <View style={localStyles.sensorRow}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={localStyles.sensorLabel}>{label} — {location}</Text>
                <Text style={[localStyles.sensorLabel, { color: color, fontFamily: "Poppins_700Bold" }]}>{status}</Text>
            </View>
            <View style={localStyles.progressTrack}>
                <View style={[localStyles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
            </View>
        </View>
    );
};

// Main Landing Page Component
const LandingPage = ({ onLoginSuccess, onNavigatePublic, initialLoginOpen, resetInitialLogin }) => {
    const { width, height } = useWindowDimensions();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [typedText, setTypedText] = useState("");
    const cursorOpacity = useRef(new Animated.Value(0)).current;
    
    // Typing Animation Effect
    useEffect(() => {
        const fullText = "StaySafe.";
        let index = 0;
        let isTyping = true;
        let timeoutId;

        const runAnimation = () => {
            if (isTyping) {
                if (index <= fullText.length) {
                    setTypedText(fullText.substring(0, index));
                    index++;
                    timeoutId = setTimeout(runAnimation, 150);
                } else {
                    // Pause at the end of typing
                    isTyping = false;
                    timeoutId = setTimeout(runAnimation, 1500);
                }
            } else {
                if (index > 0) {
                    setTypedText(fullText.substring(0, index - 1));
                    index--;
                    timeoutId = setTimeout(runAnimation, 100);
                } else {
                    // Pause before restarting typing
                    isTyping = true;
                    timeoutId = setTimeout(runAnimation, 500);
                }
            }
        };

        runAnimation();

        // Blinking cursor animation
        const cursorAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(cursorOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(cursorOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
            ])
        );
        cursorAnimation.start();

        return () => {
            clearTimeout(timeoutId);
            cursorAnimation.stop();
        };
    }, []);

    useEffect(() => {
        if (initialLoginOpen) {
            setShowLoginModal(true);
            if (resetInitialLogin) resetInitialLogin();
        }
    }, [initialLoginOpen]);

    // Auth state map identical to before
    const [accessLevel, setAccessLevel] = useState("lgu"); // "lgu" or "admin"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isMobile = width < 1024;

    const scrollRef = useRef(null);
    const homeRef = useRef(null);
    const aboutRef = useRef(null);
    const featuresRef = useRef(null);
    const contactRef = useRef(null);

    const scrollToSection = (sectionRef) => {
        if (sectionRef && sectionRef.current && scrollRef.current) {
            sectionRef.current.measureLayout(
                scrollRef.current.getInnerViewNode(),
                (x, y) => {
                    scrollRef.current.scrollTo({ y, animated: true });
                },
                (error) => console.log('Error scrolling to section:', error)
            );
        }
    };

    const handleLogin = async () => {
        if (isLoading) return;
        setIsLoading(true);
        setError("");

        try {
            console.log("Attempting login with:", email, "Required Role:", accessLevel);
            const payload = { 
                username: email.trim().toLowerCase(), 
                password: password,
                required_role: accessLevel // 'admin' or 'lgu'
            };
            const loginPromise = fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const response = await loginPromise;
            const text = await response.text();
            let data = {};
            try { data = JSON.parse(text); } catch (e) { data = { error: text } }

            if (response.ok) {
                if (Platform.OS === "web") {
                    localStorage.setItem("authToken", data.token);
                    localStorage.setItem("userRole", data.user.role);
                    localStorage.setItem("userName", data.user.full_name || "Admin User");
                    localStorage.setItem("userId", data.user.id);
                }

                let appRole = "lgu";
                if (data.user.role === "super_admin") appRole = "admin";
                else if (data.user.role === "lgu_admin") appRole = "lgu";

                if (onLoginSuccess) {
                    setShowLoginModal(false);
                    onLoginSuccess(appRole);
                }
            } else {
                const errMsg = data.error || data.message || `Login failed (${response.status})`;
                setError(errMsg);
            }
        } catch (err) {
            console.error("Login error:", err);
            setError("Unable to connect to server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={localStyles.container}>
            {/* Subtle Matrix Dot Background */}
            <ImageBackground
                source={{ uri: "https://www.transparenttextures.com/patterns/cubes.png" }}
                style={StyleSheet.absoluteFill}
                imageStyle={{ opacity: 0.03, tintColor: '#ffffff' }}
            />

            {/* Floating Particles */}
            <FloatingParticles />

            {/* Top Navigation */}
            <View style={localStyles.navbar}>
                <View style={[localStyles.navbarInner, { paddingHorizontal: isMobile ? 24 : 54 }]}>
                    <View style={localStyles.navLeft}>
                        <Image source={require('../../assets/logo.png')} style={localStyles.logoImage} />
                        <Text style={localStyles.brandText}>FloodGuard</Text>
                    </View>

                    {!isMobile && (
                        <View style={localStyles.navCenter}>
                            <TouchableOpacity style={[localStyles.navLinkContainer, localStyles.navLinkActive]} onPress={() => scrollToSection(homeRef)}>
                                <Text style={[localStyles.navLinkText, { color: '#ffffff' }]}>Home</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={localStyles.navLinkContainer} onPress={() => scrollToSection(aboutRef)}>
                                <Text style={localStyles.navLinkText}>About</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={localStyles.navLinkContainer} onPress={() => scrollToSection(featuresRef)}>
                                <Text style={localStyles.navLinkText}>Features</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={localStyles.navLinkContainer} onPress={() => scrollToSection(contactRef)}>
                                <Text style={localStyles.navLinkText}>Contact</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={localStyles.navRight}>
                        {!isMobile && (
                            <View style={localStyles.liveBadgeContainer}>
                                <View style={localStyles.pulseDot} />
                                <Text style={localStyles.liveBadgeText}>LIVE</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={localStyles.loginBtn}
                            onPress={() => setShowLoginModal(true)}
                        >
                            <Text style={localStyles.loginBtnText}>Log in</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Split Screen Content Engine */}
            <ScrollView 
                ref={scrollRef}
                contentContainerStyle={localStyles.scrollWrapper} 
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
            >
                <View ref={homeRef} style={[localStyles.mainFlexbox, { minHeight: height - 100 }]}>
                    <View style={[localStyles.heroInner, { flexDirection: isMobile ? 'column' : 'row', paddingHorizontal: isMobile ? 24 : 54 }]}>
                        {/* LEFT HERO SECTION */}
                        <View style={localStyles.heroSection}>
                        <View style={localStyles.headlineContainer}>
                            <Text style={[localStyles.mainHeadline, { color: '#BDD8E9' }]}>Monitor.Alert.</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[localStyles.mainHeadline, { color: '#7BBDE8', marginTop: -20 }]}>{typedText}</Text>
                                <Animated.Text style={[localStyles.mainHeadline, { color: '#7BBDE8', marginTop: -20, opacity: cursorOpacity, marginLeft: 2 }]}>|</Animated.Text>
                            </View>
                        </View>

                        <Text style={localStyles.subHeadline}>
                            Together, advanced monitoring and real-time alerts lead to a safer, more{"\n"}
                            resilient community for all.
                        </Text>
                    </View>
                </View>
            </View>

                {/* ABOUT SECTION */}
                <View ref={aboutRef} style={[localStyles.contentSection, { marginTop: 100, minHeight: height - 100, paddingHorizontal: isMobile ? 24 : 54 }]}>
                    <Text style={[localStyles.sectionLabel, { textAlign: 'center', marginBottom: 12 }]}>OUR MISSION</Text>
                    <Text style={[localStyles.mainHeadline, { color: '#BDD8E9', textAlign: 'center', fontSize: 56, marginBottom: 16 }]}>About FloodGuard</Text>
                    <Text style={[localStyles.subHeadline, { textAlign: 'center', maxWidth: 800, alignSelf: 'center', marginBottom: 48 }]}>
                        FloodGuard is a state-of-the-art IoT monitoring system designed to protect communities from the devastating impacts of flooding through real-time data and instant intelligence.
                    </Text>

                    <View style={localStyles.cardContainer}>
                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="shield" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>For Local Government Units (LGUs)</Text>
                            <Text style={localStyles.cardText}>
                                As an LGU Moderator, you are the frontline defense for your community. FloodGuard provides you with real-time situational awareness across all monitored areas.
                            </Text>
                            <Text style={localStyles.cardBullet}>• Monitor live water levels in critical zones.</Text>
                            <Text style={localStyles.cardBullet}>• Receive instant alerts when water thresholds cross into Warning or Critical states.</Text>
                            <Text style={localStyles.cardBullet}>• Dispatch emergency responders swiftly based on precise map data.</Text>
                        </View>

                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="cpu" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>For System Administrators</Text>
                            <Text style={localStyles.cardText}>
                                As a Super Admin, your role ensures the underlying machinery of FloodGuard is perfectly tuned and accessible.
                            </Text>
                            <Text style={localStyles.cardBullet}>• Manage physical sensor deployments and monitor their connectivity.</Text>
                            <Text style={localStyles.cardBullet}>• Configure system-wide alert thresholds tailored to specific geographic zones.</Text>
                            <Text style={localStyles.cardBullet}>• Create and manage user accounts for new LGU representatives.</Text>
                        </View>
                    </View>
                </View>

                {/* FEATURES SECTION */}
                <View ref={featuresRef} style={[localStyles.contentSection, { marginTop: 100, minHeight: height - 100, paddingHorizontal: isMobile ? 24 : 54 }]}>
                    <Text style={[localStyles.sectionLabel, { textAlign: 'center', marginBottom: 12 }]}>CAPABILITIES</Text>
                    <Text style={[localStyles.mainHeadline, { color: '#BDD8E9', textAlign: 'center', fontSize: 56, marginBottom: 16 }]}>System Features</Text>
                    <Text style={[localStyles.subHeadline, { textAlign: 'center', maxWidth: 800, alignSelf: 'center', marginBottom: 48 }]}>
                        Discover how FloodGuard empowers communities through cutting-edge IoT technology and intelligent dashboard tools.
                    </Text>

                    <View style={localStyles.cardContainer}>
                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="activity" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>Real-time Monitoring</Text>
                            <Text style={localStyles.cardText}>
                                Our IoT sensors feed continuous data directly into the platform.
                            </Text>
                            <Text style={localStyles.cardBullet}>• <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>LGU Action:</Text> Watch live interactive map levels.</Text>
                            <Text style={localStyles.cardBullet}>• <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>Admin Action:</Text> Monitor individual sensor health.</Text>
                        </View>

                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="bell" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>Instant Alerts</Text>
                            <Text style={localStyles.cardText}>
                                Automated triggers fire the moment water reaches dangerous heights.
                            </Text>
                            <Text style={localStyles.cardBullet}>• <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>LGU Action:</Text> Receive immediate visual and SMS warnings.</Text>
                            <Text style={localStyles.cardBullet}>• <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>Admin Action:</Text> Calibrate precise state thresholds.</Text>
                        </View>

                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="bar-chart-2" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>Data Reports</Text>
                            <Text style={localStyles.cardText}>
                                Robust historical data tracking and secure access control.
                            </Text>
                            <Text style={localStyles.cardBullet}>• <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>LGU Action:</Text> Export historical flood event data.</Text>
                            <Text style={localStyles.cardBullet}>• <Text style={{ fontFamily: 'Poppins_700Bold', color: '#fff' }}>Admin Action:</Text> Manage authorized personnel accounts.</Text>
                        </View>
                    </View>
                </View>

                {/* CONTACT SECTION */}
                <View ref={contactRef} style={[localStyles.contentSection, { marginTop: 100, marginBottom: 100, minHeight: height - 100, paddingHorizontal: isMobile ? 24 : 54 }]}>
                    <Text style={[localStyles.sectionLabel, { textAlign: 'center', marginBottom: 12 }]}>GET IN TOUCH</Text>
                    <Text style={[localStyles.mainHeadline, { color: '#BDD8E9', textAlign: 'center', fontSize: 56, marginBottom: 16 }]}>Contact Us</Text>
                    <Text style={[localStyles.subHeadline, { textAlign: 'center', maxWidth: 800, alignSelf: 'center', marginBottom: 48 }]}>
                        We're here to support you. Reach out for technical assistance or emergency coordination.
                    </Text>

                    <View style={localStyles.cardContainer}>
                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="mail" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>Technical Support</Text>
                            <Text style={localStyles.cardText}>
                                For system administrators, hardware setup inquiries, and general platform support.
                            </Text>
                            <View style={{ marginTop: 16 }}>
                                <Text style={localStyles.contactMethodLabel}>Email Address</Text>
                                <View style={localStyles.contactMethodBox}>
                                    <Text style={localStyles.contactMethodText}>floodguardnotifications@gmail.com</Text>
                                </View>
                            </View>
                        </View>

                        <View style={localStyles.infoCard}>
                            <View style={localStyles.iconBox}>
                                <Feather name="phone-call" size={32} color="#7BBDE8" />
                            </View>
                            <Text style={localStyles.cardTitle}>Emergency Coordination</Text>
                            <Text style={localStyles.cardText}>
                                For LGU immediate operations, disaster response, and ground coordination.
                            </Text>
                            <View style={{ marginTop: 16 }}>
                                <Text style={localStyles.contactMethodLabel}>CDRRMO Hotline</Text>
                                <View style={localStyles.contactMethodBox}>
                                    <Text style={localStyles.contactMethodText}>0912-345-6789</Text>
                                </View>
                                <Text style={[localStyles.contactMethodLabel, { marginTop: 12 }]}>Barangay Contact</Text>
                                <View style={localStyles.contactMethodBox}>
                                    <Text style={localStyles.contactMethodText}>0998-765-4321</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* FOOTER SECTION */}
                <View style={localStyles.footerContainer}>
                    <View style={localStyles.footerDivider} />
                    <View style={[localStyles.footerContent, { 
                        flexDirection: width > 768 ? 'row' : 'column',
                        alignItems: width > 768 ? 'flex-start' : 'center',
                        paddingHorizontal: isMobile ? 24 : 54,
                    }]}>
                        <View style={[localStyles.footerBrand, { alignItems: width > 768 ? 'flex-start' : 'center' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <Image source={require('../../assets/logo.png')} style={localStyles.footerLogo} />
                                <Text style={localStyles.footerBrandText}>FloodGuard</Text>
                            </View>
                            <Text style={[localStyles.footerTagline, { textAlign: width > 768 ? 'left' : 'center' }]}>
                                Real-time IoT monitoring for safer, more resilient communities.
                            </Text>
                        </View>
                        <View style={localStyles.footerLinks}>
                            <TouchableOpacity onPress={() => scrollToSection(homeRef)}><Text style={localStyles.footerLinkText}>Home</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => scrollToSection(aboutRef)}><Text style={localStyles.footerLinkText}>About</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => scrollToSection(featuresRef)}><Text style={localStyles.footerLinkText}>Features</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => scrollToSection(contactRef)}><Text style={localStyles.footerLinkText}>Contact</Text></TouchableOpacity>
                        </View>
                        <View style={[localStyles.footerCredits, { alignItems: width > 768 ? 'flex-end' : 'center' }]}>
                            <Text style={localStyles.footerCreditsText}>© 2026 FloodGuard Team</Text>
                            <Text style={localStyles.footerCreditsSub}>Premium Disaster Intelligence</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Custom Dark Theme Login Modal Overlay */}
            {showLoginModal && (
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        {/* Close Button */}
                        <TouchableOpacity style={localStyles.modalCloseBtn} onPress={() => { setShowLoginModal(false); setError(""); }}>
                            <Feather name="x" size={20} color="#7BBDE8" />
                        </TouchableOpacity>

                        {/* Header */}
                        <View style={localStyles.modalHeaderContainer}>
                            <View style={localStyles.modalIconBox}>
                                <Image source={require('../../assets/logo.png')} style={{ width: 44, height: 44 }} />
                            </View>
                            <View style={localStyles.modalHeaderTextBox}>
                                <Text style={localStyles.modalTitleText}>Admin Access</Text>
                                <Text style={localStyles.modalSubText}>Control dashboard login</Text>
                            </View>
                        </View>

                        {/* Error Message */}
                        {error ? (
                            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 6, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                <Text style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</Text>
                            </View>
                        ) : null}

                        {/* Role Toggle */}
                        <View style={localStyles.roleToggleContainer}>
                            <TouchableOpacity
                                style={[localStyles.roleToggleBtn, accessLevel === 'lgu' && localStyles.roleToggleBtnActive]}
                                onPress={() => setAccessLevel('lgu')}
                            >
                                <Text style={[localStyles.roleToggleText, accessLevel === 'lgu' && localStyles.roleToggleTextActive]}>LGU Login</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[localStyles.roleToggleBtn, accessLevel === 'admin' && localStyles.roleToggleBtnActive]}
                                onPress={() => setAccessLevel('admin')}
                            >
                                <Text style={[localStyles.roleToggleText, accessLevel === 'admin' && localStyles.roleToggleTextActive]}>Admin Login</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 11, color: '#49769F', textAlign: 'center', marginBottom: 16, fontFamily: 'Poppins_400Regular' }}>
                            Tip: Make sure you've selected the correct tab for your account type.
                        </Text>

                        {/* Username Input */}
                        <Text style={localStyles.inputLabel}>USERNAME</Text>
                        <View style={localStyles.inputBox}>
                            <Feather name="user" size={18} color="#49769F" />
                            <TextInput
                                style={localStyles.textInputStyle}
                                onChangeText={setEmail}
                                value={email}
                                placeholder="Enter username"
                                placeholderTextColor="#49769F"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Password Input */}
                        <Text style={localStyles.inputLabel}>PASSWORD</Text>
                        <View style={localStyles.inputBox}>
                            <Feather name="lock" size={18} color="#49769F" />
                            <TextInput
                                style={localStyles.textInputStyle}
                                onChangeText={setPassword}
                                value={password}
                                placeholder="Enter password"
                                placeholderTextColor="#49769F"
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#49769F" />
                            </TouchableOpacity>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity style={localStyles.submitBtn} onPress={handleLogin} disabled={isLoading}>
                            <Feather name="lock" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={localStyles.submitBtnText}>
                                Sign In
                            </Text>
                        </TouchableOpacity>

                        {isLoading && <LoadingOverlay message="Authenticating..." />}
                    </View>
                </View>
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#001D39', // Deep Navy Space
    },
    navbar: {
        width: '100%',
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        zIndex: 10,
        backgroundColor: '#001D39', // Match main BG
        alignItems: 'center',
    },
    navbarInner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 1200,
        width: '100%',
        alignSelf: 'center',
    },
    navLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12,
    },
    brandText: {
        fontFamily: 'Poppins_700Bold',
        fontSize: 24,
        color: '#ffffff',
    },
    navCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 32,
    },
    navLinkContainer: {
        paddingVertical: 4,
    },
    navLinkActive: {
        borderBottomWidth: 2,
        borderColor: '#7BBDE8',
    },
    navLinkText: {
        color: '#94a3b8',
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
    },
    navRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    liveBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6EA2B3',
        marginRight: 4,
        shadowColor: '#6EA2B3',
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 4,
    },
    liveBadgeText: {
        color: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Poppins_600SemiBold',
    },
    loginBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    loginBtnText: {
        color: '#ffffff',
        fontFamily: 'Poppins_500Medium',
        fontSize: 14,
    },
    scrollWrapper: {
        flexGrow: 1,
        paddingVertical: 32,
    },
    mainFlexbox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroInner: {
        flex: 1,
        width: '100%',
        maxWidth: 1200,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroSection: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        paddingBottom: 32,
    },
    subHeadline: {
        color: '#94a3b8',
        fontSize: 18,
        fontFamily: 'Poppins_400Regular',
        lineHeight: 28,
        marginBottom: 32,
        maxWidth: 600,
        textAlign: 'center',
    },
    headlineContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    mainHeadline: {
        fontSize: Platform.OS === 'web' && window.innerWidth > 768 ? 200 : 100, // Increased from 160/84
        fontFamily: 'Poppins_700Bold',
        letterSpacing: -2,
        textShadowColor: 'rgba(123, 189, 232, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
        textAlign: 'center',
        includeFontPadding: false,
        lineHeight: Platform.OS === 'web' && window.innerWidth > 768 ? 210 : 110, // Increased to prevent clipping
    },
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        backgroundColor: '#0A4174',
    },
    startBtnText: {
        color: '#e2e8f0',
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 15,
        marginRight: 8,
    },
    dashboardSection: {
        flex: 1,
        maxWidth: 550,
        width: '100%',
    },
    glassCard: {
        backgroundColor: '#0A4174', // Semi-transparent blue tone
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(123, 189, 232, 0.15)',
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    cardHeaderText: {
        color: '#7BBDE8',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 0.5,
    },
    cardHeaderTime: {
        color: '#475569',
        fontSize: 11,
        fontFamily: 'Poppins_400Regular',
    },
    waterLevelContainer: {
        marginBottom: 24,
    },
    waterLevelLabel: {
        color: '#64748b',
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1,
        marginBottom: 8,
    },
    waterLevelLarge: {
        color: '#ffffff',
        fontSize: 48,
        fontFamily: 'Poppins_700Bold',
        lineHeight: 52,
    },
    waterLevelUnit: {
        fontSize: 24,
        color: '#94a3b8',
    },
    safeBadge: {
        backgroundColor: 'rgba(189, 216, 233, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(189, 216, 233, 0.3)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 16,
    },
    safeBadgeText: {
        color: '#BDD8E9',
        fontSize: 11,
        fontFamily: 'Poppins_600SemiBold',
        letterSpacing: 0.5,
    },
    chartBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        height: 60,
        marginBottom: 32,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    chartBar: {
        width: '7%',
        borderRadius: 2,
    },
    statsSplit: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 32,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statColumn: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        color: '#ffffff',
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
        marginVertical: 4,
    },
    statTitle: {
        color: '#64748b',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },
    sensorStack: {
        marginBottom: 24,
    },
    sensorRow: {
        marginBottom: 16,
    },
    sensorLabel: {
        color: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Poppins_500Medium',
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    cardCtaButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    cardCtaText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontFamily: 'Poppins_600SemiBold',
    },
    bottomFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        paddingTop: 32,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    footerItem: {
        marginRight: 32,
    },
    footerNumber: {
        color: '#ffffff',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
        marginBottom: 4,
    },
    footerLabel: {
        color: '#64748b',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
    },
    // Custom Modal Styles
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: '#0A4174',
        width: '90%',
        maxWidth: 480,
        borderRadius: 16,
        padding: 32,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(123, 189, 232, 0.15)',
    },
    modalCloseBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        padding: 4,
    },
    modalHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(123, 189, 232, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    modalHeaderTextBox: {
        marginLeft: 16,
    },
    modalTitleText: {
        color: '#ffffff',
        fontSize: 20,
        fontFamily: 'Poppins_700Bold',
    },
    modalSubText: {
        color: '#7BBDE8',
        fontSize: 13,
        fontFamily: 'Poppins_400Regular',
    },
    roleToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#001D39',
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
    },
    roleToggleBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    roleToggleBtnActive: {
        backgroundColor: '#49769F',
    },
    roleToggleText: {
        color: '#49769F',
        fontSize: 13,
        fontFamily: 'Poppins_600SemiBold',
    },
    roleToggleTextActive: {
        color: '#ffffff',
    },
    inputLabel: {
        color: '#7BBDE8',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#001D39',
        borderRadius: 8,
        paddingHorizontal: 16,
        height: 48,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(123, 189, 232, 0.05)',
    },
    textInputStyle: {
        flex: 1,
        color: '#ffffff',
        marginLeft: 12,
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        outlineWidth: 0,
    },
    submitBtn: {
        backgroundColor: '#6EA2B3',
        borderRadius: 8,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 8,
        shadowColor: '#6EA2B3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Poppins_700Bold',
    },
    demoBox: {
        backgroundColor: '#001D39',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    demoBoxTitle: {
        color: '#49769F',
        fontSize: 11,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1,
        marginBottom: 8,
    },
    demoBoxText: {
        color: '#7BBDE8',
        fontSize: 12,
        fontFamily: 'Poppins_400Regular',
        marginBottom: 4,
    },
    // New Single-Page Section Styles
    contentSection: {
        width: '100%',
        maxWidth: 1200,
        alignSelf: 'center',
    },
    sectionLabel: {
        color: '#7BBDE8',
        fontSize: 12,
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 2,
    },
    cardContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 24,
    },
    infoCard: {
        backgroundColor: 'rgba(10, 25, 47, 0.6)',
        borderRadius: 16,
        padding: 32,
        maxWidth: 320,
        width: '100%',
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 300,
        borderWidth: 1,
        borderColor: 'rgba(123, 189, 232, 0.1)',
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(123, 189, 232, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 22,
        fontFamily: 'Poppins_600SemiBold',
        color: '#ffffff',
        marginBottom: 16,
    },
    cardText: {
        fontSize: 14,
        color: '#94a3b8',
        fontFamily: 'Poppins_400Regular',
        lineHeight: 24,
        marginBottom: 16,
    },
    cardBullet: {
        fontSize: 13,
        color: '#BDD8E9',
        fontFamily: 'Poppins_400Regular',
        lineHeight: 22,
        marginBottom: 8,
    },
    contactMethodLabel: {
        fontSize: 11,
        color: '#7BBDE8',
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    contactMethodBox: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(123, 189, 232, 0.1)',
    },
    contactMethodText: {
        color: '#ffffff',
        fontSize: 15,
        fontFamily: 'Poppins_600SemiBold',
    },
    // Footer Styles
    footerContainer: {
        marginTop: 100,
        paddingTop: 80,
        paddingBottom: 64,
        width: '100%',
        backgroundColor: '#001122', // Darker Navy for distinction
        borderTopWidth: 1,
        borderColor: 'rgba(123, 189, 232, 0.05)',
        alignItems: 'center',
    },
    footerDivider: {
        display: 'none', // Removed in favor of background distinction
    },
    footerContent: {
        justifyContent: 'space-between',
        gap: 32,
        maxWidth: 1200,
        alignSelf: 'center',
        width: '100%',
    },
    footerBrand: {
        maxWidth: 350,
    },
    footerLogo: {
        width: 48,
        height: 48,
        borderRadius: 8,
        marginRight: 12,
    },
    footerBrandText: {
        fontSize: 24,
        fontFamily: 'Poppins_700Bold',
        color: '#ffffff',
    },
    footerTagline: {
        fontSize: 13,
        color: '#94a3b8',
        fontFamily: 'Poppins_400Regular',
        lineHeight: 20,
    },
    footerLinks: {
        flexDirection: 'row',
        gap: 24,
    },
    footerLinkText: {
        fontSize: 14,
        color: '#BDD8E9',
        fontFamily: 'Poppins_500Medium',
    },
    footerCredits: {
    },
    footerCreditsText: {
        fontSize: 13,
        color: '#ffffff',
        fontFamily: 'Poppins_600SemiBold',
        marginBottom: 4,
    },
    footerCreditsSub: {
        fontSize: 11,
        color: '#49769F',
        fontFamily: 'Poppins_700Bold',
        letterSpacing: 1,
        textTransform: 'uppercase',
    }
});

export default LandingPage;
