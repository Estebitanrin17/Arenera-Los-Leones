    import { useEffect, useState } from "react";
    import { api } from "../services/api";
    import { getUser } from "../services/auth";

    export default function Employees() {
    const user = getUser();
    const isOwner = user?.role === "OWNER";

    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(true);

    const [showAll, setShowAll] = useState(false);

    const [form, setForm] = useState({
        id: null,
        full_name: "",
        document_id: "",
        phone: "",
        base_salary: "",
        pay_frequency: "MONTHLY"
    });

    const fetchEmployees = async () => {
        setLoading(true);
        setError("");
        setMsg("");
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
        pay_frequency: "MONTHLY"
        });

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setMsg("");

        if (!isOwner) return setError("Solo OWNER");

        const payload = {
        full_name: form.full_name.trim(),
        document_id: form.document_id.trim() || undefined,
        phone: form.phone.trim() || undefined,
        base_salary: Number(form.base_salary || 0),
        pay_frequency: form.pay_frequency
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
        setForm({
        id: emp.id,
        full_name: emp.full_name,
        document_id: emp.document_id || "",
        phone: emp.phone || "",
        base_salary: String(emp.base_salary),
        pay_frequency: emp.pay_frequency
        });
    };

    const deactivate = async (id) => {
        if (!isOwner) return;
        if (!confirm("¿Desactivar empleado?")) return;
        await api.delete(`/employees/${id}`);
        fetchEmployees();
    };

    const reactivate = async (id) => {
        if (!isOwner) return;
        await api.patch(`/employees/${id}/reactivate`);
        fetchEmployees();
    };

    return (
        <div style={{ fontFamily: "system-ui" }}>
        <h2>Empleados</h2>

        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Ver inactivos
        </label>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}
        {msg && <div style={{ color: "green", marginBottom: 10 }}>{msg}</div>}

        {isOwner && (
            <form
            onSubmit={submit}
            style={{
                display: "grid",
                gap: 10,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 8,
                marginBottom: 16,
                maxWidth: 700
            }}
            >
            <b>{form.id ? "Editar empleado" : "Crear empleado"}</b>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                placeholder="Nombre completo"
                value={form.full_name}
                onChange={onChange("full_name")}
                style={{ padding: 10, width: 260 }}
                />
                <input
                placeholder="Documento"
                value={form.document_id}
                onChange={onChange("document_id")}
                style={{ padding: 10, width: 160 }}
                />
                <input
                placeholder="Teléfono"
                value={form.phone}
                onChange={onChange("phone")}
                style={{ padding: 10, width: 160 }}
                />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                placeholder="Salario base"
                value={form.base_salary}
                onChange={onChange("base_salary")}
                style={{ padding: 10, width: 160 }}
                />
                <select value={form.pay_frequency} onChange={onChange("pay_frequency")} style={{ padding: 10 }}>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="BIWEEKLY">BIWEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" style={{ padding: "8px 12px", cursor: "pointer" }}>
                Guardar
                </button>
                <button type="button" onClick={reset} style={{ padding: "8px 12px", cursor: "pointer" }}>
                Limpiar
                </button>
            </div>
            </form>
        )}

        {loading ? (
            <div>Cargando...</div>
        ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
            <thead>
                <tr>
                {["ID", "Nombre", "Documento", "Teléfono", "Salario", "Frecuencia", "Activo", "Acciones"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                    {h}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody>
                {items.map((e) => (
                <tr key={e.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.id}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.full_name}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.document_id || ""}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.phone || ""}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.base_salary}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.pay_frequency}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{e.is_active ? "Sí" : "No"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {isOwner && (
                        <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => edit(e)} style={{ cursor: "pointer" }}>
                            Editar
                        </button>
                        {e.is_active ? (
                            <button onClick={() => deactivate(e.id)} style={{ cursor: "pointer" }}>
                            Desactivar
                            </button>
                        ) : (
                            <button onClick={() => reactivate(e.id)} style={{ cursor: "pointer" }}>
                            Reactivar
                            </button>
                        )}
                        </div>
                    )}
                    </td>
                </tr>
                ))}
                {!items.length && (
                <tr>
                    <td colSpan={8} style={{ padding: 10 }}>
                    No hay empleados.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        )}
        </div>
    );
    }