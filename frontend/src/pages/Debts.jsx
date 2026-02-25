    import { useEffect, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";

    export default function Debts() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [employees, setEmployees] = useState([]);
    const [debts, setDebts] = useState([]);
    const [selected, setSelected] = useState(null);

    const [filters, setFilters] = useState({ employeeId: "", status: "OPEN" });

    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    const [createForm, setCreateForm] = useState({
        employeeId: "",
        type: "ADVANCE",
        amount: "",
        note: ""
    });

    const [payForm, setPayForm] = useState({
        amount: "",
        method: "CASH",
        note: ""
    });

    const fetchAll = async () => {
        setLoading(true);
        setError("");
        setMsg("");
        try {
        const [eRes, dRes] = await Promise.all([
            api.get("/employees?all=1"),
            api.get(`/debts?status=${filters.status}${filters.employeeId ? `&employeeId=${filters.employeeId}` : ""}`)
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

    const openDebt = async (id) => {
        setError("");
        try {
        const { data } = await api.get(`/debts/${id}`);
        setSelected(data.data);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando deuda");
        }
    };

    const createDebt = async (e) => {
        e.preventDefault();
        setError("");
        setMsg("");
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload = {
            employeeId: Number(createForm.employeeId),
            type: createForm.type,
            amount: Number(createForm.amount),
            note: createForm.note.trim() || undefined
        };
        const { data } = await api.post("/debts", payload);
        setMsg("Deuda creada ✅");
        setCreateForm({ employeeId: "", type: "ADVANCE", amount: "", note: "" });
        await fetchAll();
        setSelected(data.data);
        } catch (e2) {
        setError(e2?.response?.data?.message || "Error creando deuda");
        }
    };

    const addPayment = async () => {
        if (!selected) return;
        setError("");
        setMsg("");
        if (!isOwner) return setError("Solo OWNER");

        try {
        const payload = {
            amount: Number(payForm.amount),
            method: payForm.method,
            note: payForm.note.trim() || undefined
        };
        const { data } = await api.post(`/debts/${selected.id}/payments`, payload);
        setSelected(data.data);
        setPayForm({ amount: "", method: "CASH", note: "" });
        setMsg("Pago registrado ✅");
        fetchAll();
        } catch (e) {
        setError(e?.response?.data?.message || "Error registrando pago");
        }
    };

    // descargar reportes (con Authorization)
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

    const exportDebtsExcel = () => {
        const q = `${filters.status ? `status=${filters.status}` : ""}${filters.employeeId ? `&employeeId=${filters.employeeId}` : ""}`;
        downloadFile(`/reports/debts.xlsx?${q}`, "deudas.xlsx");
    };

    const exportDebtsPdf = () => {
        const q = `${filters.status ? `status=${filters.status}` : ""}${filters.employeeId ? `&employeeId=${filters.employeeId}` : ""}`;
        downloadFile(`/reports/debts.pdf?${q}`, "deudas.pdf");
    };

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Deudas / Adelantos</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 12 }}>
            <label>
            Estado
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={{ padding: 8, marginTop: 6 }}>
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
            </select>
            </label>

            <label>
            Empleado
            <select value={filters.employeeId} onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))} style={{ padding: 8, marginTop: 6, minWidth: 240 }}>
                <option value="">(Todos)</option>
                {employees.filter((x) => x.is_active === 1).map((e) => (
                <option key={e.id} value={e.id}>
                    #{e.id} {e.full_name}
                </option>
                ))}
            </select>
            </label>

            <button onClick={fetchAll} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Recargar
            </button>

            <button onClick={exportDebtsExcel} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export Excel
            </button>

            <button onClick={exportDebtsPdf} style={{ padding: "8px 12px", cursor: "pointer" }}>
            Export PDF
            </button>
        </div>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        {isOwner && (
            <form onSubmit={createDebt} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <b>Crear deuda / adelanto</b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <label>
                Empleado
                <select value={createForm.employeeId} onChange={(e) => setCreateForm((x) => ({ ...x, employeeId: e.target.value }))} style={{ padding: 8, marginTop: 6, minWidth: 240 }}>
                    <option value="">-- Selecciona --</option>
                    {employees.filter((x) => x.is_active === 1).map((e) => (
                    <option key={e.id} value={e.id}>
                        #{e.id} {e.full_name}
                    </option>
                    ))}
                </select>
                </label>

                <label>
                Tipo
                <select value={createForm.type} onChange={(e) => setCreateForm((x) => ({ ...x, type: e.target.value }))} style={{ padding: 8, marginTop: 6 }}>
                    <option value="ADVANCE">ADVANCE</option>
                    <option value="LOAN">LOAN</option>
                    <option value="OTHER">OTHER</option>
                </select>
                </label>

                <label>
                Monto
                <input value={createForm.amount} onChange={(e) => setCreateForm((x) => ({ ...x, amount: e.target.value }))} style={{ padding: 8, marginTop: 6, width: 160 }} />
                </label>
            </div>

            <label style={{ display: "block", marginTop: 10 }}>
                Nota
                <input value={createForm.note} onChange={(e) => setCreateForm((x) => ({ ...x, note: e.target.value }))} style={{ padding: 8, marginTop: 6, width: "100%" }} />
            </label>

            <button type="submit" style={{ padding: "8px 12px", cursor: "pointer", marginTop: 10 }}>
                Crear
            </button>
            </form>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
            <h3>Listado</h3>
            {loading ? (
                <div>Cargando...</div>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
                <thead>
                    <tr>
                    {["ID", "Empleado", "Tipo", "Saldo", "Estado", "Acción"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                        {h}
                        </th>
                    ))}
                    </tr>
                </thead>
                <tbody>
                    {debts.map((d) => (
                    <tr key={d.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.id}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.employee_name}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.type}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.balance}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{d.status}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                        <button onClick={() => openDebt(d.id)} style={{ cursor: "pointer" }}>
                            Ver
                        </button>
                        </td>
                    </tr>
                    ))}
                    {!debts.length && (
                    <tr>
                        <td colSpan={6} style={{ padding: 10 }}>
                        No hay deudas.
                        </td>
                    </tr>
                    )}
                </tbody>
                </table>
            )}
            </div>

            <div>
            <h3>Detalle</h3>
            {!selected ? (
                <div>Selecciona una deuda.</div>
            ) : (
                <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <b>Deuda #{selected.id}</b>
                <div>Empleado: {selected.employee_name}</div>
                <div>Tipo: {selected.type}</div>
                <div>Monto inicial: {selected.original_amount}</div>
                <div>Saldo: {selected.balance}</div>
                <div>Estado: {selected.status}</div>
                {selected.note && <div>Nota: {selected.note}</div>}

                <hr />
                <b>Pagos</b>
                <ul>
                    {(selected.payments || []).map((p) => (
                    <li key={p.id}>
                        {p.method} — {p.amount} — {p.note || ""} — {new Date(p.created_at).toLocaleString()}
                    </li>
                    ))}
                    {!selected.payments?.length && <li>No hay pagos.</li>}
                </ul>

                {isOwner && selected.status === "OPEN" && (
                    <>
                    <hr />
                    <b>Registrar pago</b>
                    <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}>
                        <label>
                        Monto
                        <input value={payForm.amount} onChange={(e) => setPayForm((x) => ({ ...x, amount: e.target.value }))} style={{ padding: 8, marginTop: 6, width: 140 }} />
                        </label>

                        <label>
                        Método
                        <select value={payForm.method} onChange={(e) => setPayForm((x) => ({ ...x, method: e.target.value }))} style={{ padding: 8, marginTop: 6 }}>
                            <option value="CASH">CASH</option>
                            <option value="TRANSFER">TRANSFER</option>
                            <option value="PAYROLL">PAYROLL</option>
                            <option value="OTHER">OTHER</option>
                        </select>
                        </label>

                        <label style={{ minWidth: 240 }}>
                        Nota
                        <input value={payForm.note} onChange={(e) => setPayForm((x) => ({ ...x, note: e.target.value }))} style={{ padding: 8, marginTop: 6, width: "100%" }} />
                        </label>

                        <button onClick={addPayment} style={{ padding: "8px 12px", cursor: "pointer" }}>
                        Guardar pago
                        </button>
                    </div>
                    </>
                )}
                </div>
            )}
            </div>
        </div>
        </div>
    );
    }