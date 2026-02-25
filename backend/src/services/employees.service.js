    import { employeesRepo } from "../repositories/employees.repo.js";

    function httpError(statusCode, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    return e;
    }

    export const employeesService = {
    async list({ includeInactive }) {
        return employeesRepo.list({ includeInactive });
    },

    async get(id) {
        const emp = await employeesRepo.findById(id);
        if (!emp) throw httpError(404, "Empleado no encontrado");
        return emp;
    },

    async create(data) {
        const id = await employeesRepo.create(data);
        return employeesRepo.findById(id);
    },

    async update(id, data) {
        const affected = await employeesRepo.update(id, data);
        if (!affected) throw httpError(404, "Empleado no encontrado");
        return employeesRepo.findById(id);
    },

    async deactivate(id) {
        const affected = await employeesRepo.deactivate(id);
        if (!affected) throw httpError(404, "Empleado no encontrado");
        return { ok: true };
    },

    async reactivate(id) {
        const affected = await employeesRepo.reactivate(id);
        if (!affected) throw httpError(404, "Empleado no encontrado");
        return { ok: true };
    }
    };