    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";
    import "./debts.css";

    import {
    RefreshCw,
    FileDown,
    Search,
    Plus,
    ChevronDown,
    ChevronUp,
    HandCoins,
    User,
    AlertTriangle,
    Wallet,
    Save,
    } from "lucide-react";

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
    if (s === "OPEN") return "warn";
    if (s === "CLOSED") return "ok";
    return "neutral";
    }

    function typeLabel(type = "") {
    const t = String(type).toUpperCase();
    if (t === "ADVANCE") return "Adelanto";
    if (t === "LOAN") return "Préstamo";
    return t;
    }

    export default function Debts() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [employees, setEmployees] = useState([]);
    const [debts, setDebts] = useState([]);

    const [filters, setFilters] = useState({ employeeId: "", status: "OPEN", q: "" });

    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    // Acordeón + cache detalle
    const [expandedId, setExpandedId] = useState(null);
    const [detailsById, setDetailsById] = useState({});
    const [detailLoadingId, setDetailLoadingId] = useState(null);

    const [createForm, setCreateForm] = useState({
        employeeId: "",
        type: "ADVANCE",
        amount: "",
        note: "",
    });

    const [payForm, setPayForm] = useState({
        amount: "",
        method: "CASH",
        note: "",
    });

    const clearAlerts = () => {
        setError("");
        setMsg("");
    };

    const fetchAll = async () => {
        setLoading(true);
        clearAlerts();
        try {
        const qs = new URLSearchParams();
        if (filters.status) qs.set("status", filters.status);
        if (filters.employeeId) qs.set("employeeId", String(filters.employeeId));

        const [eRes, dRes] = await Promise.all([
            api.get("/employees?all=1"),
            api.get(`/debts?${qs.toString()}`),
        ]);

        setEmployees(eRes.data.data || []);
        setDebts(dRes.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando deudas");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.status, filters.employeeId]);

    const fetchDebtDetail = async (id) => {
        setDetailLoadingId(id);
        try {
        const { data } = await api.get(`/debts/${id}`);
        const debt = data.data;
        setDetailsById((m) => ({ ...m, [id]: debt }));
        return debt;
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

        if (!detailsById[id]) {
        try {
            await fetchDebtDetail(id);
        } catch (e) {
            setError(e?.response?.data?.message || "Error cargando deuda");
        }
        }
    };

    const expandedDebt = detailsById[expandedId] || null;

    const createDebt = async (e) => {
        e.preventDefault();
        clearAlerts();
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload = {
            employeeId: Number(createForm.employeeId),
            type: createForm.type,
            amount: Number(createForm.amount),
            note: createForm.note.trim() || undefined,
        };

        const { data } = await api.post("/debts", payload);
        setMsg("Deuda creada ✅");
        setCreateForm({ employeeId: "", type: "ADVANCE", amount: "", note: "" });

        await fetchAll();

        const created = data.data;
        setDetailsById((m) => ({ ...m, [created.id]: created }));
        setExpandedId(created.id);
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error creando deuda");
        }
    };

    const addPayment = async () => {
        if (!expandedDebt) return;
        clearAlerts();
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload = {
            amount: Number(payForm.amount),
            method: payForm.method,
            note: payForm.note.trim() || undefined,
        };
        const { data } = await api.post(`/debts/${expandedDebt.id}/payments`, payload);

        setDetailsById((m) => ({ ...m, [expandedDebt.id]: data.data }));
        setPayForm({ amount: "", method: "CASH", note: "" });
        setMsg("Pago registrado ✅");
        fetchAll();
        } catch (e) {
        setError(e?.response?.data?.message || "Error registrando pago");
        }
    };

    const exportDebtsExcel = async () => {
        clearAlerts();
        try {
        const q = new URLSearchParams();
        if (filters.status) q.set("status", filters.status);
        if (filters.employeeId) q.set("employeeId", String(filters.employeeId));
        await downloadWithAuth(`/reports/debts.xlsx?${q.toString()}`, "deudas.xlsx");
        setMsg("Excel listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando Excel");
        }
    };

    const exportDebtsPdf = async () => {
        clearAlerts();
        try {
        const q = new URLSearchParams();
        if (filters.status) q.set("status", filters.status);
        if (filters.employeeId) q.set("employeeId", String(filters.employeeId));
        await downloadWithAuth(`/reports/debts.pdf?${q.toString()}`, "deudas.pdf");
        setMsg("PDF listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando PDF");
        }
    };

    const metrics = useMemo(() => {
        const total = debts.length;
        const open = debts.filter((d) => String(d.status).toUpperCase() === "OPEN").length;
        const closed = debts.filter((d) => String(d.status).toUpperCase() === "CLOSED").length;
        const balance = debts.reduce((a, d) => a + Number(d.balance ?? 0), 0);
        return { total, open, closed, balance };
    }, [debts]);

    const filteredDebts = useMemo(() => {
        const qq = filters.q.trim().toLowerCase();
        if (!qq) return debts;
        return debts.filter((d) => {
        const id = String(d.id);
        const emp = String(d.employee_name || "").toLowerCase();
        const type = String(d.type || "").toLowerCase();
        return id.includes(qq) || emp.includes(qq) || type.includes(qq);
        });
    }, [debts, filters.q]);

    return (
        <div className="deb-page">
        <div className="deb-head">
            <div>
            <div className="deb-title">
                <HandCoins size={20} /> Deudas / Adelantos
            </div>
            <div className="deb-subtitle">Registro, pagos y reportes por empleado.</div>
            </div>

            <div className="deb-actions">
            <button className="d-btn d-btn-ghost" onClick={fetchAll}>
                <RefreshCw size={16} /> Recargar
            </button>
            <button className="d-btn" onClick={exportDebtsExcel}>
                <FileDown size={16} /> Excel
            </button>
            <button className="d-btn d-btn-ghost" onClick={exportDebtsPdf}>
                <FileDown size={16} /> PDF
            </button>
            </div>
        </div>

        {(error || msg) && (
            <div className={`d-alert ${error ? "d-alert--error" : "d-alert--ok"}`}>
            <div className="d-alert__text">
                {error ? <AlertTriangle size={16} /> : null}
                {error || msg}
            </div>
            <button className="d-alert__close" onClick={clearAlerts}>✕</button>
            </div>
        )}

        <div className="d-metrics">
            <div className="d-card d-metric">
            <div className="d-metric__label">Total</div>
            <div className="d-metric__value">{metrics.total}</div>
            </div>
            <div className="d-card d-metric">
            <div className="d-metric__label">Abiertas</div>
            <div className="d-metric__value">{metrics.open}</div>
            </div>
            <div className="d-card d-metric">
            <div className="d-metric__label">Cerradas</div>
            <div className="d-metric__value">{metrics.closed}</div>
            </div>
            <div className="d-card d-metric d-metric--wide">
            <div className="d-metric__label">Saldo total (lista)</div>
            <div className="d-metric__value">{fmtMoney(metrics.balance)}</div>
            </div>
        </div>

        {/* Filtros */}
        <div className="d-card">
            <div className="d-card__head">
            <div className="d-card__title">Filtros</div>
            <div className="d-chip">Export usa estos filtros</div>
            </div>

            <div className="d-filters">
            <div className="d-field">
                <label>Estado</label>
                <select
                className="d-input"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
                </select>
            </div>

            <div className="d-field d-span-2">
                <label>Empleado</label>
                <select
                className="d-input"
                value={filters.employeeId}
                onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}
                >
                <option value="">(Todos)</option>
                {employees.filter((x) => x.is_active === 1).map((e) => (
                    <option key={e.id} value={e.id}>
                    #{e.id} {e.full_name}
                    </option>
                ))}
                </select>
            </div>

            <div className="d-search">
                <Search size={16} />
                <input
                className="d-input d-input-tight"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Buscar por ID, empleado o tipo..."
                />
            </div>
            </div>
        </div>

        {/* Crear */}
        <div className="d-card" style={{ marginTop: 12 }}>
            <div className="d-card__head">
            <div className="d-card__title">
                <Plus size={18} /> Crear deuda / adelanto
            </div>
            {!isOwner && <div className="d-chip">solo OWNER</div>}
            </div>

            {isOwner ? (
            <form className="d-form" onSubmit={createDebt}>
                <div className="d-grid">
                <div className="d-field d-span-2">
                    <label>Empleado</label>
                    <select
                    className="d-input"
                    value={createForm.employeeId}
                    onChange={(e) => setCreateForm((x) => ({ ...x, employeeId: e.target.value }))}
                    >
                    <option value="">-- Selecciona --</option>
                    {employees.filter((x) => x.is_active === 1).map((e) => (
                        <option key={e.id} value={e.id}>
                        #{e.id} {e.full_name}
                        </option>
                    ))}
                    </select>
                </div>

                <div className="d-field">
                    <label>Tipo</label>
                    <select
                    className="d-input"
                    value={createForm.type}
                    onChange={(e) => setCreateForm((x) => ({ ...x, type: e.target.value }))}
                    >
                    <option value="ADVANCE">ADVANCE</option>
                    <option value="LOAN">LOAN</option>
                    <option value="OTHER">OTHER</option>
                    </select>
                </div>

                <div className="d-field">
                    <label>Monto</label>
                    <input
                    className="d-input"
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((x) => ({ ...x, amount: e.target.value }))}
                    placeholder="Ej: 50000"
                    />
                </div>

                <div className="d-field d-span-4">
                    <label>Nota</label>
                    <input
                    className="d-input"
                    value={createForm.note}
                    onChange={(e) => setCreateForm((x) => ({ ...x, note: e.target.value }))}
                    placeholder="Opcional"
                    />
                </div>
                </div>

                <div className="d-form__actions">
                <button className="d-btn" type="submit">
                    <Plus size={16} /> Crear
                </button>
                </div>
            </form>
            ) : (
            <div className="d-empty">
                Solo el rol <b>OWNER</b> puede crear deudas o adelantos.
            </div>
            )}
        </div>

        {/* Tabla + Acordeón */}
        <div className="d-card" style={{ marginTop: 12 }}>
            <div className="d-card__head">
            <div className="d-card__title">Listado</div>
            <div className="d-chip">{loading ? "Cargando..." : `${filteredDebts.length} registros`}</div>
            </div>

            {loading ? (
            <div className="d-skeleton">Cargando...</div>
            ) : (
            <div className="d-table-wrap">
                <table className="d-table">
                <thead>
                    <tr>
                    <th>ID</th>
                    <th>Empleado</th>
                    <th>Tipo</th>
                    <th className="right">Saldo</th>
                    <th>Estado</th>
                    <th className="right">Acción</th>
                    </tr>
                </thead>

                <tbody>
                    {filteredDebts.map((d) => {
                    const isOpen = expandedId === d.id;
                    const detail = detailsById[d.id] || null;

                    return (
                        <>
                        <tr key={d.id} className={isOpen ? "active" : ""}>
                            <td className="mono">{d.id}</td>
                            <td>
                            <span className="d-emp">
                                <User size={16} /> {d.employee_name}
                            </span>
                            </td>
                            <td>
                            <span className="d-pill">{typeLabel(d.type)}</span>
                            </td>
                            <td className="right mono">{fmtMoney(d.balance)}</td>
                            <td>
                            <span className={`d-pill ${statusClass(d.status)}`}>{d.status}</span>
                            </td>
                            <td className="right">
                            <button className="d-btn d-btn-mini" onClick={() => toggleExpand(d.id)}>
                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                {isOpen ? "Cerrar" : "Ver"}
                            </button>
                            </td>
                        </tr>

                        {isOpen && (
                            <tr className="d-expand-row">
                            <td colSpan={6}>
                                <div className="d-expand">
                                {detailLoadingId === d.id && !detail ? (
                                    <div className="d-expand__loading">Cargando detalle...</div>
                                ) : !detail ? (
                                    <div className="d-expand__loading">No se pudo cargar el detalle.</div>
                                ) : (
                                    <>
                                    <div className="d-expand__top">
                                        <div>
                                        <div className="d-expand__title">Deuda #{detail.id}</div>
                                        <div className="muted">
                                            Empleado: <b>{detail.employee_name}</b> · Tipo:{" "}
                                            <b>{typeLabel(detail.type)}</b>
                                        </div>
                                        {detail.note && (
                                            <div className="muted" style={{ marginTop: 4 }}>
                                            Nota: <b>{detail.note}</b>
                                            </div>
                                        )}
                                        </div>

                                        <div className="d-expand__kpis">
                                        <div className="d-kpi">
                                            <div className="muted">Monto inicial</div>
                                            <div className="d-kpi__v">{fmtMoney(detail.original_amount)}</div>
                                        </div>
                                        <div className="d-kpi">
                                            <div className="muted">Saldo</div>
                                            <div className="d-kpi__v">{fmtMoney(detail.balance)}</div>
                                        </div>
                                        <div className="d-kpi">
                                            <div className="muted">Estado</div>
                                            <div className="d-kpi__v">{detail.status}</div>
                                        </div>
                                        </div>
                                    </div>

                                    <div className="d-expand__grid">
                                        <div className="d-section">
                                        <div className="d-section__title">
                                            <Wallet size={16} /> Pagos
                                        </div>

                                        <ul className="d-list">
                                            {(detail.payments || []).map((p) => (
                                            <li key={p.id} className="d-li">
                                                <span className="d-pill">{p.method}</span>
                                                <span className="mono">{fmtMoney(p.amount)}</span>
                                                <span className="muted">{p.note || ""}</span>
                                                <span className="muted mono">
                                                {new Date(p.created_at).toLocaleString()}
                                                </span>
                                            </li>
                                            ))}
                                            {!detail.payments?.length && <li className="muted">No hay pagos.</li>}
                                        </ul>
                                        </div>

                                        <div className="d-section">
                                        <div className="d-section__title">
                                            <Save size={16} /> Registrar pago
                                            {!isOwner && <span className="d-pill neutral">solo OWNER</span>}
                                        </div>

                                        {isOwner && detail.status === "OPEN" ? (
                                            <div className="d-formline">
                                            <div className="d-field">
                                                <label>Monto</label>
                                                <input
                                                className="d-input"
                                                value={payForm.amount}
                                                onChange={(e) => setPayForm((x) => ({ ...x, amount: e.target.value }))}
                                                placeholder="Ej: 10000"
                                                />
                                            </div>

                                            <div className="d-field">
                                                <label>Método</label>
                                                <select
                                                className="d-input"
                                                value={payForm.method}
                                                onChange={(e) => setPayForm((x) => ({ ...x, method: e.target.value }))}
                                                >
                                                <option value="CASH">CASH</option>
                                                <option value="TRANSFER">TRANSFER</option>
                                                <option value="PAYROLL">PAYROLL</option>
                                                <option value="OTHER">OTHER</option>
                                                </select>
                                            </div>

                                            <div className="d-field d-span-2">
                                                <label>Nota</label>
                                                <input
                                                className="d-input"
                                                value={payForm.note}
                                                onChange={(e) => setPayForm((x) => ({ ...x, note: e.target.value }))}
                                                placeholder="Opcional"
                                                />
                                            </div>

                                            <button className="d-btn" type="button" onClick={addPayment}>
                                                <Save size={16} /> Guardar
                                            </button>
                                            </div>
                                        ) : (
                                            <div className="d-empty">
                                            {detail.status !== "OPEN"
                                                ? "La deuda está cerrada."
                                                : "Solo OWNER puede registrar pagos."}
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

                    {!filteredDebts.length && (
                    <tr>
                        <td colSpan={6} className="d-empty-row muted">
                        No hay deudas con esos filtros.
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