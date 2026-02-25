    import { useEffect, useMemo, useState } from "react";
    import { api } from "../services/api";
    import "./Dashboard.css";

    function money(n) {
    const x = Number(n || 0);
    return x.toLocaleString("es-CO", { maximumFractionDigits: 0 });
    }

    export default function Dashboard() {
    const [warehouseId, setWarehouseId] = useState(1);
    const [data, setData] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
        const res = await api.get(`/metrics/overview?warehouseId=${warehouseId}`);
        setData(res.data.data);
        } catch (e) {
        setError(e?.response?.data?.message || "Error cargando métricas");
        } finally {
        setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warehouseId]);

    const badges = useMemo(() => {
        if (!data) return {};
        const openDue = Number(data.derived.openDue || 0);
        const invUnits = Number(data.inventory.totalUnits || 0);
        const debt = Number(data.debtsOpen.balance || 0);

        return {
        receivable: openDue > 0 ? "warn" : "ok",
        inventory: invUnits <= 0 ? "bad" : "ok",
        debt: debt > 0 ? "warn" : "ok"
        };
    }, [data]);

    if (loading) return <div className="dashboard-wrap">Cargando...</div>;

    return (
        <div className="dashboard-wrap">
        <h2>Dashboard</h2>

        <div className="top-row">
            <label>
            Bodega ID
            <input
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                style={{ display: "block", marginTop: 6, padding: 8, width: 120 }}
            />
            </label>

            <button className="btn" onClick={load}>Recargar</button>

            {data?.updatedAt && (
            <div className="muted">Actualizado: {new Date(data.updatedAt).toLocaleString()}</div>
            )}
        </div>

        {error && <div style={{ color: "crimson", marginBottom: 10 }}>{error}</div>}

        {/* Cards */}
        <div className="card-grid">
            <div className="card">
            <h4>Ventas hoy (neto cobrado)</h4>
            <p className="big">${money(data?.derived?.salesTodayNet)}</p>
            <div className="muted">
                {data?.salesToday?.count} ventas · total ${money(data?.salesToday?.total)}
            </div>
            </div>

            <div className="card">
            <h4>Ventas del mes (neto cobrado)</h4>
            <p className="big">${money(data?.derived?.salesMonthNet)}</p>
            <div className="muted">
                {data?.salesMonth?.count} ventas · total ${money(data?.salesMonth?.total)}
            </div>
            </div>

            <div className="card">
            <h4>Gastos del mes</h4>
            <p className="big">${money(data?.expensesMonth?.total)}</p>
            <div className="muted">{data?.expensesMonth?.count} gastos</div>
            </div>

            <div className="card">
            <h4>Utilidad estimada (mes)</h4>
            <p className="big">${money(data?.derived?.profitMonthEstimate)}</p>
            <div className="muted">neto cobrado - gastos</div>
            </div>

            <div className="card">
            <h4>Pendiente por cobrar</h4>
            <p className="big">${money(data?.derived?.openDue)}</p>
            <div className="muted">
                <span className={`badge ${badges.receivable}`}>
                {Number(data?.derived?.openDue || 0) > 0 ? "Hay pendientes" : "Al día"}
                </span>
            </div>
            </div>

            <div className="card">
            <h4>Deudas abiertas (empleados)</h4>
            <p className="big">${money(data?.debtsOpen?.balance)}</p>
            <div className="muted">
                <span className={`badge ${badges.debt}`}>
                {data?.debtsOpen?.count} deudas abiertas
                </span>
            </div>
            </div>

            <div className="card">
            <h4>Inventario total (unidades)</h4>
            <p className="big">{money(data?.inventory?.totalUnits)}</p>
            <div className="muted">
                <span className={`badge ${badges.inventory}`}>
                Bodega #{data?.inventory?.warehouseId}
                </span>
            </div>
            </div>

            <div className="card">
            <h4>Valor estimado inventario</h4>
            <p className="big">${money(data?.inventory?.totalValue)}</p>
            <div className="muted">stock * precio producto</div>
            </div>
        </div>

        {/* Tablas */}
        <div className="split">
            <div className="card">
            <h4>Stock más bajo (Top 10)</h4>
            <table className="table">
                <thead>
                <tr>
                    <th>Producto</th>
                    <th>Gramaje</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                </tr>
                </thead>
                <tbody>
                {(data?.inventory?.lowStock || []).map((r) => (
                    <tr key={r.product_id}>
                    <td>{r.name}</td>
                    <td>{r.gramaje}</td>
                    <td>{r.unit}</td>
                    <td>{r.quantity}</td>
                    </tr>
                ))}
                {!data?.inventory?.lowStock?.length && (
                    <tr><td colSpan={4}>Sin datos.</td></tr>
                )}
                </tbody>
            </table>
            </div>

            <div className="card">
            <h4>Últimas ventas (Top 10)</h4>
            <table className="table">
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                    <th>Total</th>
                </tr>
                </thead>
                <tbody>
                {(data?.recentSales || []).map((s) => (
                    <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.customer_name || ""}</td>
                    <td>{s.status}</td>
                    <td>${money(s.total)}</td>
                    </tr>
                ))}
                {!data?.recentSales?.length && (
                    <tr><td colSpan={4}>Sin ventas.</td></tr>
                )}
                </tbody>
            </table>
            </div>
        </div>
        </div>
    );
    }