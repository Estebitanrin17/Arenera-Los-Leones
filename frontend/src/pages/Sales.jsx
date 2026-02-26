    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";
    import "./sales.css";

    import {
    RefreshCw,
    FileDown,
    Search,
    Plus,
    ChevronDown,
    ChevronUp,
    Receipt,
    CreditCard,
    Undo2,
    Ban,
    X,
    } from "lucide-react";

    function isoToday() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
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

    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    }

    function fmtMoney(v) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return String(v ?? "");
    return n.toLocaleString("es-CO");
    }

    function statusClass(status = "") {
    const s = String(status).toUpperCase();
    if (s.includes("CANCEL")) return "bad";
    if (s.includes("PAID")) return "ok";
    if (s.includes("PART")) return "warn";
    if (s.includes("OPEN")) return "warn";
    return "neutral";
    }

    function totalsOfSale(sale) {
    const paid = (sale?.payments || []).reduce((a, p) => a + Number(p.amount ?? 0), 0);
    const refunded = (sale?.refunds || []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
    return { paid, refunded, netPaid: paid - refunded };
    }

    export default function Sales() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [products, setProducts] = useState([]);
    const [sales, setSales] = useState([]);

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    // filtros listado
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [from, setFrom] = useState(isoToday());
    const [to, setTo] = useState(isoToday());

    // acordeón
    const [expandedId, setExpandedId] = useState(null);
    const [detailsById, setDetailsById] = useState({}); // cache
    const [detailLoadingId, setDetailLoadingId] = useState(null);

    // Crear venta
    const [saleForm, setSaleForm] = useState({
        warehouseId: 1,
        customerName: "Cliente mostrador",
        customerPhone: "",
        discount: 0,
        note: "",
        items: [{ productId: "", quantity: 1, unitPrice: "" }],
    });

    // forms pagos/reembolsos (para la venta expandida)
    const [payForm, setPayForm] = useState({ amount: "", method: "CASH", note: "" });
    const [refForm, setRefForm] = useState({ amount: "", method: "CASH", note: "" });

    const clearAlerts = () => {
        setMsg("");
        setError("");
    };

    const fetchInit = async () => {
        setLoading(true);
        clearAlerts();
        try {
        const [pRes, sRes] = await Promise.all([api.get("/products?all=1"), api.get("/sales")]);
        setProducts(pRes.data.data || []);
        setSales(sRes.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando ventas");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchInit();
    }, []);

    const fetchSaleDetail = async (id) => {
        setDetailLoadingId(id);
        try {
        const { data } = await api.get(`/sales/${id}`);
        const sale = data.data;
        setDetailsById((m) => ({ ...m, [id]: sale }));
        return sale;
        } finally {
        setDetailLoadingId(null);
        }
    };

    const toggleExpand = async (id) => {
        clearAlerts();

        if (expandedId === id) {
        setExpandedId(null);
        return;
        }

        setExpandedId(id);
        setPayForm({ amount: "", method: "CASH", note: "" });
        setRefForm({ amount: "", method: "CASH", note: "" });

        if (!detailsById[id]) {
        try {
            await fetchSaleDetail(id);
        } catch (e) {
            setError(e?.response?.data?.message || "Error cargando detalle");
        }
        }
    };

    const expandedSale = detailsById[expandedId] || null;
    const expandedTotals = useMemo(() => totalsOfSale(expandedSale), [expandedSale]);

    const onSaleChange = (k) => (e) => setSaleForm((s) => ({ ...s, [k]: e.target.value }));

    const updateItem = (idx, key, value) => {
        setSaleForm((s) => {
        const items = s.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
        return { ...s, items };
        });
    };

    const addItem = () =>
        setSaleForm((s) => ({ ...s, items: [...s.items, { productId: "", quantity: 1, unitPrice: "" }] }));

    const removeItem = (idx) =>
        setSaleForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));

    const newSalePreview = useMemo(() => {
        const discount = Number(saleForm.discount || 0);
        let subtotal = 0;

        for (const it of saleForm.items) {
        const pid = Number(it.productId);
        if (!pid) continue;
        const qty = Number(it.quantity || 0);
        const p = products.find((x) => Number(x.id) === pid);
        const base = it.unitPrice !== "" ? Number(it.unitPrice) : Number(p?.price ?? 0);
        subtotal += qty * base;
        }
        const total = Math.max(0, subtotal - discount);
        return { subtotal, discount, total };
    }, [saleForm.items, saleForm.discount, products]);

    const createSale = async (e) => {
        e.preventDefault();
        clearAlerts();

        const payload = {
        warehouseId: Number(saleForm.warehouseId),
        customerName: saleForm.customerName?.trim() || undefined,
        customerPhone: saleForm.customerPhone?.trim() || undefined,
        discount: Number(saleForm.discount || 0),
        note: saleForm.note?.trim() || undefined,
        items: saleForm.items.map((it) => ({
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            ...(it.unitPrice !== "" ? { unitPrice: Number(it.unitPrice) } : {}),
        })),
        };

        try {
        const { data } = await api.post("/sales", payload);
        setMsg("Venta creada ✅");
        await fetchInit();

        const created = data.data;
        setDetailsById((m) => ({ ...m, [created.id]: created }));
        setExpandedId(created.id);

        setSaleForm({
            warehouseId: 1,
            customerName: "Cliente mostrador",
            customerPhone: "",
            discount: 0,
            note: "",
            items: [{ productId: "", quantity: 1, unitPrice: "" }],
        });
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error creando venta");
        }
    };

    const addPayment = async () => {
        if (!expandedSale) return;
        clearAlerts();
        try {
        const payload = {
            amount: Number(payForm.amount),
            method: payForm.method,
            note: payForm.note?.trim() || undefined,
        };
        const { data } = await api.post(`/sales/${expandedSale.id}/payments`, payload);
        setDetailsById((m) => ({ ...m, [expandedSale.id]: data.data }));
        setPayForm({ amount: "", method: "CASH", note: "" });
        setMsg("Pago registrado ✅");
        fetchInit();
        } catch (e) {
        setError(e?.response?.data?.message || "Error registrando pago");
        }
    };

    const addRefund = async () => {
        if (!expandedSale) return;
        if (!isOwner) return setError("Solo OWNER puede reembolsar");
        clearAlerts();
        try {
        const payload = {
            amount: Number(refForm.amount),
            method: refForm.method,
            note: refForm.note?.trim() || undefined,
        };
        const { data } = await api.post(`/sales/${expandedSale.id}/refunds`, payload);
        setDetailsById((m) => ({ ...m, [expandedSale.id]: data.data }));
        setRefForm({ amount: "", method: "CASH", note: "" });
        setMsg("Reembolso registrado ✅");
        fetchInit();
        } catch (e) {
        setError(e?.response?.data?.message || "Error registrando reembolso");
        }
    };

    const cancelSale = async () => {
        if (!expandedSale) return;
        if (!isOwner) return setError("Solo OWNER puede cancelar");
        if (!confirm("¿Cancelar venta? Esto devuelve stock.")) return;

        clearAlerts();
        try {
        const { data } = await api.post(`/sales/${expandedSale.id}/cancel`, {});
        setDetailsById((m) => ({ ...m, [expandedSale.id]: data.data }));
        setMsg("Venta cancelada ✅");
        fetchInit();
        } catch (e) {
        setError(e?.response?.data?.message || "Error cancelando venta");
        }
    };

    const exportSalePdf = async () => {
        if (!expandedSale) return;
        clearAlerts();
        try {
        await downloadWithAuth(`/reports/sales/${expandedSale.id}/pdf`, `venta-${expandedSale.id}.pdf`);
        setMsg("PDF listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando PDF");
        }
    };

    const exportSalesExcel = async () => {
        clearAlerts();
        try {
        await downloadWithAuth(`/reports/sales.xlsx?from=${from}&to=${to}`, `ventas_${from}_a_${to}.xlsx`);
        setMsg("Excel listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando Excel");
        }
    };

    const listMetrics = useMemo(() => {
        const total = sales.reduce((a, s) => a + Number(s.total ?? 0), 0);
        const count = sales.length;
        const canceled = sales.filter((s) => String(s.status).toUpperCase().includes("CANCEL")).length;
        return { total, count, canceled };
    }, [sales]);

    const filteredSales = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return sales.filter((s) => {
        const id = String(s.id);
        const customer = String(s.customer_name || "").toLowerCase();
        const st = String(s.status || "").toUpperCase();
        const okQ = !qq || id.includes(qq) || customer.includes(qq);
        const okSt = !statusFilter || st === statusFilter;
        return okQ && okSt;
        });
    }, [sales, q, statusFilter]);

    return (
        <div className="sales-page">
        <div className="sales-head">
            <div>
            <div className="sales-title">Ventas</div>
            <div className="sales-subtitle">Crea ventas, registra pagos/reembolsos y exporta reportes.</div>
            </div>

            <div className="sales-actions">
            <button className="s-btn s-btn-ghost" onClick={fetchInit}>
                <RefreshCw size={16} /> Recargar
            </button>

            <div className="s-range">
                <div className="s-field">
                <label>Desde</label>
                <input className="s-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="s-field">
                <label>Hasta</label>
                <input className="s-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>

                <button className="s-btn" onClick={exportSalesExcel}>
                <FileDown size={16} /> Excel
                </button>
            </div>
            </div>
        </div>

        {(error || msg) && (
            <div className={`s-alert ${error ? "s-alert--error" : "s-alert--ok"}`}>
            <div className="s-alert__text">{error || msg}</div>
            <button className="s-alert__close" onClick={clearAlerts}>✕</button>
            </div>
        )}

        <div className="s-metrics">
            <div className="s-card s-metric">
            <div className="s-metric__label">Ventas</div>
            <div className="s-metric__value">{listMetrics.count}</div>
            </div>
            <div className="s-card s-metric">
            <div className="s-metric__label">Total (lista)</div>
            <div className="s-metric__value">{fmtMoney(listMetrics.total)}</div>
            </div>
            <div className="s-card s-metric">
            <div className="s-metric__label">Canceladas</div>
            <div className="s-metric__value">{listMetrics.canceled}</div>
            </div>
        </div>

        {/* Crear venta */}
        <form className="s-card" onSubmit={createSale}>
            <div className="s-card__head">
            <div className="s-card__title">
                <Receipt size={18} /> Crear venta
            </div>
            <div className="s-chip">
                Total: <b>{fmtMoney(newSalePreview.total)}</b>
            </div>
            </div>

            <div className="s-grid">
            <div className="s-field">
                <label>Bodega ID</label>
                <input className="s-input" value={saleForm.warehouseId} onChange={onSaleChange("warehouseId")} />
            </div>

            <div className="s-field s-span-2">
                <label>Cliente</label>
                <input className="s-input" value={saleForm.customerName} onChange={onSaleChange("customerName")} />
            </div>

            <div className="s-field">
                <label>Teléfono</label>
                <input className="s-input" value={saleForm.customerPhone} onChange={onSaleChange("customerPhone")} />
            </div>

            <div className="s-field">
                <label>Descuento</label>
                <input className="s-input" value={saleForm.discount} onChange={onSaleChange("discount")} />
            </div>

            <div className="s-field s-span-4">
                <label>Nota</label>
                <input className="s-input" value={saleForm.note} onChange={onSaleChange("note")} />
            </div>
            </div>

            <div className="s-items">
            <div className="s-items__head">
                <b>Items</b>
                <div className="muted">
                Subtotal: <b>{fmtMoney(newSalePreview.subtotal)}</b> · Descuento:{" "}
                <b>{fmtMoney(newSalePreview.discount)}</b>
                </div>
            </div>

            {saleForm.items.map((it, idx) => (
                <div key={idx} className="s-item-row">
                <div className="s-field s-item-product">
                    <label>Producto</label>
                    <select className="s-input" value={it.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)}>
                    <option value="">-- Selecciona --</option>
                    {products.filter((p) => p.is_active === 1).map((p) => (
                        <option key={p.id} value={p.id}>
                        #{p.id} - {p.name} {p.gramaje} ({p.unit}) - ${p.price}
                        </option>
                    ))}
                    </select>
                </div>

                <div className="s-field">
                    <label>Cantidad</label>
                    <input className="s-input" value={it.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                </div>

                <div className="s-field">
                    <label>Precio unit (opcional)</label>
                    <input
                    className="s-input"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                    placeholder="vacío = precio del producto"
                    />
                </div>

                {saleForm.items.length > 1 ? (
                    <button type="button" className="s-btn s-btn-ghost s-btn-icon" onClick={() => removeItem(idx)} title="Quitar item">
                    <X size={16} />
                    </button>
                ) : (
                    <div />
                )}
                </div>
            ))}

            <div className="s-items__actions">
                <button type="button" className="s-btn s-btn-ghost" onClick={addItem}>
                <Plus size={16} /> Agregar item
                </button>
                <button type="submit" className="s-btn">
                <Plus size={16} /> Crear venta
                </button>
            </div>
            </div>
        </form>

        {/* LISTADO (detalle hacia abajo) */}
        <div className="s-card" style={{ marginTop: 12 }}>
            <div className="s-card__head">
            <div className="s-card__title">Listado</div>

            <div className="s-list-tools">
                <div className="s-search">
                <Search size={16} />
                <input
                    className="s-input s-input-tight"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por ID o cliente..."
                />
                </div>

                <div className="s-field">
                <label>Estado</label>
                <select className="s-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="OPEN">OPEN</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                </select>
                </div>
            </div>
            </div>

            {loading ? (
            <div className="s-skeleton">Cargando...</div>
            ) : (
            <div className="s-table-wrap">
                <table className="s-table">
                <thead>
                    <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Cliente</th>
                    <th className="right">Total</th>
                    <th className="right">Acción</th>
                    </tr>
                </thead>

                <tbody>
                    {filteredSales.map((s) => {
                    const isOpen = expandedId === s.id;
                    const detail = detailsById[s.id] || null;
                    const totals = detail ? totalsOfSale(detail) : null;

                    return (
                        <>
                        <tr key={s.id} className={isOpen ? "active" : ""}>
                            <td className="mono">{s.id}</td>
                            <td className="mono">{new Date(s.created_at).toLocaleString()}</td>
                            <td>
                            <span className={`s-pill ${statusClass(s.status)}`}>{s.status}</span>
                            </td>
                            <td>{s.customer_name || ""}</td>
                            <td className="right mono">{fmtMoney(s.total)}</td>
                            <td className="right">
                            <button className="s-btn s-btn-mini" onClick={() => toggleExpand(s.id)}>
                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                {isOpen ? "Cerrar" : "Ver"}
                            </button>
                            </td>
                        </tr>

                        {isOpen && (
                            <tr className="s-expand-row">
                            <td colSpan={6}>
                                <div className="s-expand">
                                {detailLoadingId === s.id && !detail ? (
                                    <div className="s-expand__loading">Cargando detalle...</div>
                                ) : !detail ? (
                                    <div className="s-expand__loading">No se pudo cargar el detalle.</div>
                                ) : (
                                    <>
                                    <div className="s-expand__top">
                                        <div>
                                        <div className="s-expand__title">Venta #{detail.id}</div>
                                        <div className="muted">
                                            Cliente: <b>{detail.customer_name || "N/A"}</b> · Tel:{" "}
                                            <b>{detail.customer_phone || "—"}</b> · Estado:{" "}
                                            <b>{detail.status}</b>
                                        </div>
                                        </div>

                                        <div className="s-expand__actions">
                                        <button className="s-btn s-btn-ghost" onClick={exportSalePdf}>
                                            <FileDown size={16} /> PDF
                                        </button>
                                        {isOwner && (
                                            <button className="s-btn s-btn-danger" onClick={cancelSale}>
                                            <Ban size={16} /> Cancelar
                                            </button>
                                        )}
                                        </div>
                                    </div>

                                    <div className="s-expand__kpis">
                                        <div className="s-kpi">
                                        <div className="muted">Total</div>
                                        <div className="s-kpi__v">{fmtMoney(detail.total)}</div>
                                        </div>
                                        <div className="s-kpi">
                                        <div className="muted">Pagado</div>
                                        <div className="s-kpi__v">{fmtMoney(totals.paid)}</div>
                                        </div>
                                        <div className="s-kpi">
                                        <div className="muted">Reemb.</div>
                                        <div className="s-kpi__v">{fmtMoney(totals.refunded)}</div>
                                        </div>
                                        <div className="s-kpi">
                                        <div className="muted">Neto</div>
                                        <div className="s-kpi__v">{fmtMoney(totals.netPaid)}</div>
                                        </div>
                                    </div>

                                    <div className="s-expand__grid">
                                        <div className="s-section">
                                        <div className="s-section__title">Items</div>
                                        <div className="s-table-wrap">
                                            <table className="s-table">
                                            <thead>
                                                <tr>
                                                <th>Producto</th>
                                                <th className="right">Qty</th>
                                                <th className="right">Unit</th>
                                                <th className="right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detail.items.map((it) => (
                                                <tr key={it.id}>
                                                    <td>{it.product_name} {it.gramaje}</td>
                                                    <td className="right mono">{it.quantity}</td>
                                                    <td className="right mono">{fmtMoney(it.unit_price)}</td>
                                                    <td className="right mono">{fmtMoney(it.line_total)}</td>
                                                </tr>
                                                ))}
                                            </tbody>
                                            </table>
                                        </div>
                                        </div>

                                        <div className="s-section">
                                        <div className="s-section__title"><CreditCard size={16} /> Pagos</div>

                                        <ul className="s-list">
                                            {(detail.payments || []).map((p) => (
                                            <li key={p.id} className="s-li">
                                                <span className="s-pill ok">{p.method}</span>
                                                <span className="mono">{fmtMoney(p.amount)}</span>
                                                <span className="muted">{p.note || ""}</span>
                                            </li>
                                            ))}
                                            {!detail.payments?.length && <li className="muted">No hay pagos.</li>}
                                        </ul>

                                        <div className="s-formline">
                                            <div className="s-field">
                                            <label>Monto</label>
                                            <input className="s-input" value={payForm.amount} onChange={(e) => setPayForm((x) => ({ ...x, amount: e.target.value }))} />
                                            </div>
                                            <div className="s-field">
                                            <label>Método</label>
                                            <select className="s-input" value={payForm.method} onChange={(e) => setPayForm((x) => ({ ...x, method: e.target.value }))}>
                                                <option value="CASH">CASH</option>
                                                <option value="TRANSFER">TRANSFER</option>
                                                <option value="CARD">CARD</option>
                                                <option value="OTHER">OTHER</option>
                                            </select>
                                            </div>
                                            <div className="s-field s-span-2">
                                            <label>Nota</label>
                                            <input className="s-input" value={payForm.note} onChange={(e) => setPayForm((x) => ({ ...x, note: e.target.value }))} />
                                            </div>
                                            <button className="s-btn" type="button" onClick={addPayment}>
                                            <CreditCard size={16} /> Agregar
                                            </button>
                                        </div>
                                        </div>

                                        <div className="s-section">
                                        <div className="s-section__title"><Undo2 size={16} /> Reembolsos {!isOwner && <span className="s-pill neutral">solo OWNER</span>}</div>

                                        <ul className="s-list">
                                            {(detail.refunds || []).map((r) => (
                                            <li key={r.id} className="s-li">
                                                <span className="s-pill warn">{r.method}</span>
                                                <span className="mono">{fmtMoney(r.amount)}</span>
                                                <span className="muted">{r.note || ""}</span>
                                            </li>
                                            ))}
                                            {!detail.refunds?.length && <li className="muted">No hay reembolsos.</li>}
                                        </ul>

                                        {isOwner && (
                                            <div className="s-formline">
                                            <div className="s-field">
                                                <label>Monto</label>
                                                <input className="s-input" value={refForm.amount} onChange={(e) => setRefForm((x) => ({ ...x, amount: e.target.value }))} />
                                            </div>
                                            <div className="s-field">
                                                <label>Método</label>
                                                <select className="s-input" value={refForm.method} onChange={(e) => setRefForm((x) => ({ ...x, method: e.target.value }))}>
                                                <option value="CASH">CASH</option>
                                                <option value="TRANSFER">TRANSFER</option>
                                                <option value="CARD">CARD</option>
                                                <option value="OTHER">OTHER</option>
                                                </select>
                                            </div>
                                            <div className="s-field s-span-2">
                                                <label>Nota</label>
                                                <input className="s-input" value={refForm.note} onChange={(e) => setRefForm((x) => ({ ...x, note: e.target.value }))} />
                                            </div>
                                            <button className="s-btn s-btn-ghost" type="button" onClick={addRefund}>
                                                <Undo2 size={16} /> Reembolsar
                                            </button>
                                            </div>
                                        )}
                                        </div>
                                    </div>
                                    </>
                                )}
                                </div>
                            </td>
                            </tr>
                        )}
                        </>
                    );
                    })}

                    {!filteredSales.length && (
                    <tr>
                        <td colSpan={6} className="muted s-empty">
                        No hay ventas con esos filtros.
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            )}
        </div>
        </div>
    );
    }