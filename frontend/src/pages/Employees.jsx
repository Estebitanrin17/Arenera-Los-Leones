    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";
    import "./employees.css";

    import {
    Users,
    RefreshCw,
    Search,
    Plus,
    Save,
    X,
    Pencil,
    Power,
    RotateCcw,
    ShieldAlert,
    } from "lucide-react";

    function fmtMoney(v) {
    const n = Number(v ?? 0);
    if (!Number.isFinite(n)) return String(v ?? "");
    return n.toLocaleString("es-CO");
    }

    function freqLabel(v) {
    const s = String(v || "").toUpperCase();
    if (s === "DAILY") return "Diario";
    if (s === "WEEKLY") return "Semanal";
    if (s === "BIWEEKLY") return "Quincenal";
    if (s === "MONTHLY") return "Mensual";
    return s;
    }

    export default function Employees() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    const [showAll, setShowAll] = useState(false);
    const [q, setQ] = useState("");

    const [form, setForm] = useState({
        id: null,
        full_name: "",
        document_id: "",
        phone: "",
        base_salary: "",
        pay_frequency: "MONTHLY",
    });

    const clearAlerts = () => {
        setError("");
        setMsg("");
    };

    const fetchEmployees = async () => {
        setLoading(true);
        clearAlerts();
        try {
        const { data } = await api.get(`/employees${showAll ? "?all=1" : ""}`);
        setItems(data.data || []);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando empleados");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAll]);

    const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const reset = () =>
        setForm({
        id: null,
        full_name: "",
        document_id: "",
        phone: "",
        base_salary: "",
        pay_frequency: "MONTHLY",
        });

    const submit = async (e) => {
        e.preventDefault();
        clearAlerts();
        if (!isOwner) return setError("Solo OWNER");

        const payload = {
        full_name: form.full_name.trim(),
        document_id: form.document_id.trim() || undefined,
        phone: form.phone.trim() || undefined,
        base_salary: Number(form.base_salary || 0),
        pay_frequency: form.pay_frequency,
        };

        try {
        if (form.id) {
            await api.put(`/employees/${form.id}`, payload);
            setMsg("Empleado actualizado ✅");
        } else {
            await api.post("/employees", payload);
            setMsg("Empleado creado ✅");
        }
        reset();
        fetchEmployees();
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error guardando empleado");
        }
    };

    const edit = (emp) => {
        clearAlerts();
        setForm({
        id: emp.id,
        full_name: emp.full_name,
        document_id: emp.document_id || "",
        phone: emp.phone || "",
        base_salary: String(emp.base_salary ?? ""),
        pay_frequency: emp.pay_frequency || "MONTHLY",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const deactivate = async (id) => {
        if (!isOwner) return;
        if (!confirm("¿Desactivar empleado?")) return;
        clearAlerts();
        try {
        await api.delete(`/employees/${id}`);
        setMsg("Empleado desactivado ✅");
        fetchEmployees();
        } catch (e) {
        setError(e?.response?.data?.message || "Error desactivando empleado");
        }
    };

    const reactivate = async (id) => {
        if (!isOwner) return;
        clearAlerts();
        try {
        await api.patch(`/employees/${id}/reactivate`);
        setMsg("Empleado reactivado ✅");
        fetchEmployees();
        } catch (e) {
        setError(e?.response?.data?.message || "Error reactivando empleado");
        }
    };

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return items;

        return items.filter((e) => {
        const name = String(e.full_name || "").toLowerCase();
        const doc = String(e.document_id || "").toLowerCase();
        const phone = String(e.phone || "").toLowerCase();
        const id = String(e.id || "");
        return name.includes(s) || doc.includes(s) || phone.includes(s) || id.includes(s);
        });
    }, [items, q]);

    const metrics = useMemo(() => {
        const total = items.length;
        const active = items.filter((e) => e.is_active === 1 || e.is_active === true).length;
        const inactive = total - active;
        return { total, active, inactive };
    }, [items]);

    return (
        <div className="emp-page">
        <div className="emp-head">
            <div>
            <div className="emp-title">
                <Users size={20} /> Empleados
            </div>
            <div className="emp-subtitle">Gestión de empleados, salarios y estado.</div>
            </div>

            <div className="emp-actions">
            <label className="emp-toggle">
                <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                />
                <span>Ver inactivos</span>
            </label>

            <button className="emp-btn emp-btn-ghost" onClick={fetchEmployees}>
                <RefreshCw size={16} /> Recargar
            </button>
            </div>
        </div>

        {(error || msg) && (
            <div className={`emp-alert ${error ? "emp-alert--error" : "emp-alert--ok"}`}>
            <div className="emp-alert__text">
                {error ? <ShieldAlert size={16} /> : null}
                {error || msg}
            </div>
            <button className="emp-alert__close" onClick={clearAlerts}>
                ✕
            </button>
            </div>
        )}

        <div className="emp-metrics">
            <div className="emp-card emp-metric">
            <div className="emp-metric__label">Total</div>
            <div className="emp-metric__value">{metrics.total}</div>
            </div>
            <div className="emp-card emp-metric">
            <div className="emp-metric__label">Activos</div>
            <div className="emp-metric__value">{metrics.active}</div>
            </div>
            <div className="emp-card emp-metric">
            <div className="emp-metric__label">Inactivos</div>
            <div className="emp-metric__value">{metrics.inactive}</div>
            </div>
        </div>

        {/* Form */}
        <div className="emp-two">
            <div className="emp-card">
            <div className="emp-card__head">
                <div className="emp-card__title">
                <Plus size={18} /> {form.id ? "Editar empleado" : "Crear empleado"}
                </div>
                {!isOwner && <div className="emp-chip">solo OWNER</div>}
            </div>

            {isOwner ? (
                <form className="emp-form" onSubmit={submit}>
                <div className="emp-grid">
                    <div className="emp-field emp-span-2">
                    <label>Nombre completo</label>
                    <input
                        className="emp-input"
                        placeholder="Ej: Juan Pérez"
                        value={form.full_name}
                        onChange={onChange("full_name")}
                    />
                    </div>

                    <div className="emp-field">
                    <label>Documento</label>
                    <input
                        className="emp-input"
                        placeholder="Opcional"
                        value={form.document_id}
                        onChange={onChange("document_id")}
                    />
                    </div>

                    <div className="emp-field">
                    <label>Teléfono</label>
                    <input
                        className="emp-input"
                        placeholder="Opcional"
                        value={form.phone}
                        onChange={onChange("phone")}
                    />
                    </div>

                    <div className="emp-field">
                    <label>Salario base</label>
                    <input
                        className="emp-input"
                        placeholder="Ej: 1600000"
                        value={form.base_salary}
                        onChange={onChange("base_salary")}
                    />
                    </div>

                    <div className="emp-field">
                    <label>Frecuencia</label>
                    <select className="emp-input" value={form.pay_frequency} onChange={onChange("pay_frequency")}>
                        <option value="DAILY">DAILY</option>
                        <option value="WEEKLY">WEEKLY</option>
                        <option value="BIWEEKLY">BIWEEKLY</option>
                        <option value="MONTHLY">MONTHLY</option>
                    </select>
                    </div>
                </div>

                <div className="emp-form__actions">
                    <button className="emp-btn" type="submit">
                    <Save size={16} /> Guardar
                    </button>
                    <button className="emp-btn emp-btn-ghost" type="button" onClick={reset}>
                    <X size={16} /> Limpiar
                    </button>
                </div>
                </form>
            ) : (
                <div className="emp-empty">
                Solo el rol <b>OWNER</b> puede crear o editar empleados.
                </div>
            )}
            </div>

            <div className="emp-card">
            <div className="emp-card__head">
                <div className="emp-card__title">
                <Search size={18} /> Buscar
                </div>
                <div className="emp-chip">{loading ? "Cargando..." : `${filtered.length} resultados`}</div>
            </div>

            <div className="emp-search">
                <Search size={16} />
                <input
                className="emp-input emp-input-tight"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, doc, teléfono o ID..."
                />
            </div>

            <div className="emp-help muted">
                Tip: usa “Ver inactivos” para administrar reactivaciones.
            </div>
            </div>
        </div>

        {/* Tabla */}
        <div className="emp-card" style={{ marginTop: 12 }}>
            <div className="emp-card__head">
            <div className="emp-card__title">Listado</div>
            <div className="emp-chip">{loading ? "Cargando..." : `${filtered.length} registros`}</div>
            </div>

            {loading ? (
            <div className="emp-skeleton">Cargando...</div>
            ) : (
            <div className="emp-table-wrap">
                <table className="emp-table">
                <thead>
                    <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Teléfono</th>
                    <th className="right">Salario</th>
                    <th>Frecuencia</th>
                    <th>Activo</th>
                    <th className="right">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((e) => {
                    const active = e.is_active === 1 || e.is_active === true;
                    return (
                        <tr key={e.id} className={!active ? "off" : ""}>
                        <td className="mono">{e.id}</td>
                        <td>{e.full_name}</td>
                        <td className="mono">{e.document_id || ""}</td>
                        <td className="mono">{e.phone || ""}</td>
                        <td className="right mono">{fmtMoney(e.base_salary)}</td>
                        <td>
                            <span className="emp-pill">{freqLabel(e.pay_frequency)}</span>
                        </td>
                        <td>
                            <span className={`emp-pill ${active ? "ok" : "bad"}`}>{active ? "Sí" : "No"}</span>
                        </td>
                        <td className="right">
                            {isOwner && (
                            <div className="emp-row-actions">
                                <button className="emp-btn emp-btn-mini emp-btn-ghost" onClick={() => edit(e)}>
                                <Pencil size={16} /> Editar
                                </button>

                                {active ? (
                                <button className="emp-btn emp-btn-mini emp-btn-danger" onClick={() => deactivate(e.id)}>
                                    <Power size={16} /> Desactivar
                                </button>
                                ) : (
                                <button className="emp-btn emp-btn-mini emp-btn-ghost" onClick={() => reactivate(e.id)}>
                                    <RotateCcw size={16} /> Reactivar
                                </button>
                                )}
                            </div>
                            )}
                        </td>
                        </tr>
                    );
                    })}
                    {!filtered.length && (
                    <tr>
                        <td colSpan={8} className="emp-empty-row muted">
                        No hay empleados.
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