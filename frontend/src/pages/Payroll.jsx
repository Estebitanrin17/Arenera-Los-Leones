    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";
    import "./payroll.css";

    import {
    RefreshCw,
    FileDown,
    Play,
    BadgeDollarSign,
    Users,
    ShieldAlert,
    Settings2,
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

    export default function Payroll() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [employees, setEmployees] = useState([]);
    const [result, setResult] = useState(null);

    const [form, setForm] = useState({
        periodFrom: "2026-02-01",
        periodTo: "2026-02-15",
        note: "Quincena",
        mode: "AUTO", // AUTO = usa base_salary de todos, MANUAL = seleccionas uno
        employeeId: "",
        grossAmount: "",
    });

    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [running, setRunning] = useState(false);
    const [loadingEmp, setLoadingEmp] = useState(true);

    const clearAlerts = () => {
        setError("");
        setMsg("");
    };

    useEffect(() => {
        setLoadingEmp(true);
        api
        .get("/employees?all=1")
        .then((r) => setEmployees(r.data.data || []))
        .catch(() => {})
        .finally(() => setLoadingEmp(false));
    }, []);

    const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const run = async (e) => {
        e.preventDefault();
        clearAlerts();
        if (!isOwner) return setError("Solo OWNER");

        try {
        setRunning(true);

        const payload =
            form.mode === "AUTO"
            ? {
                periodFrom: form.periodFrom,
                periodTo: form.periodTo,
                note: form.note || undefined,
                }
            : {
                periodFrom: form.periodFrom,
                periodTo: form.periodTo,
                note: form.note || undefined,
                employees: [
                    {
                    employeeId: Number(form.employeeId),
                    grossAmount: Number(form.grossAmount || 0),
                    },
                ],
                };

        const { data } = await api.post("/payroll/run", payload);
        setResult(data.data);
        setMsg("Nómina generada ✅");
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error generando nómina");
        } finally {
        setRunning(false);
        }
    };

    const exportExcel = async () => {
        if (!result?.id) return;
        clearAlerts();
        try {
        await downloadWithAuth(`/reports/payroll/${result.id}.xlsx`, `nomina_${result.id}.xlsx`);
        setMsg("Excel listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando Excel");
        }
    };

    const exportPdf = async () => {
        if (!result?.id) return;
        clearAlerts();
        try {
        await downloadWithAuth(`/reports/payroll/${result.id}/pdf`, `nomina_${result.id}.pdf`);
        setMsg("PDF listo ✅");
        } catch (e) {
        setError(e?.message || "Error descargando PDF");
        }
    };

    const resetToToday = () => {
        setForm((f) => ({
        ...f,
        periodFrom: isoToday(),
        periodTo: isoToday(),
        }));
    };

    const activeEmployees = useMemo(() => employees.filter((x) => x.is_active === 1), [employees]);

    const metrics = useMemo(() => {
        if (!result?.items?.length) return { count: 0, gross: 0, deductions: 0, net: 0 };
        const count = result.items.length;
        const gross = result.items.reduce((a, it) => a + Number(it.gross_amount ?? 0), 0);
        const deductions = result.items.reduce((a, it) => a + Number(it.total_deductions ?? 0), 0);
        const net = result.items.reduce((a, it) => a + Number(it.net_amount ?? 0), 0);
        return { count, gross, deductions, net };
    }, [result]);

    return (
        <div className="pay-page">
        <div className="pay-head">
            <div>
            <div className="pay-title">
                <BadgeDollarSign size={20} /> Nómina
            </div>
            <div className="pay-subtitle">Genera payroll runs, descuentos por deudas y exporta reportes.</div>
            </div>

            <div className="pay-actions">
            <button className="p-btn p-btn-ghost" type="button" onClick={resetToToday} title="Poner fechas hoy">
                <RefreshCw size={16} /> Hoy
            </button>
            </div>
        </div>

        {(error || msg) && (
            <div className={`p-alert ${error ? "p-alert--error" : "p-alert--ok"}`}>
            <div className="p-alert__text">
                {error ? <ShieldAlert size={16} /> : null}
                {error || msg}
            </div>
            <button className="p-alert__close" onClick={clearAlerts}>
                ✕
            </button>
            </div>
        )}

        <div className="p-metrics">
            <div className="p-card p-metric">
            <div className="p-metric__label">Empleados pagados</div>
            <div className="p-metric__value">{metrics.count}</div>
            </div>
            <div className="p-card p-metric">
            <div className="p-metric__label">Bruto total</div>
            <div className="p-metric__value">{fmtMoney(metrics.gross)}</div>
            </div>
            <div className="p-card p-metric">
            <div className="p-metric__label">Descuentos</div>
            <div className="p-metric__value">{fmtMoney(metrics.deductions)}</div>
            </div>
            <div className="p-card p-metric">
            <div className="p-metric__label">Neto total</div>
            <div className="p-metric__value">{fmtMoney(metrics.net)}</div>
            </div>
        </div>

        <div className="p-card">
            <div className="p-card__head">
            <div className="p-card__title">
                <Settings2 size={18} /> Generar nómina
            </div>
            {!isOwner && <div className="p-chip">solo OWNER</div>}
            </div>

            {isOwner ? (
            <form className="p-form" onSubmit={run}>
                <div className="p-grid">
                <div className="p-field">
                    <label>Desde</label>
                    <input className="p-input" type="date" value={form.periodFrom} onChange={onChange("periodFrom")} />
                </div>

                <div className="p-field">
                    <label>Hasta</label>
                    <input className="p-input" type="date" value={form.periodTo} onChange={onChange("periodTo")} />
                </div>

                <div className="p-field p-span-2">
                    <label>Nota</label>
                    <input className="p-input" value={form.note} onChange={onChange("note")} placeholder="Ej: Quincena / Semana / Mes" />
                </div>

                <div className="p-field">
                    <label>Modo</label>
                    <select className="p-input" value={form.mode} onChange={onChange("mode")}>
                    <option value="AUTO">AUTO (todos)</option>
                    <option value="MANUAL">MANUAL (uno)</option>
                    </select>
                    <div className="p-help">
                    {form.mode === "AUTO"
                        ? "AUTO usa el salario base de todos los empleados activos."
                        : "MANUAL permite correr nómina para 1 empleado con bruto personalizado."}
                    </div>
                </div>

                <div className="p-field p-span-3">
                    <label>Empleados activos</label>
                    <div className="p-chip">
                    <Users size={16} /> {loadingEmp ? "Cargando..." : `${activeEmployees.length} activos`}
                    </div>
                </div>

                {form.mode === "MANUAL" && (
                    <>
                    <div className="p-field p-span-2">
                        <label>Empleado</label>
                        <select className="p-input" value={form.employeeId} onChange={onChange("employeeId")}>
                        <option value="">-- Selecciona --</option>
                        {activeEmployees.map((e) => (
                            <option key={e.id} value={e.id}>
                            #{e.id} {e.full_name}
                            </option>
                        ))}
                        </select>
                    </div>

                    <div className="p-field">
                        <label>Bruto</label>
                        <input className="p-input" value={form.grossAmount} onChange={onChange("grossAmount")} placeholder="Ej: 1600000" />
                    </div>
                    </>
                )}
                </div>

                <div className="p-form__actions">
                <button className="p-btn" type="submit" disabled={running}>
                    <Play size={16} /> {running ? "Ejecutando..." : "Ejecutar nómina"}
                </button>
                </div>
            </form>
            ) : (
            <div className="p-empty">
                Solo el rol <b>OWNER</b> puede ejecutar nóminas.
            </div>
            )}
        </div>

        <div className="p-card" style={{ marginTop: 12 }}>
            <div className="p-card__head">
            <div className="p-card__title">Resultado</div>

            <div className="p-row-actions">
                <button className="p-btn" type="button" onClick={exportExcel} disabled={!result?.id}>
                <FileDown size={16} /> Excel
                </button>
                <button className="p-btn p-btn-ghost" type="button" onClick={exportPdf} disabled={!result?.id}>
                <FileDown size={16} /> PDF
                </button>
            </div>
            </div>

            {!result ? (
            <div className="p-empty">Ejecuta una nómina para ver el resultado.</div>
            ) : (
            <>
                <div className="p-summary">
                <div>
                    <b>Payroll Run #{result.id}</b>
                    <div className="muted">
                    Periodo: <b>{String(result.period_from)}</b> a <b>{String(result.period_to)}</b>
                    </div>
                    {result.note && <div className="muted">Nota: <b>{result.note}</b></div>}
                </div>

                <div className="p-summary__chips">
                    <span className="p-pill">Items: {metrics.count}</span>
                    <span className="p-pill">Bruto: {fmtMoney(metrics.gross)}</span>
                    <span className="p-pill">Descuentos: {fmtMoney(metrics.deductions)}</span>
                    <span className="p-pill">Neto: {fmtMoney(metrics.net)}</span>
                </div>
                </div>

                <div className="p-table-wrap">
                <table className="p-table">
                    <thead>
                    <tr>
                        <th>EmpleadoID</th>
                        <th className="right">Bruto</th>
                        <th className="right">Descuentos</th>
                        <th className="right">Neto</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(result.items || []).map((it) => (
                        <tr key={it.id}>
                        <td className="mono">{it.employee_id}</td>
                        <td className="right mono">{fmtMoney(it.gross_amount)}</td>
                        <td className="right mono">{fmtMoney(it.total_deductions)}</td>
                        <td className="right mono">
                            <b>{fmtMoney(it.net_amount)}</b>
                        </td>
                        </tr>
                    ))}
                    {!result.items?.length && (
                        <tr>
                        <td colSpan={4} className="p-empty-row muted">
                            Sin items para este run.
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </>
            )}
        </div>
        </div>
    );
    }