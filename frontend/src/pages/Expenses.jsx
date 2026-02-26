    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";
    import "./expenses.css";

    import {
    RefreshCw,
    FileDown,
    Plus,
    Tags,
    Receipt,
    X,
    AlertTriangle,
    RotateCcw,
    Power,
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

    export default function Expenses() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [categories, setCategories] = useState([]);
    const [expenses, setExpenses] = useState([]);

    const [filters, setFilters] = useState({
        from: "2026-02-01",
        to: "2026-02-28",
        categoryId: "",
    });

    const [catName, setCatName] = useState("");
    const [expenseForm, setExpenseForm] = useState({
        categoryId: "",
        title: "",
        amount: "",
        expenseDate: isoToday(),
        vendor: "",
        paymentMethod: "CASH",
        note: "",
    });

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");

    const clearAlerts = () => {
        setMsg("");
        setError("");
    };

    const fetchAll = async () => {
        setLoading(true);
        clearAlerts();
        try {
        const q = new URLSearchParams({
            from: filters.from,
            to: filters.to,
        });
        if (filters.categoryId) q.set("categoryId", String(filters.categoryId));

        const [cRes, eRes] = await Promise.all([
            api.get("/expenses/categories?all=1"),
            api.get(`/expenses?${q.toString()}`),
        ]);

        setCategories(cRes.data.data || []);
        setExpenses(eRes.data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando gastos");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.from, filters.to, filters.categoryId]);

    const exportExcel = async () => {
        clearAlerts();
        try {
        const q = new URLSearchParams({ from: filters.from, to: filters.to });
        if (filters.categoryId) q.set("categoryId", String(filters.categoryId));
        await downloadWithAuth(`/reports/expenses.xlsx?${q.toString()}`, `gastos_${filters.from}_a_${filters.to}.xlsx`);
        setMsg("Excel listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando Excel");
        }
    };

    const exportPdf = async () => {
        clearAlerts();
        try {
        const q = new URLSearchParams({ from: filters.from, to: filters.to });
        if (filters.categoryId) q.set("categoryId", String(filters.categoryId));
        await downloadWithAuth(`/reports/expenses.pdf?${q.toString()}`, `gastos_${filters.from}_a_${filters.to}.pdf`);
        setMsg("PDF listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando PDF");
        }
    };

    const createCategory = async () => {
        clearAlerts();
        if (!isOwner) return setError("Solo OWNER");
        if (!catName.trim()) return setError("Nombre de categoría requerido");

        try {
        await api.post("/expenses/categories", { name: catName.trim() });
        setCatName("");
        setMsg("Categoría creada ✅");
        fetchAll();
        } catch (e) {
        setError(e?.response?.data?.message || "Error creando categoría");
        }
    };

    const createExpense = async (e) => {
        e.preventDefault();
        clearAlerts();
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload = {
            categoryId: expenseForm.categoryId ? Number(expenseForm.categoryId) : undefined,
            title: expenseForm.title.trim(),
            amount: Number(expenseForm.amount),
            expenseDate: expenseForm.expenseDate,
            vendor: expenseForm.vendor.trim() || undefined,
            note: expenseForm.note.trim() || undefined,
            paymentMethod: expenseForm.paymentMethod,
        };

        await api.post("/expenses", payload);

        setMsg("Gasto creado ✅");
        setExpenseForm((x) => ({
            categoryId: "",
            title: "",
            amount: "",
            expenseDate: x.expenseDate,
            vendor: "",
            paymentMethod: "CASH",
            note: "",
        }));
        fetchAll();
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error creando gasto");
        }
    };

    const deactivateExpense = async (id) => {
        if (!isOwner) return;
        if (!confirm("¿Desactivar gasto?")) return;
        clearAlerts();
        try {
        await api.delete(`/expenses/${id}`);
        setMsg("Gasto desactivado ✅");
        fetchAll();
        } catch (e) {
        setError(e?.response?.data?.message || "Error desactivando gasto");
        }
    };

    const reactivateExpense = async (id) => {
        if (!isOwner) return;
        clearAlerts();
        try {
        await api.patch(`/expenses/${id}/reactivate`);
        setMsg("Gasto reactivado ✅");
        fetchAll();
        } catch (e) {
        setError(e?.response?.data?.message || "Error reactivando gasto");
        }
    };

    const metrics = useMemo(() => {
        const total = expenses.reduce((a, x) => a + Number(x.amount ?? 0), 0);
        const count = expenses.length;
        const active = expenses.filter((x) => x.is_active === 1 || x.is_active === true).length;
        return { total, count, active };
    }, [expenses]);

    const activeCategories = useMemo(() => categories.filter((c) => c.is_active === 1), [categories]);

    return (
        <div className="exp-page">
        <div className="exp-head">
            <div>
            <div className="exp-title">Gastos</div>
            <div className="exp-subtitle">Categorías, registro de gastos y exportación de reportes.</div>
            </div>

            <div className="exp-actions">
            <button className="e-btn e-btn-ghost" onClick={fetchAll}>
                <RefreshCw size={16} /> Recargar
            </button>

            <button className="e-btn" onClick={exportExcel}>
                <FileDown size={16} /> Excel
            </button>

            <button className="e-btn e-btn-ghost" onClick={exportPdf}>
                <FileDown size={16} /> PDF
            </button>
            </div>
        </div>

        {(error || msg) && (
            <div className={`e-alert ${error ? "e-alert--error" : "e-alert--ok"}`}>
            <div className="e-alert__text">
                {error ? <AlertTriangle size={16} /> : null}
                {error || msg}
            </div>
            <button className="e-alert__close" onClick={clearAlerts}>✕</button>
            </div>
        )}

        <div className="e-metrics">
            <div className="e-card e-metric">
            <div className="e-metric__label">Gastos (rango)</div>
            <div className="e-metric__value">{metrics.count}</div>
            </div>
            <div className="e-card e-metric">
            <div className="e-metric__label">Total (rango)</div>
            <div className="e-metric__value">{fmtMoney(metrics.total)}</div>
            </div>
            <div className="e-card e-metric">
            <div className="e-metric__label">Activos</div>
            <div className="e-metric__value">{metrics.active}</div>
            </div>
        </div>

        {/* Filtros */}
        <div className="e-card">
            <div className="e-card__head">
            <div className="e-card__title">Filtros</div>
            <div className="e-chip">Reportes usan estos filtros</div>
            </div>

            <div className="e-filters">
            <div className="e-field">
                <label>Desde</label>
                <input
                className="e-input"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                />
            </div>

            <div className="e-field">
                <label>Hasta</label>
                <input
                className="e-input"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                />
            </div>

            <div className="e-field e-span-2">
                <label>Categoría</label>
                <select
                className="e-input"
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
                >
                <option value="">(Todas)</option>
                {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                    #{c.id} {c.name}
                    </option>
                ))}
                </select>
            </div>
            </div>
        </div>

        {/* Categorías + Crear gasto */}
        <div className="e-two">
            <div className="e-card">
            <div className="e-card__head">
                <div className="e-card__title">
                <Tags size={18} /> Categorías
                </div>
                {!isOwner && <div className="e-chip">solo OWNER</div>}
            </div>

            <div className="e-tags">
                {categories.map((c) => (
                <span key={c.id} className={`e-tag ${c.is_active ? "" : "off"}`}>
                    #{c.id} {c.name} {c.is_active ? "" : "· inactiva"}
                </span>
                ))}
                {!categories.length && <div className="muted">Sin categorías.</div>}
            </div>

            <div className="e-divider" />

            <div className="e-inline">
                <div className="e-field e-span-2">
                <label>Nueva categoría</label>
                <input
                    className="e-input"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Ej: Combustible, Mantenimiento..."
                    disabled={!isOwner}
                />
                </div>
                <button className="e-btn" type="button" onClick={createCategory} disabled={!isOwner}>
                <Plus size={16} /> Crear
                </button>
            </div>
            </div>

            <div className="e-card">
            <div className="e-card__head">
                <div className="e-card__title">
                <Receipt size={18} /> Crear gasto
                </div>
                {!isOwner && <div className="e-chip">solo OWNER</div>}
            </div>

            {isOwner ? (
                <form onSubmit={createExpense} className="e-form">
                <div className="e-grid">
                    <div className="e-field e-span-2">
                    <label>Categoría</label>
                    <select
                        className="e-input"
                        value={expenseForm.categoryId}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, categoryId: e.target.value }))}
                    >
                        <option value="">(Sin categoría)</option>
                        {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                            #{c.id} {c.name}
                        </option>
                        ))}
                    </select>
                    </div>

                    <div className="e-field e-span-2">
                    <label>Título</label>
                    <input
                        className="e-input"
                        value={expenseForm.title}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, title: e.target.value }))}
                        placeholder="Ej: Compra de diesel"
                    />
                    </div>

                    <div className="e-field">
                    <label>Monto</label>
                    <input
                        className="e-input"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, amount: e.target.value }))}
                        placeholder="Ej: 35000"
                    />
                    </div>

                    <div className="e-field">
                    <label>Fecha</label>
                    <input
                        className="e-input"
                        type="date"
                        value={expenseForm.expenseDate}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, expenseDate: e.target.value }))}
                    />
                    </div>

                    <div className="e-field e-span-2">
                    <label>Proveedor</label>
                    <input
                        className="e-input"
                        value={expenseForm.vendor}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, vendor: e.target.value }))}
                        placeholder="Ej: Estación X / Ferretería Y"
                    />
                    </div>

                    <div className="e-field">
                    <label>Método</label>
                    <select
                        className="e-input"
                        value={expenseForm.paymentMethod}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, paymentMethod: e.target.value }))}
                    >
                        <option value="CASH">CASH</option>
                        <option value="TRANSFER">TRANSFER</option>
                        <option value="CARD">CARD</option>
                        <option value="OTHER">OTHER</option>
                    </select>
                    </div>

                    <div className="e-field e-span-2">
                    <label>Nota</label>
                    <input
                        className="e-input"
                        value={expenseForm.note}
                        onChange={(e) => setExpenseForm((x) => ({ ...x, note: e.target.value }))}
                        placeholder="Opcional"
                    />
                    </div>
                </div>

                <div className="e-form__actions">
                    <button className="e-btn" type="submit">
                    <Plus size={16} /> Guardar gasto
                    </button>
                    <button
                    className="e-btn e-btn-ghost"
                    type="button"
                    onClick={() =>
                        setExpenseForm((x) => ({
                        ...x,
                        categoryId: "",
                        title: "",
                        amount: "",
                        vendor: "",
                        paymentMethod: "CASH",
                        note: "",
                        }))
                    }
                    >
                    <X size={16} /> Limpiar
                    </button>
                </div>
                </form>
            ) : (
                <div className="e-empty">
                Este módulo solo permite crear gastos con rol <b>OWNER</b>.
                </div>
            )}
            </div>
        </div>

        {/* Tabla */}
        <div className="e-card" style={{ marginTop: 12 }}>
            <div className="e-card__head">
            <div className="e-card__title">Listado</div>
            <div className="e-chip">
                {loading ? "Cargando..." : `${expenses.length} registros`}
            </div>
            </div>

            {loading ? (
            <div className="e-skeleton">Cargando...</div>
            ) : (
            <div className="e-table-wrap">
                <table className="e-table">
                <thead>
                    <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Título</th>
                    <th>Proveedor</th>
                    <th>Método</th>
                    <th className="right">Monto</th>
                    <th>Activo</th>
                    <th className="right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {expenses.map((x) => {
                    const active = x.is_active === 1 || x.is_active === true;
                    return (
                        <tr key={x.id} className={!active ? "off" : ""}>
                        <td className="mono">{x.id}</td>
                        <td className="mono">{x.expense_date}</td>
                        <td>{x.category_name || "Sin categoría"}</td>
                        <td>{x.title}</td>
                        <td>{x.vendor || ""}</td>
                        <td>
                            <span className="e-pill">{x.payment_method}</span>
                        </td>
                        <td className="right mono">{fmtMoney(x.amount)}</td>
                        <td>
                            <span className={`e-pill ${active ? "ok" : "bad"}`}>{active ? "Sí" : "No"}</span>
                        </td>
                        <td className="right">
                            {isOwner && (
                            active ? (
                                <button className="e-btn e-btn-mini e-btn-danger" onClick={() => deactivateExpense(x.id)}>
                                <Power size={16} /> Desactivar
                                </button>
                            ) : (
                                <button className="e-btn e-btn-mini e-btn-ghost" onClick={() => reactivateExpense(x.id)}>
                                <RotateCcw size={16} /> Reactivar
                                </button>
                            )
                            )}
                        </td>
                        </tr>
                    );
                    })}
                    {!expenses.length && (
                    <tr>
                        <td colSpan={9} className="e-empty-row muted">
                        No hay gastos en el rango.
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