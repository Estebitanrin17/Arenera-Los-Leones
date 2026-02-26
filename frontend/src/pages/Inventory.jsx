    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import "./inventory.css";

    const TABS = ["Stock", "Movimiento", "Historial", "Kardex"];

    function isoToday() {
    const d = new Date();
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
    // filename*=UTF-8''... o filename="..."
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
    const [tab, setTab] = useState("Stock");

    const [warehouseId, setWarehouseId] = useState(1);

    const [products, setProducts] = useState([]);
    const [stock, setStock] = useState([]);

    const [loadingStock, setLoadingStock] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingKardex, setLoadingKardex] = useState(false);
    const [savingMove, setSavingMove] = useState(false);

    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    // filtros UI
    const [stockQuery, setStockQuery] = useState("");
    const [historyFrom, setHistoryFrom] = useState(isoToday());
    const [historyTo, setHistoryTo] = useState(isoToday());
    const [historyType, setHistoryType] = useState("");
    const [historyProductId, setHistoryProductId] = useState("");
    const [history, setHistory] = useState([]);

    // kardex
    const [kProductId, setKProductId] = useState("");
    const [kFrom, setKFrom] = useState(isoToday());
    const [kTo, setKTo] = useState(isoToday());
    const [kardex, setKardex] = useState([]);

    // form movimiento (compat con tu backend actual)
    const [mov, setMov] = useState({
        productId: "",
        type: "IN",
        quantity: "",
        note: "",
    });

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
        return (
            name.includes(q) ||
            unit.includes(q) ||
            gramaje.includes(q) ||
            pid.includes(q)
        );
        });
    }, [stock, stockQuery]);

    const metrics = useMemo(() => {
        const skuCount = stock.length;
        const totalUnits = stock.reduce((acc, r) => acc + Number(r.quantity ?? 0), 0);
        const lowCount = stock.filter((r) => Number(r.quantity ?? 0) <= 5).length;
        return { skuCount, totalUnits, lowCount };
    }, [stock]);

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
        } finally {
        setLoadingStock(false);
        }
    };

    const fetchAll = async () => {
        setLoadingStock(true);
        clearAlerts();
        try {
        await Promise.all([fetchProducts(), fetchStock()]);
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

    const onMovChange = (k) => (e) =>
        setMov((m) => ({ ...m, [k]: e.target.value }));

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

    const validateMovement = () => {
        const productId = Number(mov.productId);
        const qty = Number(mov.quantity);

        if (!productId) throw new Error("Selecciona un producto");
        if (!Number.isFinite(qty) || qty === 0) {
        throw new Error(
            mov.type === "ADJUST"
            ? "Cantidad inválida (usa + o - y no 0)"
            : "Cantidad inválida"
        );
        }

        if (mov.type !== "ADJUST" && qty < 0) {
        throw new Error("La cantidad debe ser positiva");
        }

        if (mov.type === "OUT") {
        const available = Number(stockByProductId.get(productId) ?? 0);
        if (qty > available) {
            throw new Error(
            `Stock insuficiente. Disponible: ${available} (quieres sacar: ${qty})`
            );
        }
        }
    };

    const submitMovement = async (e) => {
        e.preventDefault();
        clearAlerts();

        try {
        validateMovement();

        const payload = {
            warehouseId: Number(warehouseId),
            productId: Number(mov.productId),
            type: mov.type,
            quantity: Number(mov.quantity),
            note: mov.note?.trim() || undefined,
        };

        setSavingMove(true);
        await api.post("/inventory/movements", payload);

        setMsg("Movimiento registrado ✅");
        setMov({ productId: "", type: "IN", quantity: "", note: "" });

        // refresca stock
        await fetchStock();
        setTab("Stock");
        } catch (e2) {
        setError(e2?.response?.data?.message || e2?.message || "Error registrando movimiento");
        } finally {
        setSavingMove(false);
        }
    };

    // EXPORTS
    const exportInventoryExcel = async () => {
        clearAlerts();
        try {
        await downloadWithAuth(
            `/reports/inventory.xlsx?warehouseId=${warehouseId}`,
            `inventario_bodega_${warehouseId}.xlsx`
        );
        setMsg("Descarga lista ✅");
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const exportInventoryPdf = async () => {
        clearAlerts();
        try {
        await downloadWithAuth(
            `/reports/inventory.pdf?warehouseId=${warehouseId}`,
            `inventario_bodega_${warehouseId}.pdf`
        );
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

    // HISTORIAL (si tu backend aún no tiene GET /inventory/movements, ajusta aquí)
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

    // KARDEX (si tu backend usa otra ruta, ajusta)
    const fetchKardex = async () => {
        clearAlerts();
        if (!kProductId) return setError("Selecciona un producto para ver kardex");
        setLoadingKardex(true);
        try {
        const res = await api.get(
            `/inventory/kardex?warehouseId=${warehouseId}&productId=${kProductId}&from=${kFrom}&to=${kTo}`
        );
        setKardex(res.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "No se pudo cargar kardex");
        } finally {
        setLoadingKardex(false);
        }
    };

    return (
        <div className="inv-page">
        <div className="inv-header">
            <div>
            <div className="inv-title">Inventario</div>
            <div className="inv-subtitle">
                Bodega <span className="inv-badge">#{warehouseId}</span>
            </div>
            </div>

            <div className="inv-actions">
            <div className="inv-field">
                <label>Bodega ID</label>
                <input
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="inv-input"
                style={{ width: 120 }}
                />
            </div>

            <button className="inv-btn inv-btn-ghost" onClick={fetchAll}>
                Recargar
            </button>

            <button className="inv-btn" onClick={exportInventoryExcel}>
                Excel inventario
            </button>

            <button className="inv-btn inv-btn-ghost" onClick={exportInventoryPdf}>
                PDF inventario
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
            <div className="inv-metric__label">Bajo stock (≤ 5)</div>
            <div className="inv-metric__value">{metrics.lowCount}</div>
            </div>
        </div>

        <div className="inv-tabs">
            {TABS.map((t) => (
            <button
                key={t}
                className={`inv-tab ${tab === t ? "inv-tab--active" : ""}`}
                onClick={() => setTab(t)}
            >
                {t}
            </button>
            ))}
        </div>

        {/* STOCK */}
        {tab === "Stock" && (
            <div className="inv-card">
            <div className="inv-card__head">
                <div className="inv-card__title">Stock actual</div>
                <input
                className="inv-input"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                placeholder="Buscar (nombre, id, unidad, gramaje)..."
                style={{ maxWidth: 420 }}
                />
            </div>

            {loadingStock ? (
                <div className="inv-skeleton">Cargando stock...</div>
            ) : (
                <div className="inv-table-wrap">
                <table className="inv-table">
                    <thead>
                    <tr>
                        <th>ID</th>
                        <th>Producto</th>
                        <th>Gramaje</th>
                        <th>Unidad</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Acciones</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredStock.map((r) => {
                        const qty = Number(r.quantity ?? 0);
                        const isLow = qty <= 5;
                        return (
                        <tr key={r.product_id} className={isLow ? "low" : ""}>
                            <td className="mono">{r.product_id}</td>
                            <td>{r.name}</td>
                            <td>{r.gramaje}</td>
                            <td>{r.unit}</td>
                            <td className="right">
                            <span className={`inv-pill ${isLow ? "inv-pill--warn" : ""}`}>
                                {qty}
                            </span>
                            </td>
                            <td className="right">
                            <div className="inv-row-actions">
                                <button
                                className="inv-btn inv-btn-mini"
                                onClick={() => quickMove("IN", r.product_id)}
                                >
                                IN
                                </button>
                                <button
                                className="inv-btn inv-btn-mini inv-btn-ghost"
                                onClick={() => quickMove("OUT", r.product_id)}
                                >
                                OUT
                                </button>
                                <button
                                className="inv-btn inv-btn-mini inv-btn-ghost"
                                onClick={() => quickMove("ADJUST", r.product_id)}
                                >
                                ADJ
                                </button>
                            </div>
                            </td>
                        </tr>
                        );
                    })}
                    {!filteredStock.length && (
                        <tr>
                        <td colSpan={6} className="muted">
                            No hay stock para esta bodega.
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            )}
            </div>
        )}

        {/* MOVIMIENTO */}
        {tab === "Movimiento" && (
            <form onSubmit={submitMovement} className="inv-card">
            <div className="inv-card__head">
                <div className="inv-card__title">Registrar movimiento</div>
                <div className="inv-chip">
                Disponible: <b>{selectedAvailable}</b>
                </div>
            </div>

            <div className="inv-grid">
                <div className="inv-field">
                <label>Producto</label>
                <select
                    value={mov.productId}
                    onChange={onMovChange("productId")}
                    className="inv-input"
                >
                    <option value="">-- Selecciona --</option>
                    {products
                    .filter((p) => p.is_active === 1)
                    .map((p) => (
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
                <div className="help">
                    {mov.type === "OUT"
                    ? "OUT valida contra stock disponible."
                    : mov.type === "ADJUST"
                    ? "ADJUST permite + o - (según reglas de tu backend)."
                    : "IN agrega unidades."}
                </div>
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
                    <div className="help">
                    Máximo recomendado: <b>{selectedAvailable}</b>
                    </div>
                )}
                </div>

                <div className="inv-field inv-span-3">
                <label>Nota</label>
                <input
                    value={mov.note}
                    onChange={onMovChange("note")}
                    className="inv-input"
                    placeholder="ej: Producción del día / Venta / Ajuste"
                />
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

            <div className="inv-table-wrap">
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
                        <td colSpan={5} className="muted">
                        {loadingHistory ? "Cargando..." : "Sin movimientos en el rango."}
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>

            <div className="help">
                Si no tienes este endpoint aún: <b>GET /inventory/movements</b>, ajusta <code>fetchHistory()</code> arriba.
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

            <div className="inv-table-wrap">
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
                        <td className="right mono">
                        <b>{Number(r.balance ?? r.saldo ?? 0)}</b>
                        </td>
                        <td className="muted">{r.note || "-"}</td>
                    </tr>
                    ))}
                    {!kardex.length && (
                    <tr>
                        <td colSpan={7} className="muted">
                        {loadingKardex ? "Cargando..." : "Sin registros para el rango."}
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>

            <div className="help">
                Si tu API usa otra ruta, ajusta <code>fetchKardex()</code> arriba (ahora está en <b>/inventory/kardex</b>).
            </div>
            </div>
        )}
        </div>
    );
    }