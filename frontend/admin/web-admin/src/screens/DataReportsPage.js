import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { styles } from "../styles/globalStyles";
import AdminSidebar from "../components/AdminSidebar";
import RealTimeClock from "../components/RealTimeClock";
import { API_BASE_URL } from "../config/api";
import { formatPST, getSystemStatus, getSystemStatusColor } from "../utils/dateUtils";
import { authFetch } from "../utils/helpers";
import useDataSync from "../utils/useDataSync";
import TopRightStatusIndicator from "../components/TopRightStatusIndicator";

const DataReportsPage = ({ onNavigate, onLogout, userRole = "lgu" }) => {
    const isSuperAdmin = userRole === "superadmin";

    // ── State ───────────────────────────────────────────────────
    const [reportType, setReportType] = useState("daily");
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [exportFormat, setExportFormat] = useState("pdf");
    const [selectedSensor, setSelectedSensor] = useState({ id: "All Sensors", name: "All Sensors" });
    const [isGenerating, setIsGenerating] = useState(false);
    const [showSensorDropdown, setShowSensorDropdown] = useState(false);

    const [analytics, setAnalytics] = useState([]);
    const [floodHistory, setFloodHistory] = useState([]);
    const [communityReports, setCommunityReports] = useState([]);
    const [sensorsList, setSensorsList] = useState([{ id: "All Sensors", name: "All Sensors" }]);
    const [isLoading, setIsLoading] = useState(true);
    const [onlineSensors, setOnlineSensors] = useState(0);
    const [hoveredTab, setHoveredTab] = useState(null);
    const [hoveredItem, setHoveredItem] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    // ── Navigation & Filtering State ──────────────────────────
    const [activeCategory, setActiveCategory] = useState("flood"); // "flood" or "reports"
    const [statusFilter, setStatusFilter] = useState("All Status");
    const [searchQuery, setSearchQuery] = useState("");
    const [showStatusFilter, setShowStatusFilter] = useState(false);

    // ── Thresholds & Classification ──────────────────────────
    const [thresholds, setThresholds] = useState({ advisory: 15, warning: 30, critical: 50 });
    const thresholdsRef = useRef(thresholds);

    const calculateStatus = (level, activeThresholds = null) => {
        const thresh = activeThresholds || thresholdsRef.current;
        let val = 0;
        if (typeof level === 'string') {
            // Strip "cm" and any non-numeric chars except decimal
            val = parseFloat(level.replace(/[^\d.]/g, '')) || 0;
        } else {
            val = parseFloat(level) || 0;
        }
        
        if (val >= thresh.critical) return "Critical";
        if (val >= thresh.warning) return "Warning";
        if (val >= thresh.advisory) return "Advisory";
        return "Normal";
    };

    // Effect to recalculate all visible historical data when thresholds change
    useEffect(() => {
        thresholdsRef.current = thresholds;
        if (floodHistory.length > 0) {
            setFloodHistory(prev => prev.map(row => ({
                ...row,
                status: calculateStatus(row.level)
            })));
        }
    }, [thresholds.advisory, thresholds.warning, thresholds.critical]);

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [summaryRes, historyRes, sensorsRes, reportsRes, configRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/api/reports/summary`),
                authFetch(`${API_BASE_URL}/api/reports/history?sensor_id=${selectedSensor.id}`),
                authFetch(`${API_BASE_URL}/api/iot/sensors/status-all`),
                authFetch(`${API_BASE_URL}/api/reports/`),
                authFetch(`${API_BASE_URL}/api/config/thresholds`)
            ]);
            
            let activeThresh = thresholds;
            if (configRes.ok) {
                const config = await configRes.json();
                activeThresh = {
                    advisory: config.advisory_level,
                    warning: config.warning_level,
                    critical: config.critical_level
                };
                thresholdsRef.current = activeThresh;
                setThresholds(activeThresh);
            }

            const summary = await summaryRes.json();
            const history = await historyRes.json();
            const sensorsData = await sensorsRes.json();
            const reportsData = await reportsRes.json();

            setAnalytics([
                { label: "Collected Data", value: summary.total_readings ?? 0, icon: "database", color: "#3b82f6", bg: "#eff6ff" },
                { label: "Peak Flood (cm)", value: summary.peak_flood_level ?? 0, icon: "trending-up", color: "#ef4444", bg: "#fef2f2" },
                { label: "Reports", value: reportsData.length ?? 0, icon: "file-text", color: "#06b6d4", bg: "#ecfeff" },
                { label: "Active Sensors", value: summary.active_sensors ?? 0, icon: "cpu", color: "#10b981", bg: "#ecfdf5" },
            ]);
            setCommunityReports(reportsData);
            if (Array.isArray(sensorsData)) {
                const dynamicSensors = sensorsData.map(s => ({
                    id: s.id,
                    name: s.name || s.id,
                    barangay: s.barangay || s.location || "",
                    status: s.status,
                    is_live: s.is_live,
                    is_offline: !s.is_live,
                    last_seen: s.last_seen || null
                }));
                setSensorsList([{ id: "All Sensors", name: "All Sensors", barangay: "" }, ...dynamicSensors]);

                // Clean up history locations - replace "General Area" with actual sensor barangay
                const mappedHistory = history.map(h => {
                    const sensor = dynamicSensors.find(s => s.id === h.sensor_id || s.name === h.sensor);
                    const actualLoc = sensor?.barangay || h.location;
                    return {
                        ...h,
                        location: (actualLoc === "General Area") ? "" : actualLoc,
                        status: calculateStatus(h.flood_level || h.level, activeThresh)
                    };
                });
                setFloodHistory(mappedHistory);
            } else {
                setFloodHistory(history);
            }
        } catch (error) {
            console.error("Failed to fetch reports data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedSensor.id]);

    // ── Liveness Timeout for Analytics & Registry ──
    useEffect(() => {
        const timer = setInterval(() => {
            setSensorsList(prev => {
                const now = new Date();
                let changed = false;
                const updated = prev.map(s => {
                    if (s.id !== "All Sensors" && s.is_live && s.last_seen) {
                        if (now - new Date(s.last_seen) > 30000) {
                            changed = true;
                            return { ...s, is_live: false, is_offline: true };
                        }
                    }
                    return s;
                });
                
                if (changed) {
                    // Update the "Active Sensors" analytics card locally
                    // Match the global source of truth: Software ON AND Hardware LIVE
                    const onlineCount = updated.filter(s => s.id !== "All Sensors" && s.is_live && s.enabled !== false).length;
                    setAnalytics(a => a.map(item => 
                        item.label === "Active Sensors" ? { ...item, value: onlineCount } : item
                    ));
                }
                
                return changed ? updated : prev;
            });
        }, 500);
        return () => clearInterval(timer);
    }, []);

    // ── Real-time Data Synchronization ──
    useDataSync({
        onThresholdUpdate: (data) => {
            console.log("[DataReports] Thresholds updated, recalculating...");
            const newThresh = {
                advisory: data.advisory_level,
                warning: data.warning_level,
                critical: data.critical_level
            };
            thresholdsRef.current = newThresh;
            setThresholds(newThresh);
        },
        onSensorUpdate: (reading) => {
            // Only process if sensor is LIVE and ENABLED per requirement
            const isLive = reading.is_live ?? true;
            const isEnabled = reading.enabled ?? true;
            if (!isLive || !isEnabled) return;

            // 1. Update analytics counts
            setAnalytics(prev => prev.map(item => {
                if (item.label === "Collected Data") return { ...item, value: (parseInt(item.value) || 0) + 1 };
                if (item.label === "Peak Flood (cm)") {
                    const currentVal = parseFloat(item.value) || 0;
                    const newVal = parseFloat(reading.flood_level) || 0;
                    return { ...item, value: Math.max(currentVal, newVal) };
                }
                return item;
            }));

            // 2. Update sensor list liveness & enablement
            setSensorsList(prev => {
                const updated = prev.map(s => {
                    if (s.id === reading.sensor_id) {
                        return { 
                            ...s, 
                            is_live: isLive, 
                            is_offline: !isLive, 
                            enabled: isEnabled,
                            last_seen: isLive ? new Date().toISOString() : s.last_seen 
                        };
                    }
                    return s;
                });
                
                // Also update Active Sensors count immediately if list changed
                const activeCount = updated.filter(s => s.id !== "All Sensors" && s.is_live && s.enabled !== false).length;
                setAnalytics(a => a.map(item => 
                    item.label === "Active Sensors" ? { ...item, value: activeCount } : item
                ));
                
                return updated;
            });

            // 3. Prepend to history table if matches filter
            if (selectedSensor.id === "All Sensors" || selectedSensor.id === reading.sensor_id) {
                const sensorObj = sensorsList.find(s => s.id === reading.sensor_id) || { name: reading.sensor_id, barangay: "" };
                const formatted = formatPST(reading.timestamp || Date.now());
                const [datePart, timePart] = formatted.split(' • ');
                
                const newRow = {
                    id: Date.now(), // temporary ID
                    time: timePart,
                    date: datePart,
                    level: `${reading.flood_level} cm`,
                    sensor: sensorObj.name,
                    location: sensorObj.barangay || "",
                    status: calculateStatus(reading.flood_level)
                };
                setFloodHistory(prev => [newRow, ...prev].slice(0, 50));
            }
        },
        onReportUpdate: () => {
            console.log("[DataReports] Reports updated, refreshing list...");
            fetchData();
        },
        onSensorListUpdate: () => {
            console.log("[DataReports] Sensor list updated, refreshing...");
            fetchData();
        }
    });

    const handleDownloadPDF = (report) => {
        const isVerified = report.status?.toLowerCase() === "verified";
        const isPending = report.status?.toLowerCase() === "pending";
        const isDismissed = report.status?.toLowerCase() === "dismissed";
        const imageUrl = report.image_url ? (report.image_url.startsWith('http') ? report.image_url : `${API_BASE_URL}${report.image_url}`) : null;

        const timeOptions = {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        const formattedTime = formatPST(report.timestamp);
        const generationTime = formatPST(new Date());

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>FloodGuard Report - ${report.id}</title>
                <style>
                    @page { size: auto; margin: 0mm; }
                    body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1e293b; padding: 20mm; line-height: 1.6; }
                    .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                    .header-flex { display: flex; justify-content: space-between; align-items: center; }
                    .title { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
                    .status { padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                    .verified { background: #dcfce7; color: #16a34a; border: 1px solid #86efac; }
                    .pending { background: #fff7ed; color: #f59e0b; border: 1px solid #fdba74; }
                    .dismissed { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
                    .section { margin-top: 25px; }
                    .label { font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
                    .value { font-size: 15px; color: #0f172a; margin-bottom: 15px; font-weight: 500; }
                    .response-box { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 20px; }
                    .report-image { width: 100%; max-width: 500px; border-radius: 12px; margin-top: 20px; border: 1px solid #e2e8f0; }
                    .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8; text-align: center; }
                    .photo-page { page-break-before: always; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-flex">
                        <div>
                            <h1 class="title">FloodGuard Incident Report</h1>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Official Incident Record</p>
                        </div>
                        <div class="status ${report.status?.toLowerCase()}">${report.status?.toUpperCase()}</div>
                    </div>
                </div>

                <div class="section">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                        <div>
                            <p class="label">Reporter Name</p>
                            <p class="value">${report.reporter_name}</p>
                            
                            <p class="label">Incident Type</p>
                            <p class="value">${report.type}</p>
                        </div>
                        <div>
                            <p class="label">Incident Date & Time</p>
                            <p class="value">${formattedTime}</p>

                            <p class="label">Primary Location</p>
                            <p class="value">${report.location || "Not specified"}</p>
                        </div>
                    </div>

                    <div style="margin-top: 20px;">
                        <p class="label">Sensor Reading (Community)</p>
                        <p class="value">${report.flood_level_reported || "N/A"} cm</p>
                    </div>
                </div>

                <div class="response-box">
                    <p class="label">Admin / LGU Official Response</p>
                    <p class="value" style="margin-bottom: 0; font-weight: 400;">${report.recommendations || report.rejection_reason || "Verification in progress..."}</p>
                </div>

                ${isVerified ? `
                <div class="section" style="border-top: 2px solid #dcfce7; padding-top: 24px; margin-top: 40px; background: #f0fdf4; padding: 20px; border-radius: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                        <div>
                            <p class="label" style="color: #166534;">Verified Status</p>
                            <p class="value" style="color: #166534;">${report.incident_status || "Active"}</p>
                        </div>
                        <div>
                            <p class="label" style="color: #166534;">Official Verified Depth</p>
                            <p class="value" style="color: #166534;">${report.flood_level || "—"} cm</p>
                        </div>
                    </div>
                </div>` : ''}

                <div class="footer">
                    Reference ID: #${report.id} • Generated by FloodGuard System • ${generationTime}
                </div>

                ${imageUrl ? `
                <div class="photo-page" style="page-break-before: always; padding: 20mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; box-sizing: border-box;">
                    <h2 style="font-size: 22px; color: #0f172a; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; width: 100%; text-align: center;">Photo Included</h2>
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; max-height: 240mm;">
                        <img src="${imageUrl}" style="max-width: 180mm; max-height: 220mm; border-radius: 12px; border: 1px solid #e2e8f0; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: auto; height: auto;" />
                    </div>
                </div>` : ''}

                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                <script>
                    window.onload = () => {
                        const element = document.body;
                        const opt = {
                          margin:       0,
                          filename:     'FloodGuard_Report_${report.id}.pdf',
                          image:        { type: 'jpeg', quality: 0.98 },
                          html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
                          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        };
                        
                        html2pdf().set(opt).from(element).save().then(() => {
                            setTimeout(() => window.close(), 1000);
                        }).catch(err => {
                            console.error("PDF generation failed:", err);
                            window.print();
                        });
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownloadImage = (reportId, content) => {
        const timestamp = new Date().getTime();
        const fileName = `Report_Photo_${reportId}_${timestamp}.jpg`;
        const element = document.createElement('a');
        element.setAttribute('href', content);
        element.setAttribute('download', fileName);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Filtered Reports Logic
    const filteredReports = communityReports.filter(report => {
        const matchesStatus = statusFilter === "All Status" || report.status?.toLowerCase() === statusFilter.toLowerCase();
        const matchesSearch =
            report.reporter_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.location?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    return (
        <View style={styles.dashboardRoot}>
            <AdminSidebar variant={userRole} activePage="data-reports" onNavigate={onNavigate} onLogout={onLogout} />

            <View style={styles.dashboardMain}>
                {/* Top Bar */}
                <View style={styles.dashboardTopBar}>
                    <View>
                        <Text style={styles.dashboardTopTitle}>Data & Reports</Text>
                        <Text style={styles.dashboardTopSubtitle}>Archive, analysis, and historical flood records</Text>
                    </View>
                    <View style={styles.dashboardTopRight}>
                        <TopRightStatusIndicator />
                        <RealTimeClock style={styles.dashboardTopDate} />
                    </View>
                </View>

                <ScrollView
                    style={styles.dashboardScroll}
                    contentContainerStyle={[styles.dashboardScrollContent, { paddingHorizontal: 24, paddingTop: 16 }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Analytics Summary Row ─────────────────────────────────── */}
                    <View style={pg.analyticsRow}>
                        {analytics.map((item, idx) => (
                            <View key={idx} style={pg.analyticsCard}>
                                <View style={[pg.analyticsIcon, { backgroundColor: item.bg }]}>
                                    <Feather name={item.icon} size={22} color={item.color} />
                                </View>
                                <Text style={pg.analyticsValue}>{item.value}</Text>
                                <Text style={pg.analyticsLabel}>{item.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* ── Category Menu ────────────────────────────────────────────── */}
                    <View style={pg.tabBar}>
                        <TouchableOpacity
                            style={[
                                pg.tabItem,
                                activeCategory === "flood" && pg.tabItemActive,
                                (hoveredTab === "flood" && activeCategory !== "flood") && pg.tabItemHover
                            ]}
                            onMouseEnter={() => setHoveredTab("flood")}
                            onMouseLeave={() => setHoveredTab(null)}
                            onPress={() => setActiveCategory("flood")}
                        >
                            <Feather name="droplet" size={16} color={activeCategory === "flood" || hoveredTab === "flood" ? "#3b82f6" : "#64748b"} />
                            <Text style={[pg.tabText, (activeCategory === "flood" || hoveredTab === "flood") && pg.tabTextActive]}>Flood Data</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                pg.tabItem,
                                activeCategory === "reports" && pg.tabItemActive,
                                (hoveredTab === "reports" && activeCategory !== "reports") && pg.tabItemHover
                            ]}
                            onMouseEnter={() => setHoveredTab("reports")}
                            onMouseLeave={() => setHoveredTab(null)}
                            onPress={() => setActiveCategory("reports")}
                        >
                            <Feather name="file-text" size={16} color={activeCategory === "reports" || hoveredTab === "reports" ? "#3b82f6" : "#64748b"} />
                            <Text style={[pg.tabText, (activeCategory === "reports" || hoveredTab === "reports") && pg.tabTextActive]}>Reports Data</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── Section 1: Flood Data ─────────────────────────────────────── */}
                    {activeCategory === "flood" && (
                        <View style={{ marginBottom: 32 }}>
                            <View style={pg.sectionCard}>
                                <View style={pg.sectionHeader}>
                                    <View>
                                        <Text style={pg.sectionTitle}>Historical Flood Data</Text>
                                        <Text style={pg.sectionSubtitle}>Browse sensor readings and flood depth history</Text>
                                    </View>

                                    <View style={{ position: "relative", zIndex: 500 }}>
                                        <TouchableOpacity
                                            style={pg.filterSelect}
                                            onPress={() => {
                                                setShowSensorDropdown(!showSensorDropdown);
                                                setShowStatusFilter(false);
                                            }}
                                        >
                                            <Text style={pg.filterSelectText}>{selectedSensor.name}</Text>
                                            <Feather name={showSensorDropdown ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
                                        </TouchableOpacity>

                                        {showSensorDropdown && (
                                            <View style={pg.dropdown}>
                                                {sensorsList.map(s => (
                                                    <TouchableOpacity
                                                        key={s.id}
                                                        style={[pg.dropdownItem, hoveredItem === s.id && { backgroundColor: '#eff6ff' }]}
                                                        onMouseEnter={() => setHoveredItem(s.id)}
                                                        onMouseLeave={() => setHoveredItem(null)}
                                                        onPress={() => { setSelectedSensor(s); setShowSensorDropdown(false); }}
                                                    >
                                                        <Text style={[pg.dropdownItemText, (selectedSensor.id === s.id || hoveredItem === s.id) && { color: '#3b82f6', fontFamily: "Poppins_600SemiBold" }]}>{s.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={pg.tableWrapper}>
                                    <View style={[pg.tableHeader, { backgroundColor: "#f1f5f9" }]}>
                                        <Text style={[pg.tableHeadText, { flex: 1.5 }]}>TIME & DATE</Text>
                                        <Text style={[pg.tableHeadText, { flex: 1 }]}>SENSOR</Text>
                                        <Text style={[pg.tableHeadText, { flex: 1 }]}>LOCATION</Text>
                                        <Text style={[pg.tableHeadText, { flex: 0.8 }]}>LEVEL</Text>
                                        <Text style={[pg.tableHeadText, { flex: 0.8 }]}>STATUS</Text>
                                    </View>

                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="#3b82f6" style={{ margin: 32 }} />
                                    ) : floodHistory.length === 0 ? (
                                        <View style={{ padding: 32, alignItems: "center" }}>
                                            <Text style={{ color: "#94a3b8" }}>No flood data available</Text>
                                        </View>
                                    ) : floodHistory.map((row, idx) => {
                                         const rawStatus = (row.status || "").toUpperCase();
                                         const isCritical = rawStatus === "CRITICAL" || rawStatus === "ALARM";
                                         const isWarning = rawStatus === "WARNING";
                                         const isAdvisory = rawStatus === "ADVISORY";
                                         const displayStatus = isCritical ? "Critical" : (isWarning ? "Warning" : (isAdvisory ? "Advisory" : "Normal"));
                                        return (
                                            <View key={row.id} style={[pg.tableRow, idx === floodHistory.length - 1 && { borderBottomWidth: 0 }]}>
                                                <Text style={[pg.tableCellBold, { flex: 1.5 }]}>{row.time} • {row.date}</Text>
                                                <Text style={[pg.tableCell, { flex: 1 }]}>{row.sensor}</Text>
                                                <Text style={[pg.tableCell, { flex: 1 }]}>{row.location}</Text>
                                                <Text style={[pg.tableCellBold, { flex: 0.8, color: isCritical ? "#dc2626" : (isWarning ? "#f97316" : (isAdvisory ? "#3b82f6" : "#0f172a")) }]}>{row.level}</Text>
                                                <View style={{ flex: 0.8 }}>
                                                    <View style={[pg.statusBadge, { backgroundColor: isCritical ? "#fee2e2" : (isWarning ? "#fff7ed" : (isAdvisory ? "#eff6ff" : "#f1f5f9")) }]}>
                                                        <Text style={[pg.statusBadgeText, { color: isCritical ? "#dc2626" : (isWarning ? "#f97316" : (isAdvisory ? "#3b82f6" : "#64748b")) }]}>{displayStatus}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ── Section 2: Reports Data ────────────────────────────────────── */}
                    {activeCategory === "reports" && (
                        <View style={{ marginBottom: 32 }}>
                            {/* Filter Bar */}
                            <View style={pg.filterBar}>
                                <View style={pg.searchBox}>
                                    <Feather name="search" size={16} color="#94a3b8" />
                                    <TextInput
                                        style={pg.searchInput}
                                        placeholder="Search by reporter or location..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                </View>

                                <View style={{ position: "relative", zIndex: 500 }}>
                                    <TouchableOpacity style={pg.filterSelect} onPress={() => {
                                        setShowStatusFilter(!showStatusFilter);
                                        setShowSensorDropdown(false);
                                    }}>
                                        <Text style={pg.filterSelectText}>{statusFilter}</Text>
                                        <Feather name={showStatusFilter ? "chevron-up" : "chevron-down"} size={16} color="#475569" />
                                    </TouchableOpacity>

                                    {showStatusFilter && (
                                        <View style={pg.dropdown}>
                                            {["All Status", "Verified", "Pending", "Dismissed"].map(s => (
                                                <TouchableOpacity
                                                    key={s}
                                                    style={[pg.dropdownItem, hoveredItem === s && { backgroundColor: '#eff6ff' }]}
                                                    onMouseEnter={() => setHoveredItem(s)}
                                                    onMouseLeave={() => setHoveredItem(null)}
                                                    onPress={() => { setStatusFilter(s); setShowStatusFilter(false); }}
                                                >
                                                    <Text style={[pg.dropdownItemText, (statusFilter === s || hoveredItem === s) && { color: '#3b82f6', fontFamily: "Poppins_600SemiBold" }]}>{s}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={pg.reportGrid}>
                                {filteredReports.map(report => {
                                    const isVerified = report.status?.toLowerCase() === "verified";
                                    const isPending = report.status?.toLowerCase() === "pending";
                                    const isDismissed = report.status?.toLowerCase() === "dismissed";
                                    const statusColor = isVerified ? "#16a34a" : isPending ? "#f59e0b" : "#64748b";

                                    return (
                                        <View key={report.id} style={[pg.reportCard, { borderTopWidth: 4, borderTopColor: statusColor }]}>
                                            <View style={pg.reportCardHeader}>
                                                <View>
                                                    <Text style={pg.reportReporter}>{report.reporter_name}</Text>
                                                    <Text style={pg.reportTime}>{formatPST(report.timestamp)}</Text>
                                                </View>
                                                <View style={[pg.statusBadge, {
                                                    backgroundColor: isVerified ? "#dcfce7" : isPending ? "#fff7ed" : "#f1f5f9",
                                                    borderColor: isVerified ? "#86efac" : isPending ? "#fdba74" : "#cbd5e1"
                                                }]}>
                                                    <Text style={[pg.statusBadgeText, {
                                                        color: isVerified ? "#166534" : isPending ? "#9a3412" : "#64748b"
                                                    }]}>
                                                        {report.status?.toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Report Image Handling */}
                                            {report.image_url && (
                                                <TouchableOpacity
                                                    style={pg.reportImageContainer}
                                                    onPress={() => setSelectedImage(report.image_url.startsWith('http') ? report.image_url : `${API_BASE_URL}${report.image_url}`)}
                                                >
                                                    <img
                                                        src={report.image_url.startsWith('http') ? report.image_url : `${API_BASE_URL}${report.image_url}`}
                                                        style={{ width: "100%", borderRadius: 12, height: 180, objectFit: "cover" }}
                                                        alt="Incident"
                                                    />
                                                    <TouchableOpacity
                                                        style={pg.imgDownloadBtn}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadImage(report.id, report.image_url);
                                                        }}
                                                    >
                                                        <Feather name="download" size={14} color="#fff" />
                                                        <Text style={pg.imgDownloadText}>Download Photo</Text>
                                                    </TouchableOpacity>
                                                </TouchableOpacity>
                                            )}

                                            <View style={pg.reportContent}>
                                                <View style={pg.detailRow}>
                                                    <Text style={pg.detailLabel}>Incident Type:</Text>
                                                    <Text style={pg.detailValue}>{report.type}</Text>
                                                </View>
                                                <View style={pg.detailRow}>
                                                    <Text style={pg.detailLabel}>Reported Location:</Text>
                                                    <Text style={pg.detailValue}>{report.location}</Text>
                                                </View>
                                                <View style={pg.detailRow}>
                                                    <Text style={pg.detailLabel}>Sensor Reading:</Text>
                                                    <Text style={pg.detailValue}>{report.flood_level_reported || "N/A"} cm</Text>
                                                </View>

                                                <View style={pg.adminResponseBox}>
                                                    <Text style={pg.responseLabel}>Response Details:</Text>
                                                    <Text style={pg.responseText}>{report.recommendations || report.rejection_reason || "Verification in progress..."}</Text>
                                                </View>

                                                {isVerified && (
                                                    <View style={pg.verifiedDetails}>
                                                        <View style={pg.detailRow}>
                                                            <Text style={pg.detailLabel}>Verified Status:</Text>
                                                            <Text style={[pg.detailValue, { color: "#dc2626" }]}>{report.incident_status || "Verified Active"}</Text>
                                                        </View>
                                                        <View style={pg.detailRow}>
                                                            <Text style={pg.detailLabel}>Official Depth:</Text>
                                                            <Text style={pg.detailValue}>{report.flood_level || "—"} cm</Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={pg.reportFooter}>
                                                <View style={pg.downloadActions}>
                                                    <TouchableOpacity style={[pg.dlBtn, { backgroundColor: "#3b82f6", borderColor: "#2563eb" }]} onPress={() => handleDownloadPDF(report)}>
                                                        <Feather name="file-text" size={14} color="#fff" />
                                                        <Text style={[pg.dlBtnText, { color: "#fff" }]}>Download PDF Report</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                                {filteredReports.length === 0 && (
                                    <View style={{ width: "100%", padding: 48, alignItems: "center" }}>
                                        <Text style={{ color: "#94a3b8", fontFamily: "Poppins_400Regular" }}>No matching reports found</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Image Viewer Modal */}
            <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 20 }}>
                    <TouchableOpacity style={{ position: "absolute", top: 40, right: 30, zIndex: 100 }} onPress={() => setSelectedImage(null)}>
                        <Feather name="x" size={32} color="#fff" />
                    </TouchableOpacity>
                    <img
                        src={selectedImage}
                        style={{ maxWidth: "100%", maxHeight: "85%", borderRadius: 12, objectFit: "contain" }}
                        alt="Full View"
                    />
                </View>
            </Modal>
        </View>
    );
};

const pg = StyleSheet.create({
    analyticsRow: { flexDirection: "row", gap: 16, marginBottom: 24, flexWrap: "wrap" },
    analyticsCard: {
        flex: 1,
        minWidth: 180,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        flexDirection: "column",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4
    },
    analyticsIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    analyticsLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#64748b", textAlign: "center" },
    analyticsValue: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#0f172a", marginBottom: 4, textAlign: "center" },

    sectionLabelContainer: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 8 },
    categoryHeader: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "#0f172a" },

    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#fff", paddingHorizontal: 24, marginBottom: 24 },
    tabItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: "transparent", marginRight: 4, transition: "all 0.2s" },
    tabItemActive: { borderBottomColor: "#3b82f6" },
    tabItemHover: { backgroundColor: "#eff6ff", borderRadius: 8, borderBottomColor: "transparent" },
    tabText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: "#64748b" },
    tabTextActive: { color: "#3b82f6", fontFamily: "Poppins_600SemiBold" },

    filterBar: { flexDirection: "row", gap: 16, marginBottom: 20, alignItems: "center", zIndex: 100 },
    searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", paddingHorizontal: 16, height: 44, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
    searchInput: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular", color: "#0f172a", outlineStyle: "none" },

    filterSelect: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 44,
        minWidth: 160,
        justifyContent: "space-between",
        gap: 8
    },
    filterSelectText: {
        fontSize: 14,
        fontFamily: "Poppins_500Medium",
        color: "#475569",
    },

    reportImageContainer: { marginBottom: 16, position: "relative", cursor: "pointer" },
    imgDownloadBtn: { position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
    imgDownloadText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#fff" },

    sectionCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", zIndex: 100 },
    sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#0f172a" },
    sectionSubtitle: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#64748b", marginTop: 2 },

    explorerFilter: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
    explorerFilterText: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#0f172a" },

    tableWrapper: { padding: 8 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 4 },
    tableHeadText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#94a3b8", letterSpacing: 0.5 },
    tableRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
    tableCellBold: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#0f172a" },
    tableCell: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#475569" },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, alignSelf: "flex-start" },
    statusBadgeText: { fontSize: 11, fontFamily: "Poppins_700Bold" },

    reportGrid: { flexDirection: "column", gap: 16 },
    reportCard: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3
    },
    reportCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    reportReporter: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#0f172a" },
    reportTime: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748b" },
    reportContent: { gap: 8 },
    detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
    detailLabel: { fontSize: 13, fontFamily: "Poppins_500Medium", color: "#64748b", width: 150 },
    detailValue: { flex: 1, fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#0f172a" },
    adminResponseBox: { backgroundColor: "#f8fafc", padding: 12, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: "#f1f5f9" },
    responseLabel: { fontSize: 10, fontFamily: "Poppins_700Bold", color: "#94a3b8", marginBottom: 2, textTransform: "uppercase" },
    responseText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#334155", lineHeight: 18 },
    verifiedDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#dcfce7", gap: 4 },
    reportFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
    downloadActions: { flexDirection: "row", gap: 12 },
    dlBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
    dlBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#334155" },

    dropdown: {
        position: "absolute",
        top: 48,
        right: 0,
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        zIndex: 9999,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
        minWidth: 180,
        overflow: "hidden"
    },
    dropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
        flexDirection: "row",
        alignItems: "center"
    },
    dropdownItemText: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#0f172a" },
});

export default DataReportsPage;
