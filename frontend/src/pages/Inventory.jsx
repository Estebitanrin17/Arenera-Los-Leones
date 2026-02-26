    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import "./inventory.css";

    import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    PieChart,
    Pie,
    Cell,
    Legend,
    AreaChart,
    Area,
    } from "recharts";

    import {
    RefreshCw,
    FileDown,
    Search,
    SlidersHorizontal,
    ArrowUpDown,
    Timer,
    Sparkles,
    X,
    Package,
    ArrowDownToLine,
    ArrowUpFromLine,
    Settings2,
    AlertTriangle,
    } from "lucide-react";

    const TABS = ["Stock", "Movimiento", "Historial", "Kardex"];

    function isoToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
    }
    function isoMinusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
    }
    function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
    }
    function filenameFromDisposition(cd) {
    if (!cd) return null;
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
    const raw = m?.[1] || m?.[2];
    return raw ? decodeURIComponent(raw) : null;
    }
    async function downloadWithAuth(path, fallbackName = "reporte") {
    const res = await api.get(path, {
        responseType: "blob",
        validateStatus: (s) => s >= 200 && s < 500,
    });

    const ct = res.headers?.["content-type"] || "";
    if (res.status >= 400) {
        if (ct.includes("application/json")) {
        const txt = await res.data.text();
        const json = JSON.parse(txt);
        throw new Error(json?.message || "Error descargando archivo");
        }
        throw new Error("Error descargando archivo");
    }

    const cd = res.headers?.["content-disposition"];
    const filename = filenameFromDisposition(cd) || fallbackName;

    const blob = res.data;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    }

    export default function Inventory() {
    const [tab, setTab] = useState(() => localStorage.getItem("inv_tab") || "Stock");
    const [warehouseId, setWarehouseId] = useState(1);

    const [products, setProducts] = useState([]);
    const [stock, setStock] = useState([]);

    const [loadingStock, setLoadingStock] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingKardex, setLoadingKardex] = useState(false);
    const [savingMove, setSavingMove] = useState(false);

    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);

    // Controles UI
    const [lowThreshold, setLowThreshold] = useState(() => Number(localStorage.getItem("inv_low_th")) || 7);
    const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem("inv_auto") === "1");
    const [stockQuery, setStockQuery] = useState("");
    const [sort, setSort] = useState({ key: "quantity", dir: "desc" }); // id/name/quantity

    // Historial
    const [historyFrom, setHistoryFrom] = useState(isoToday());
    const [historyTo, setHistoryTo] = useState(isoToday());
    const [historyType, setHistoryType] = useState("");
    const [historyProductId, setHistoryProductId] = useState("");
    const [history, setHistory] = useState([]);

    // Kardex
    const [kProductId, setKProductId] = useState("");
    const [kFrom, setKFrom] = useState(isoToday());
    const [kTo, setKTo] = useState(isoToday());
    const [kardex, setKardex] = useState([]);

    // Movimiento (tab)
    const [mov, setMov] = useState({
        productId: "",
        type: "IN",
        quantity: "",
        note: "",
    });

    // Nivel 2: movimientos recientes para alertas (últimos 14 días)
    const [supportsMovements, setSupportsMovements] = useState(true);
    const [recentMoves, setRecentMoves] = useState([]);
    const [recentFrom] = useState(() => isoMinusDays(14));
    const [recentTo] = useState(() => isoToday());

    // Nivel 2: Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [modalPid, setModalPid] = useState(null);
    const [modalRange, setModalRange] = useState({ from: isoMinusDays(30), to: isoToday() });
    const [modalMove, setModalMove] = useState({ type: "IN", quantity: "", note: "" });

    useEffect(() => localStorage.setItem("inv_tab", tab), [tab]);
    useEffect(() => localStorage.setItem("inv_low_th", String(lowThreshold)), [lowThreshold]);
    useEffect(() => localStorage.setItem("inv_auto", autoRefresh ? "1" : "0"), [autoRefresh]);

    // Auto refresh stock cada 60s
    useEffect(() => {
        if (!autoRefresh) return;
        const t = setInterval(() => fetchStock(), 60_000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh, warehouseId]);

    const productMap = useMemo(() => {
        const m = new Map();
        for (const p of products) m.set(Number(p.id), p);
        return m;
    }, [products]);

    const stockByProductId = useMemo(() => {
        const m = new Map();
        for (const r of stock) m.set(Number(r.product_id), Number(r.quantity ?? 0));
        return m;
    }, [stock]);

    const selectedProduct = useMemo(() => {
        const id = Number(mov.productId);
        return productMap.get(id) || null;
    }, [mov.productId, productMap]);

    const selectedAvailable = useMemo(() => {
        const id = Number(mov.productId);
        return stockByProductId.get(id) ?? 0;
    }, [mov.productId, stockByProductId]);

    const filteredStock = useMemo(() => {
        const q = stockQuery.trim().toLowerCase();
        if (!q) return stock;

        return stock.filter((r) => {
        const name = String(r.name || "").toLowerCase();
        const unit = String(r.unit || "").toLowerCase();
        const gramaje = String(r.gramaje || "").toLowerCase();
        const pid = String(r.product_id || "");
        return name.includes(q) || unit.includes(q) || gramaje.includes(q) || pid.includes(q);
        });
    }, [stock, stockQuery]);

    const sortedStock = useMemo(() => {
        const rows = [...filteredStock];
        const dir = sort.dir === "asc" ? 1 : -1;

        rows.sort((a, b) => {
        if (sort.key === "id") return (Number(a.product_id) - Number(b.product_id)) * dir;
        if (sort.key === "name") return String(a.name || "").localeCompare(String(b.name || "")) * dir;
        return (Number(a.quantity ?? 0) - Number(b.quantity ?? 0)) * dir;
        });

        return rows;
    }, [filteredStock, sort]);

    const metrics = useMemo(() => {
        const skuCount = stock.length;
        const totalUnits = stock.reduce((acc, r) => acc + Number(r.quantity ?? 0), 0);
        const lowCount = stock.filter((r) => Number(r.quantity ?? 0) <= lowThreshold).length;
        const okCount = Math.max(0, skuCount - lowCount);
        const health = skuCount ? Math.round((okCount / skuCount) * 100) : 0;
        return { skuCount, totalUnits, lowCount, okCount, health };
    }, [stock, lowThreshold]);

    // Insights / charts
    const lowStockItems = useMemo(() => {
        return [...stock]
        .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
        .slice(0, 7)
        .map((r) => ({
            product_id: r.product_id,
            name: r.name,
            unit: r.unit,
            gramaje: r.gramaje,
            quantity: Number(r.quantity ?? 0),
        }));
    }, [stock]);

    const topStockData = useMemo(() => {
        return [...stock]
        .sort((a, b) => Number(b.quantity ?? 0) - Number(a.quantity ?? 0))
        .slice(0, 10)
        .map((r) => ({
            label: String(r.name || "").length > 14 ? String(r.name).slice(0, 14) + "…" : String(r.name || ""),
            qty: Number(r.quantity ?? 0),
        }));
    }, [stock]);

    const pieData = useMemo(() => {
        return [
        { name: `Bajo (≤ ${lowThreshold})`, value: metrics.lowCount },
        { name: `OK (> ${lowThreshold})`, value: metrics.okCount },
        ];
    }, [metrics.lowCount, metrics.okCount, lowThreshold]);

    const distribution = useMemo(() => {
        const bins = [
        { bin: "0", v: 0 },
        { bin: "1-5", v: 0 },
        { bin: "6-10", v: 0 },
        { bin: "11-25", v: 0 },
        { bin: "26-50", v: 0 },
        { bin: "51+", v: 0 },
        ];
        for (const r of stock) {
        const q = Number(r.quantity ?? 0);
        if (q === 0) bins[0].v++;
        else if (q <= 5) bins[1].v++;
        else if (q <= 10) bins[2].v++;
        else if (q <= 25) bins[3].v++;
        else if (q <= 50) bins[4].v++;
        else bins[5].v++;
        }
        return bins;
    }, [stock]);

    // Alertas inteligentes: promedio OUT/día últimos 14 días
    const riskList = useMemo(() => {
        if (!supportsMovements || !recentMoves?.length) return [];

        const sumOut = new Map();
        for (const m of recentMoves) {
        const type = String(m.type || "").toUpperCase();
        if (type !== "OUT") continue;

        const pid = Number(m.product_id ?? m.productId);
        const qty = Number(m.quantity ?? 0);
        if (!pid || !Number.isFinite(qty)) continue;

        sumOut.set(pid, (sumOut.get(pid) || 0) + qty);
        }

        const days = 14;
        const risks = [];
        for (const [pid, outTotal] of sumOut.entries()) {
        const stockNow = Number(stockByProductId.get(pid) ?? 0);
        const avgPerDay = outTotal / days;
        if (avgPerDay <= 0) continue;
        const daysLeft = stockNow / avgPerDay;

        risks.push({
            productId: pid,
            name: productMap.get(pid)?.name || `#${pid}`,
            stockNow,
            avgPerDay: Number(avgPerDay.toFixed(2)),
            daysLeft: Number(daysLeft.toFixed(1)),
        });
        }

        return risks.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 6);
    }, [supportsMovements, recentMoves, stockByProductId, productMap]);

    const clearAlerts = () => {
        setMsg("");
        setError("");
    };

    const fetchProducts = async () => {
        const pRes = await api.get("/products?all=1");
        setProducts(pRes.data.data || []);
    };

    const fetchStock = async () => {
        setLoadingStock(true);
        try {
        const sRes = await api.get(`/inventory/stock?warehouseId=${warehouseId}`);
        setStock(sRes.data.data || []);
        setLastRefresh(new Date());
        } finally {
        setLoadingStock(false);
        }
    };

    const fetchRecent = async () => {
        try {
        const qs = new URLSearchParams({
            warehouseId: String(warehouseId),
            from: recentFrom,
            to: recentTo,
        });
        const res = await api.get(`/inventory/movements?${qs.toString()}`);
        setRecentMoves(res.data.data || []);
        setSupportsMovements(true);
        } catch {
        setSupportsMovements(false);
        setRecentMoves([]);
        }
    };

    const fetchAll = async () => {
        setLoadingStock(true);
        clearAlerts();
        try {
        await Promise.all([fetchProducts(), fetchStock()]);
        await fetchRecent();
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando inventario");
        } finally {
        setLoadingStock(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warehouseId]);

    const onMovChange = (k) => (e) => setMov((m) => ({ ...m, [k]: e.target.value }));

    const quickMove = (type, productId) => {
        clearAlerts();
        setTab("Movimiento");
        setMov((m) => ({
        ...m,
        type,
        productId: String(productId),
        quantity: "",
        note: "",
        }));
    };

    const validateMovement = ({ productId, type, qty }) => {
        if (!productId) throw new Error("Selecciona un producto");
        if (!Number.isFinite(qty) || qty === 0) {
        throw new Error(type === "ADJUST" ? "Cantidad inválida (usa + o - y no 0)" : "Cantidad inválida");
        }
        if (type !== "ADJUST" && qty < 0) throw new Error("La cantidad debe ser positiva");

        if (type === "OUT") {
        const available = Number(stockByProductId.get(productId) ?? 0);
        if (qty > available) throw new Error(`Stock insuficiente. Disponible: ${available} (quieres sacar: ${qty})`);
        }
    };

    const submitMovement = async (e) => {
        e.preventDefault();
        clearAlerts();
        try {
        const productId = Number(mov.productId);
        const qty = Number(mov.quantity);
        validateMovement({ productId, type: mov.type, qty });

        setSavingMove(true);
        await api.post("/inventory/movements", {
            warehouseId: Number(warehouseId),
            productId,
            type: mov.type,
            quantity: qty,
            note: mov.note?.trim() || undefined,
        });

        setMsg("Movimiento registrado ✅");
        setMov({ productId: "", type: "IN", quantity: "", note: "" });

        await fetchStock();
        await fetchRecent();
        setTab("Stock");
        } catch (e2) {
        setError(e2?.response?.data?.message || e2?.message || "Error registrando movimiento");
        } finally {
        setSavingMove(false);
        }
    };

    const exportInventoryExcel = async () => {
        clearAlerts();
        try {
        await downloadWithAuth(`/reports/inventory.xlsx?warehouseId=${warehouseId}`, `inventario_bodega_${warehouseId}.xlsx`);
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };
    const exportInventoryPdf = async () => {
        clearAlerts();
        try {
        await downloadWithAuth(`/reports/inventory.pdf?warehouseId=${warehouseId}`, `inventario_bodega_${warehouseId}.pdf`);
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const exportKardexExcel = async () => {
        clearAlerts();
        if (!kProductId) return setError("Selecciona un producto para exportar kardex");
        try {
        await downloadWithAuth(
            `/reports/kardex.xlsx?warehouseId=${warehouseId}&productId=${kProductId}&from=${kFrom}&to=${kTo}`,
            `kardex_${kProductId}_${kFrom}_${kTo}.xlsx`
        );
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const exportKardexPdf = async () => {
        clearAlerts();
        if (!kProductId) return setError("Selecciona un producto para exportar kardex");
        try {
        await downloadWithAuth(
            `/reports/kardex.pdf?warehouseId=${warehouseId}&productId=${kProductId}&from=${kFrom}&to=${kTo}`,
            `kardex_${kProductId}_${kFrom}_${kTo}.pdf`
        );
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const fetchHistory = async () => {
        clearAlerts();
        setLoadingHistory(true);
        try {
        const qs = new URLSearchParams({
            warehouseId: String(warehouseId),
            from: historyFrom,
            to: historyTo,
        });
        if (historyType) qs.set("type", historyType);
        if (historyProductId) qs.set("productId", historyProductId);

        const res = await api.get(`/inventory/movements?${qs.toString()}`);
        setHistory(res.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "No se pudo cargar historial");
        } finally {
        setLoadingHistory(false);
        }
    };

    const fetchKardex = async () => {
        clearAlerts();
        if (!kProductId) return setError("Selecciona un producto para ver kardex");
        setLoadingKardex(true);
        try {
        const res = await api.get(`/inventory/kardex?warehouseId=${warehouseId}&productId=${kProductId}&from=${kFrom}&to=${kTo}`);
        setKardex(res.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "No se pudo cargar kardex");
        } finally {
        setLoadingKardex(false);
        }
    };

    const toggleSort = (key) => {
        setSort((s) => {
        if (s.key !== key) return { key, dir: "asc" };
        return { key, dir: s.dir === "asc" ? "desc" : "asc" };
        });
    };

    // Modal helpers
    const modalProduct = useMemo(() => {
        if (!modalPid) return null;
        return productMap.get(Number(modalPid)) || null;
    }, [modalPid, productMap]);

    const modalStock = useMemo(() => {
        if (!modalPid) return 0;
        return Number(stockByProductId.get(Number(modalPid)) ?? 0);
    }, [modalPid, stockByProductId]);

    const modalRecentForProduct = useMemo(() => {
        if (!modalPid || !recentMoves?.length) return [];
        const pid = Number(modalPid);
        return recentMoves.filter((m) => Number(m.product_id ?? m.productId) === pid).slice(0, 12);
    }, [modalPid, recentMoves]);

    const modalOutDaily = useMemo(() => {
        if (!modalPid || !recentMoves?.length) return [];
        const pid = Number(modalPid);
        const map = new Map();

        for (const m of recentMoves) {
        const mpid = Number(m.product_id ?? m.productId);
        if (mpid !== pid) continue;

        const type = String(m.type || "").toUpperCase();
        if (type !== "OUT") continue;

        const created = String(m.created_at || m.createdAt || "");
        const day = created ? created.slice(0, 10) : "—";
        const qty = Number(m.quantity ?? 0);
        map.set(day, (map.get(day) || 0) + qty);
        }

        return Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, out]) => ({ day, out }));
    }, [modalPid, recentMoves]);

    const openModal = (pid) => {
        setModalPid(Number(pid));
        setModalOpen(true);
        setModalMove({ type: "IN", quantity: "", note: "" });
        setModalRange({ from: isoMinusDays(30), to: isoToday() });
    };

    const closeModal = () => {
        setModalOpen(false);
        setModalPid(null);
    };

    const submitModalMovement = async () => {
        clearAlerts();
        if (!modalPid) return;

        try {
        const productId = Number(modalPid);
        const qty = Number(modalMove.quantity);
        validateMovement({ productId, type: modalMove.type, qty });

        setSavingMove(true);
        await api.post("/inventory/movements", {
            warehouseId: Number(warehouseId),
            productId,
            type: modalMove.type,
            quantity: qty,
            note: modalMove.note?.trim() || undefined,
        });

        setMsg("Movimiento registrado ✅");
        setModalMove({ type: "IN", quantity: "", note: "" });

        await fetchStock();
        await fetchRecent();
        } catch (e) {
        setError(e?.response?.data?.message || e?.message || "Error registrando movimiento");
        } finally {
        setSavingMove(false);
        }
    };

    const exportModalKardex = async (kind) => {
        clearAlerts();
        if (!modalPid) return;

        const from = modalRange.from;
        const to = modalRange.to;

        try {
        if (kind === "xlsx") {
            await downloadWithAuth(
            `/reports/kardex.xlsx?warehouseId=${warehouseId}&productId=${modalPid}&from=${from}&to=${to}`,
            `kardex_${modalPid}_${from}_${to}.xlsx`
            );
        } else {
            await downloadWithAuth(
            `/reports/kardex.pdf?warehouseId=${warehouseId}&productId=${modalPid}&from=${from}&to=${to}`,
            `kardex_${modalPid}_${from}_${to}.pdf`
            );
        }
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const PIE_COLORS = ["rgba(245,158,11,.85)", "rgba(34,197,94,.75)"];

    return (
        <div className="inv-page">
        <div className="inv-header">
            <div>
            <div className="inv-title">
                Inventario{" "}
                <span className="inv-magic">
                <Sparkles size={16} /> insights
                </span>
            </div>
            <div className="inv-subtitle">
                Bodega <span className="inv-badge">#{warehouseId}</span>
                {lastRefresh && (
                <span className="inv-last">
                    <Timer size={14} /> {formatDate(lastRefresh.toISOString())}
                </span>
                )}
            </div>
            </div>

            <div className="inv-actions">
            <div className="inv-field">
                <label>Bodega ID</label>
                <input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="inv-input" style={{ width: 120 }} />
            </div>

            <label className="inv-toggle">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                <span>Auto</span>
            </label>

            <button className="inv-btn inv-btn-ghost" onClick={fetchAll} title="Recargar">
                <RefreshCw size={16} /> Recargar
            </button>

            <button className="inv-btn" onClick={exportInventoryExcel}>
                <FileDown size={16} /> Excel
            </button>

            <button className="inv-btn inv-btn-ghost" onClick={exportInventoryPdf}>
                <FileDown size={16} /> PDF
            </button>
            </div>
        </div>

        {(error || msg) && (
            <div className={`inv-alert ${error ? "inv-alert--error" : "inv-alert--ok"}`}>
            <div className="inv-alert__text">{error || msg}</div>
            <button className="inv-alert__close" onClick={clearAlerts}>✕</button>
            </div>
        )}

        <div className="inv-metrics">
            <div className="inv-card inv-metric">
            <div className="inv-metric__label">SKUs</div>
            <div className="inv-metric__value">{metrics.skuCount}</div>
            </div>
            <div className="inv-card inv-metric">
            <div className="inv-metric__label">Unidades totales</div>
            <div className="inv-metric__value">{metrics.totalUnits}</div>
            </div>
            <div className="inv-card inv-metric">
            <div className="inv-metric__label">Bajo stock (≤ {lowThreshold})</div>
            <div className="inv-metric__value">{metrics.lowCount}</div>
            </div>

            <div className="inv-card inv-metric inv-metric--wide">
            <div className="inv-metric__label">Salud de inventario</div>
            <div className="inv-health">
                <div className="inv-health__row">
                <b>{metrics.health}%</b> OK
                <span className="muted">
                    ({metrics.okCount} OK · {metrics.lowCount} bajos)
                </span>
                </div>
                <div className="inv-progress">
                <div className="inv-progress__bar" style={{ width: `${metrics.health}%` }} />
                </div>
            </div>
            </div>
        </div>

        <div className="inv-tabs">
            {TABS.map((t) => (
            <button key={t} className={`inv-tab ${tab === t ? "inv-tab--active" : ""}`} onClick={() => setTab(t)}>
                {t}
            </button>
            ))}
        </div>

        {/* STOCK (layout corregido sin hueco) */}
        {tab === "Stock" && (
            <div className="inv-stock-layout">
            {/* MAIN */}
            <div className="inv-stock-main">
                <div className="inv-card">
                <div className="inv-card__head">
                    <div className="inv-card__title">Stock actual</div>

                    <div className="inv-toolbar">
                    <div className="inv-search">
                        <Search size={16} />
                        <input
                        className="inv-input inv-input--tight"
                        value={stockQuery}
                        onChange={(e) => setStockQuery(e.target.value)}
                        placeholder="Buscar (nombre, id, unidad, gramaje)..."
                        />
                    </div>

                    <div className="inv-threshold">
                        <SlidersHorizontal size={16} />
                        <span className="muted">Umbral</span>
                        <input type="range" min="1" max="50" value={lowThreshold} onChange={(e) => setLowThreshold(Number(e.target.value))} />
                        <b>{lowThreshold}</b>
                    </div>
                    </div>
                </div>

                {loadingStock ? (
                    <div className="inv-skeleton inv-skeleton--shimmer">Cargando stock...</div>
                ) : (
                    <div className="inv-table-wrap inv-table-wrap--sticky">
                    <table className="inv-table">
                        <thead>
                        <tr>
                            <th className="click" onClick={() => toggleSort("id")}>
                            ID <ArrowUpDown size={14} />
                            </th>
                            <th className="click" onClick={() => toggleSort("name")}>
                            Producto <ArrowUpDown size={14} />
                            </th>
                            <th>Gramaje</th>
                            <th>Unidad</th>
                            <th className="right click" onClick={() => toggleSort("quantity")}>
                            Cantidad <ArrowUpDown size={14} />
                            </th>
                            <th className="right">Acciones</th>
                        </tr>
                        </thead>

                        <tbody>
                        {sortedStock.map((r) => {
                            const qty = Number(r.quantity ?? 0);
                            const isLow = qty <= lowThreshold;
                            return (
                            <tr
                                key={r.product_id}
                                className={isLow ? "low" : ""}
                                onClick={() => openModal(r.product_id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                if (e.key === "Enter") openModal(r.product_id);
                                }}
                            >
                                <td className="mono">{r.product_id}</td>
                                <td className="inv-td-name">
                                <span className="inv-td-icon"><Package size={16} /></span>
                                {r.name}
                                </td>
                                <td>{r.gramaje}</td>
                                <td>{r.unit}</td>
                                <td className="right">
                                <span className={`inv-pill ${isLow ? "inv-pill--warn" : ""}`}>{qty}</span>
                                </td>
                                <td className="right" onClick={(e) => e.stopPropagation()}>
                                <div className="inv-row-actions">
                                    <button className="inv-btn inv-btn-mini" onClick={() => quickMove("IN", r.product_id)}>IN</button>
                                    <button className="inv-btn inv-btn-mini inv-btn-ghost" onClick={() => quickMove("OUT", r.product_id)}>OUT</button>
                                    <button className="inv-btn inv-btn-mini inv-btn-ghost" onClick={() => quickMove("ADJUST", r.product_id)}>ADJ</button>
                                </div>
                                </td>
                            </tr>
                            );
                        })}

                        {!sortedStock.length && (
                            <tr>
                            <td colSpan={6} className="inv-empty-cell muted">
                                No hay stock para esta bodega.
                            </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                    </div>
                )}

                <div className="help">Tip: click en una fila para abrir el <b>modal</b> con detalle y acciones.</div>
                </div>
            </div>

            {/* SIDE (solo insights compactos) */}
            <div className="inv-stock-side">
                <div className="inv-card">
                <div className="inv-card__head">
                    <div className="inv-card__title">Alertas inteligentes</div>
                    <div className="inv-chip">{supportsMovements ? "Últimos 14 días" : "Sin endpoint"}</div>
                </div>

                {!supportsMovements ? (
                    <div className="inv-empty">
                    No se pudo leer <b>/inventory/movements</b>. Las alertas se activan cuando ese endpoint responda.
                    </div>
                ) : (
                    <div className="inv-mini-list">
                    {riskList.length === 0 ? (
                        <div className="inv-empty">Sin riesgos detectados (o no hay OUT en el rango).</div>
                    ) : (
                        riskList.map((it) => (
                        <div key={it.productId} className="inv-mini-row inv-mini-row--risk" onClick={() => openModal(it.productId)}>
                            <div className="inv-mini-left">
                            <div className="inv-mini-title">
                                <AlertTriangle size={16} /> {it.name}
                            </div>
                            <div className="inv-mini-sub muted">
                                stock: <b>{it.stockNow}</b> · avg OUT/día: <b>{it.avgPerDay}</b> · días: <b>{it.daysLeft}</b>
                            </div>
                            </div>
                            <span className={`inv-pill ${it.daysLeft <= 7 ? "inv-pill--danger" : "inv-pill--warn"}`}>
                            {it.daysLeft}d
                            </span>
                        </div>
                        ))
                    )}
                    </div>
                )}
                </div>

                <div className="inv-card">
                <div className="inv-card__head">
                    <div className="inv-card__title">Top bajo stock</div>
                    <div className="inv-chip">≤ {lowThreshold}</div>
                </div>

                <div className="inv-mini-list">
                    {lowStockItems.map((it) => (
                    <div key={it.product_id} className="inv-mini-row" onClick={() => openModal(it.product_id)}>
                        <div className="inv-mini-left">
                        <div className="inv-mini-title">
                            <span className="mono">#{it.product_id}</span> {it.name}
                        </div>
                        <div className="inv-mini-sub muted">
                            {it.gramaje} ({it.unit})
                        </div>
                        </div>
                        <span className={`inv-pill ${it.quantity <= lowThreshold ? "inv-pill--warn" : ""}`}>{it.quantity}</span>
                    </div>
                    ))}
                    {!lowStockItems.length && <div className="inv-empty">Sin datos</div>}
                </div>
                </div>
            </div>

            {/* CHARTS abajo a ancho completo */}
            <div className="inv-stock-charts">
                <div className="inv-card inv-chart-card">
                <div className="inv-card__head">
                    <div className="inv-card__title">Top 10 por cantidad</div>
                </div>
                <div className="inv-chart">
                    <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={topStockData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" interval={0} angle={-18} height={60} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="qty" fill="rgba(255,255,255,.28)" radius={[10, 10, 0, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>

                <div className="inv-card inv-chart-card">
                <div className="inv-card__head">
                    <div className="inv-card__title">Bajo vs OK</div>
                </div>
                <div className="inv-chart">
                    <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {pieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx]} />
                        ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                    </ResponsiveContainer>
                </div>
                </div>

                <div className="inv-card inv-chart-card">
                <div className="inv-card__head">
                    <div className="inv-card__title">Distribución de stock</div>
                </div>
                <div className="inv-chart">
                    <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={distribution} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="bin" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="v" stroke="rgba(255,255,255,.65)" fill="rgba(59,130,246,.18)" />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* MOVIMIENTO */}
        {tab === "Movimiento" && (
            <form onSubmit={submitMovement} className="inv-card">
            <div className="inv-card__head">
                <div className="inv-card__title">Registrar movimiento</div>
                <div className="inv-chip">Disponible: <b>{selectedAvailable}</b></div>
            </div>

            <div className="inv-grid">
                <div className="inv-field">
                <label>Producto</label>
                <select value={mov.productId} onChange={onMovChange("productId")} className="inv-input">
                    <option value="">-- Selecciona --</option>
                    {products.filter((p) => p.is_active === 1).map((p) => (
                    <option key={p.id} value={p.id}>
                        #{p.id} - {p.name} {p.gramaje} ({p.unit})
                    </option>
                    ))}
                </select>
                {selectedProduct && (
                    <div className="help">
                    Seleccionado: <b>{selectedProduct.name}</b> {selectedProduct.gramaje} ({selectedProduct.unit})
                    </div>
                )}
                </div>

                <div className="inv-field">
                <label>Tipo</label>
                <select value={mov.type} onChange={onMovChange("type")} className="inv-input">
                    <option value="IN">IN (Entrada)</option>
                    <option value="OUT">OUT (Salida)</option>
                    <option value="ADJUST">ADJUST (Ajuste)</option>
                </select>
                </div>

                <div className="inv-field">
                <label>Cantidad</label>
                <input
                    value={mov.quantity}
                    onChange={onMovChange("quantity")}
                    className="inv-input"
                    placeholder={mov.type === "ADJUST" ? "ej: -5 o 10" : "ej: 10"}
                    type="number"
                    step="1"
                />
                {mov.type === "OUT" && mov.productId && (
                    <div className="help">Máximo recomendado: <b>{selectedAvailable}</b></div>
                )}
                </div>

                <div className="inv-field inv-span-3">
                <label>Nota</label>
                <input value={mov.note} onChange={onMovChange("note")} className="inv-input" placeholder="ej: Producción / Venta / Ajuste" />
                </div>
            </div>

            <div className="inv-footer">
                <button className="inv-btn" type="submit" disabled={savingMove}>
                {savingMove ? "Guardando..." : "Guardar movimiento"}
                </button>

                <button
                type="button"
                className="inv-btn inv-btn-ghost"
                onClick={() => {
                    clearAlerts();
                    setMov({ productId: "", type: "IN", quantity: "", note: "" });
                }}
                >
                Limpiar
                </button>
            </div>
            </form>
        )}

        {/* HISTORIAL */}
        {tab === "Historial" && (
            <div className="inv-card">
            <div className="inv-card__head">
                <div className="inv-card__title">Historial de movimientos</div>
                <button className="inv-btn inv-btn-ghost" onClick={fetchHistory}>
                {loadingHistory ? "Cargando..." : "Cargar"}
                </button>
            </div>

            <div className="inv-filters">
                <div className="inv-field">
                <label>Desde</label>
                <input className="inv-input" type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                </div>
                <div className="inv-field">
                <label>Hasta</label>
                <input className="inv-input" type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                </div>
                <div className="inv-field">
                <label>Tipo</label>
                <select className="inv-input" value={historyType} onChange={(e) => setHistoryType(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                    <option value="ADJUST">ADJUST</option>
                </select>
                </div>
                <div className="inv-field">
                <label>Producto</label>
                <select className="inv-input" value={historyProductId} onChange={(e) => setHistoryProductId(e.target.value)}>
                    <option value="">Todos</option>
                    {products.filter((p) => p.is_active === 1).map((p) => (
                    <option key={p.id} value={p.id}>
                        #{p.id} - {p.name}
                    </option>
                    ))}
                </select>
                </div>
            </div>

            <div className="inv-table-wrap inv-table-wrap--sticky">
                <table className="inv-table">
                <thead>
                    <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Producto</th>
                    <th className="right">Cantidad</th>
                    <th>Nota</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map((m) => (
                    <tr key={m.id}>
                        <td className="mono">{formatDate(m.created_at || m.createdAt)}</td>
                        <td>
                        <span className={`inv-pill inv-pill--type ${String(m.type).toUpperCase()}`}>
                            {String(m.type).toUpperCase()}
                        </span>
                        </td>
                        <td>
                        <span className="mono">#{m.product_id || m.productId}</span>{" "}
                        {m.product_name || m.name || ""}
                        </td>
                        <td className="right mono">{m.quantity}</td>
                        <td className="muted">{m.note || "-"}</td>
                    </tr>
                    ))}
                    {!history.length && (
                    <tr>
                        <td colSpan={5} className="inv-empty-cell muted">
                        {loadingHistory ? "Cargando..." : "Sin movimientos en el rango."}
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>

            <div className="help">
                Si no tienes este endpoint aún: <b>GET /inventory/movements</b>, ajusta <code>fetchHistory()</code>.
            </div>
            </div>
        )}

        {/* KARDEX */}
        {tab === "Kardex" && (
            <div className="inv-card">
            <div className="inv-card__head">
                <div className="inv-card__title">Kardex</div>
                <div className="inv-row-actions">
                <button className="inv-btn inv-btn-ghost" onClick={fetchKardex}>
                    {loadingKardex ? "Cargando..." : "Ver Kardex"}
                </button>
                <button className="inv-btn" onClick={exportKardexExcel} disabled={!kProductId}>
                    Excel
                </button>
                <button className="inv-btn inv-btn-ghost" onClick={exportKardexPdf} disabled={!kProductId}>
                    PDF
                </button>
                </div>
            </div>

            <div className="inv-filters">
                <div className="inv-field" style={{ minWidth: 280 }}>
                <label>Producto</label>
                <select className="inv-input" value={kProductId} onChange={(e) => setKProductId(e.target.value)}>
                    <option value="">-- Selecciona --</option>
                    {products.filter((p) => p.is_active === 1).map((p) => (
                    <option key={p.id} value={p.id}>
                        #{p.id} - {p.name} {p.gramaje} ({p.unit})
                    </option>
                    ))}
                </select>
                </div>
                <div className="inv-field">
                <label>Desde</label>
                <input className="inv-input" type="date" value={kFrom} onChange={(e) => setKFrom(e.target.value)} />
                </div>
                <div className="inv-field">
                <label>Hasta</label>
                <input className="inv-input" type="date" value={kTo} onChange={(e) => setKTo(e.target.value)} />
                </div>
            </div>

            <div className="inv-table-wrap inv-table-wrap--sticky">
                <table className="inv-table">
                <thead>
                    <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Ref</th>
                    <th className="right">IN</th>
                    <th className="right">OUT</th>
                    <th className="right">Saldo</th>
                    <th>Nota</th>
                    </tr>
                </thead>
                <tbody>
                    {kardex.map((r, idx) => (
                    <tr key={idx}>
                        <td className="mono">{formatDate(r.date || r.created_at || r.createdAt)}</td>
                        <td>
                        <span className={`inv-pill inv-pill--type ${String(r.type).toUpperCase()}`}>
                            {String(r.type).toUpperCase()}
                        </span>
                        </td>
                        <td className="muted">{r.ref || "-"}</td>
                        <td className="right mono">{Number(r.inQty ?? r.in_qty ?? 0)}</td>
                        <td className="right mono">{Number(r.outQty ?? r.out_qty ?? 0)}</td>
                        <td className="right mono"><b>{Number(r.balance ?? r.saldo ?? 0)}</b></td>
                        <td className="muted">{r.note || "-"}</td>
                    </tr>
                    ))}
                    {!kardex.length && (
                    <tr>
                        <td colSpan={7} className="inv-empty-cell muted">
                        {loadingKardex ? "Cargando..." : "Sin registros para el rango."}
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>

            <div className="help">
                Si tu API usa otra ruta, ajusta <code>fetchKardex()</code> (ahora está en <b>/inventory/kardex</b>).
            </div>
            </div>
        )}

        {/* MODAL */}
        {modalOpen && (
            <div className="inv-modal" role="dialog" aria-modal="true" onMouseDown={closeModal}>
            <div className="inv-modal__card" onMouseDown={(e) => e.stopPropagation()}>
                <div className="inv-modal__head">
                <div className="inv-modal__title">
                    <Package size={18} /> {modalProduct?.name || `Producto #${modalPid}`}
                    <span className="inv-badge" style={{ marginLeft: 10 }}>#{modalPid}</span>
                </div>
                <button className="inv-icon-btn" onClick={closeModal} title="Cerrar">
                    <X size={18} />
                </button>
                </div>

                <div className="inv-modal__grid">
                <div className="inv-modal__panel">
                    <div className="inv-modal__kpi">
                    <div className="muted">Stock actual</div>
                    <div className="inv-modal__kpiValue">{modalStock}</div>
                    </div>

                    <div className="inv-modal__actions">
                    <button className="inv-btn inv-btn-mini" onClick={() => setModalMove((m) => ({ ...m, type: "IN" }))}>
                        <ArrowDownToLine size={16} /> IN
                    </button>
                    <button className="inv-btn inv-btn-mini inv-btn-ghost" onClick={() => setModalMove((m) => ({ ...m, type: "OUT" }))}>
                        <ArrowUpFromLine size={16} /> OUT
                    </button>
                    <button className="inv-btn inv-btn-mini inv-btn-ghost" onClick={() => setModalMove((m) => ({ ...m, type: "ADJUST" }))}>
                        <Settings2 size={16} /> ADJ
                    </button>
                    </div>

                    <div className="inv-modal__form">
                    <div className="inv-field">
                        <label>Tipo</label>
                        <select className="inv-input" value={modalMove.type} onChange={(e) => setModalMove((m) => ({ ...m, type: e.target.value }))}>
                        <option value="IN">IN (Entrada)</option>
                        <option value="OUT">OUT (Salida)</option>
                        <option value="ADJUST">ADJUST (Ajuste)</option>
                        </select>
                    </div>

                    <div className="inv-field">
                        <label>Cantidad</label>
                        <input
                        className="inv-input"
                        type="number"
                        step="1"
                        placeholder={modalMove.type === "ADJUST" ? "ej: -5 o 10" : "ej: 10"}
                        value={modalMove.quantity}
                        onChange={(e) => setModalMove((m) => ({ ...m, quantity: e.target.value }))}
                        />
                        {modalMove.type === "OUT" && (
                        <div className="help">Disponible: <b>{modalStock}</b></div>
                        )}
                    </div>

                    <div className="inv-field">
                        <label>Nota</label>
                        <input
                        className="inv-input"
                        placeholder="ej: Venta / Ajuste / Producción"
                        value={modalMove.note}
                        onChange={(e) => setModalMove((m) => ({ ...m, note: e.target.value }))}
                        />
                    </div>

                    <button className="inv-btn inv-btn--primary" type="button" onClick={submitModalMovement} disabled={savingMove}>
                        {savingMove ? "Guardando..." : "Guardar movimiento"}
                    </button>
                    </div>
                </div>

                <div className="inv-modal__panel">
                    <div className="inv-card__head" style={{ marginBottom: 0 }}>
                    <div className="inv-card__title">Kardex rápido</div>
                    <div className="inv-chip">export</div>
                    </div>

                    <div className="inv-modal__range">
                    <div className="inv-field">
                        <label>Desde</label>
                        <input className="inv-input" type="date" value={modalRange.from} onChange={(e) => setModalRange((r) => ({ ...r, from: e.target.value }))} />
                    </div>
                    <div className="inv-field">
                        <label>Hasta</label>
                        <input className="inv-input" type="date" value={modalRange.to} onChange={(e) => setModalRange((r) => ({ ...r, to: e.target.value }))} />
                    </div>
                    </div>

                    <div className="inv-modal__actions2">
                    <button className="inv-btn" onClick={() => exportModalKardex("xlsx")} type="button">
                        <FileDown size={16} /> Excel Kardex
                    </button>
                    <button className="inv-btn inv-btn-ghost" onClick={() => exportModalKardex("pdf")} type="button">
                        <FileDown size={16} /> PDF Kardex
                    </button>
                    </div>

                    <div className="inv-modal__chart">
                    {!modalOutDaily.length ? (
                        <div className="inv-empty">Sin OUT recientes (últimos 14 días) para graficar.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={190}>
                        <AreaChart data={modalOutDaily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="out" stroke="rgba(239,68,68,.75)" fill="rgba(239,68,68,.18)" />
                        </AreaChart>
                        </ResponsiveContainer>
                    )}
                    </div>

                    <div className="inv-modal__miniTable">
                    <div className="inv-card__title">Últimos movimientos</div>
                    <div className="inv-mini-list">
                        {modalRecentForProduct.length ? (
                        modalRecentForProduct.map((m, i) => (
                            <div key={i} className="inv-mini-row inv-mini-row--flat">
                            <div className="inv-mini-left">
                                <div className="inv-mini-title">
                                <span className={`inv-pill inv-pill--type ${String(m.type).toUpperCase()}`}>
                                    {String(m.type).toUpperCase()}
                                </span>{" "}
                                <span className="mono">{m.quantity}</span>
                                </div>
                                <div className="inv-mini-sub muted">
                                {formatDate(m.created_at || m.createdAt)} · {m.note || "-"}
                                </div>
                            </div>
                            </div>
                        ))
                        ) : (
                        <div className="inv-empty">Sin movimientos recientes para este producto.</div>
                        )}
                    </div>
                    </div>
                </div>
                </div>

                <div className="inv-modal__foot muted">Click afuera para cerrar.</div>
            </div>
            </div>
        )}
        </div>
    );
    }