    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import "./Dashboard.css";

    import {
    ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar,
    PieChart, Pie, Cell, Legend
    } from "recharts";

    function money(n) {
    const x = Number(n || 0);
    return x.toLocaleString("es-CO", { maximumFractionDigits: 0 });
    }

    function compactDayLabel(s) {
    // "YYYY-MM-DD" -> "MM-DD"
    if (!s) return "";
    return String(s).slice(5);
    }

    export default function Dashboard() {
    const [warehouseId, setWarehouseId] = useState(1);
    const [days, setDays] = useState(30);

    const [overview, setOverview] = useState(null);
    const [trends, setTrends] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
        const [o, t] = await Promise.all([
            api.get(`/metrics/overview?warehouseId=${warehouseId}`),
            api.get(`/metrics/trends?days=${days}`)
        ]);
        setOverview(o.data.data);
        setTrends(t.data.data);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando dashboard");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warehouseId, days]);

    // Unir series por día (ventas vs gastos)
    const series = useMemo(() => {
        if (!trends) return [];
        const map = new Map();

        for (const r of trends.salesDaily || []) {
        const day = String(r.day);
        map.set(day, {
            day,
            label: compactDayLabel(day),
            sales: Number(r.total_sales),
            expenses: 0
        });
        }
        for (const r of trends.expensesDaily || []) {
        const day = String(r.day);
        const cur = map.get(day) || { day, label: compactDayLabel(day), sales: 0, expenses: 0 };
        cur.expenses = Number(r.total_expenses);
        map.set(day, cur);
        }

        return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
    }, [trends]);

    const pieData = useMemo(() => {
        if (!overview) return [];
        const net = Number(overview.derived?.salesMonthNet || 0);
        const exp = Number(overview.expensesMonth?.total || 0);
        const prof = Number(overview.derived?.profitMonthEstimate || 0);
        return [
        { name: "Neto cobrado mes", value: Math.max(net, 0) },
        { name: "Gastos mes", value: Math.max(exp, 0) },
        { name: "Utilidad estimada", value: Math.max(prof, 0) }
        ];
    }, [overview]);

    const PIE_COLORS = ["#4da3ff", "#ffcc66", "#4ee3c1"];

    const badge = (value, type = "money") => {
        const n = Number(value || 0);
        const cls = n <= 0 ? "ok" : "warn";
        const text = type === "money" ? `$${money(n)}` : `${money(n)}`;
        return <span className={`badge ${cls}`}>{text}</span>;
    };

    if (loading) return <div className="dash">Cargando...</div>;

    return (
        <div className="dash">
        <div className="dash-header">
            <div>
            <h2 className="title">Dashboard</h2>
            <div className="sub">
                {overview?.updatedAt ? `Actualizado: ${new Date(overview.updatedAt).toLocaleString()}` : ""}
            </div>
            </div>

            <div className="controls">
            <label>
                <div className="sub">Bodega</div>
                <input className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} />
            </label>

            <label>
                <div className="sub">Días (gráfica)</div>
                <select className="select" value={days} onChange={(e) => setDays(e.target.value)}>
                <option value={7}>7</option>
                <option value={14}>14</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
                <option value={90}>90</option>
                </select>
            </label>

            <button className="btn" onClick={load}>Recargar</button>
            </div>
        </div>

        {error && <div className="err">{error}</div>}

        {/* CARDS */}
        <div className="grid">
            <div className="card">
            <h4>Ventas hoy (neto cobrado)</h4>
            <p className="big">${money(overview?.derived?.salesTodayNet)}</p>
            <div className="sub">{overview?.salesToday?.count} ventas · total ${money(overview?.salesToday?.total)}</div>
            </div>

            <div className="card">
            <h4>Ventas mes (neto cobrado)</h4>
            <p className="big">${money(overview?.derived?.salesMonthNet)}</p>
            <div className="sub">{overview?.salesMonth?.count} ventas · total ${money(overview?.salesMonth?.total)}</div>
            </div>

            <div className="card">
            <h4>Gastos mes</h4>
            <p className="big">${money(overview?.expensesMonth?.total)}</p>
            <div className="sub">{overview?.expensesMonth?.count} gastos</div>
            </div>

            <div className="card">
            <h4>Utilidad estimada (mes)</h4>
            <p className="big">${money(overview?.derived?.profitMonthEstimate)}</p>
            <div className="sub">neto cobrado - gastos</div>
            </div>

            <div className="card">
            <h4>Pendiente por cobrar</h4>
            <p className="big">${money(overview?.derived?.openDue)}</p>
            <div className="sub">{badge(overview?.derived?.openDue, "money")} si es &gt; 0 hay cuentas por cobrar</div>
            </div>

            <div className="card">
            <h4>Deudas abiertas (empleados)</h4>
            <p className="big">${money(overview?.debtsOpen?.balance)}</p>
            <div className="sub">{overview?.debtsOpen?.count} deudas abiertas</div>
            </div>

            <div className="card">
            <h4>Inventario (unidades)</h4>
            <p className="big">{money(overview?.inventory?.totalUnits)}</p>
            <div className="sub">Bodega #{overview?.inventory?.warehouseId}</div>
            </div>

            <div className="card">
            <h4>Valor inventario estimado</h4>
            <p className="big">${money(overview?.inventory?.totalValue)}</p>
            <div className="sub">stock * precio</div>
            </div>
        </div>

        {/* CHARTS */}
        <div className="split">
            <div className="card">
            <h4>Ventas vs Gastos (diario)</h4>
            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                    <CartesianGrid stroke="rgba(255,255,255,0.10)" />
                    <XAxis dataKey="label" stroke="rgba(233,238,252,0.7)" />
                    <YAxis stroke="rgba(233,238,252,0.7)" />
                    <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.15)" }}
                    labelStyle={{ color: "#e9eefc" }}
                    />
                    <Line type="monotone" dataKey="sales" name="Ventas" stroke="#4da3ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expenses" name="Gastos" stroke="#ffcc66" strokeWidth={2} dot={false} />
                </LineChart>
                </ResponsiveContainer>
            </div>
            </div>

            <div className="card">
            <h4>Composición del mes</h4>
            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {pieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                    </Pie>
                    <Legend />
                    <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.15)" }} />
                </PieChart>
                </ResponsiveContainer>
            </div>
            </div>
        </div>

        <div className="split" style={{ marginTop: 12 }}>
            <div className="card">
            <h4>Gastos por categoría (Top 8 del mes)</h4>
            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(trends?.expensesByCategory || []).map(r => ({
                    name: r.category_name,
                    total: Number(r.total_amount)
                }))}>
                    <CartesianGrid stroke="rgba(255,255,255,0.10)" />
                    <XAxis dataKey="name" stroke="rgba(233,238,252,0.7)" />
                    <YAxis stroke="rgba(233,238,252,0.7)" />
                    <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid rgba(255,255,255,0.15)" }} />
                    <Bar dataKey="total" name="Gasto" fill="#4ee3c1" />
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            <div className="card">
            <h4>Stock más bajo (Top 10)</h4>
            <table className="table">
                <thead>
                <tr>
                    <th>Producto</th>
                    <th>Gramaje</th>
                    <th>Unidad</th>
                    <th>Cant</th>
                </tr>
                </thead>
                <tbody>
                {(overview?.inventory?.lowStock || []).map((r) => (
                    <tr key={r.product_id}>
                    <td>{r.name}</td>
                    <td>{r.gramaje}</td>
                    <td>{r.unit}</td>
                    <td>{r.quantity}</td>
                    </tr>
                ))}
                {!overview?.inventory?.lowStock?.length && <tr><td colSpan={4}>Sin datos.</td></tr>}
                </tbody>
            </table>
            <div className="sub" style={{ marginTop: 8 }}>
                Consejo: si un producto baja mucho, haz un IN o producción y revisa Kardex.
            </div>
            </div>
        </div>
        </div>
    );
    }