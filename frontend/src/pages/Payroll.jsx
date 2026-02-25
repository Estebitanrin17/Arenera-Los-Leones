    import { useEffect, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";

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
        grossAmount: ""
    });

    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        api.get("/employees?all=1").then((r) => setEmployees(r.data.data || [])).catch(() => {});
    }, []);

    const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const run = async (e) => {
        e.preventDefault();
        setError("");
        setMsg("");
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload =
            form.mode === "AUTO"
            ? {
                periodFrom: form.periodFrom,
                periodTo: form.periodTo,
                note: form.note || undefined
                }
            : {
                periodFrom: form.periodFrom,
                periodTo: form.periodTo,
                note: form.note || undefined,
                employees: [{ employeeId: Number(form.employeeId), grossAmount: Number(form.grossAmount || 0) }]
                };

        const { data } = await api.post("/payroll/run", payload);
        setResult(data.data);
        setMsg("Nómina generada ✅");
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error generando nómina");
        }
    };

    const downloadFile = async (path, fallbackName) => {
        setError("");
        try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:3000/api${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

        const blob = await res.blob();
        const cd = res.headers.get("content-disposition") || "";
        const match = /filename="([^"]+)"/.exec(cd);
        const filename = match?.[1] || fallbackName || "reporte";

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        } catch (e) {
        setError(e?.message || "Error descargando");
        }
    };

    const exportExcel = () => {
        if (!result?.id) return;
        downloadFile(`/reports/payroll/${result.id}.xlsx`, `nomina_${result.id}.xlsx`);
    };

    const exportPdf = () => {
        if (!result?.id) return;
        downloadFile(`/reports/payroll/${result.id}/pdf`, `nomina_${result.id}.pdf`);
    };

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Nómina</h2>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        <form onSubmit={run} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <b>Generar nómina</b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <label>
                Desde
                <input value={form.periodFrom} onChange={onChange("periodFrom")} style={{ padding: 8, marginTop: 6 }} />
            </label>
            <label>
                Hasta
                <input value={form.periodTo} onChange={onChange("periodTo")} style={{ padding: 8, marginTop: 6 }} />
            </label>
            <label style={{ minWidth: 260 }}>
                Nota
                <input value={form.note} onChange={onChange("note")} style={{ padding: 8, marginTop: 6, width: "100%" }} />
            </label>
            <label>
                Modo
                <select value={form.mode} onChange={onChange("mode")} style={{ padding: 8, marginTop: 6 }}>
                <option value="AUTO">AUTO (todos)</option>
                <option value="MANUAL">MANUAL (uno)</option>
                </select>
            </label>
            </div>

            {form.mode === "MANUAL" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <label style={{ minWidth: 260 }}>
                Empleado
                <select value={form.employeeId} onChange={onChange("employeeId")} style={{ padding: 8, marginTop: 6, width: "100%" }}>
                    <option value="">-- Selecciona --</option>
                    {employees.filter((x) => x.is_active === 1).map((e) => (
                    <option key={e.id} value={e.id}>
                        #{e.id} {e.full_name}
                    </option>
                    ))}
                </select>
                </label>

                <label>
                Bruto
                <input value={form.grossAmount} onChange={onChange("grossAmount")} style={{ padding: 8, marginTop: 6, width: 160 }} />
                </label>
            </div>
            )}

            <button type="submit" style={{ padding: "8px 12px", cursor: "pointer", marginTop: 10 }}>
            Ejecutar nómina
            </button>
        </form>

        {!result ? (
            <div>Ejecuta una nómina para ver el resultado.</div>
        ) : (
            <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                <div>
                <b>Payroll Run #{result.id}</b>
                <div>
                    Periodo: {String(result.period_from)} a {String(result.period_to)}
                </div>
                {result.note && <div>Nota: {result.note}</div>}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                <button onClick={exportExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
                    Export Excel
                </button>
                <button onClick={exportPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
                    Export PDF
                </button>
                </div>
            </div>

            <hr />

            <b>Items</b>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", marginTop: 10 }}>
                <thead>
                <tr>
                    {["EmpleadoID", "Bruto", "Descuentos", "Neto"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                        {h}
                    </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {(result.items || []).map((it) => (
                    <tr key={it.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{it.employee_id}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{it.gross_amount}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{it.total_deductions}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{it.net_amount}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        )}
        </div>
    );
    }