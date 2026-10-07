import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getByPath, stringifyValue, TODAY, writeText } from "../utils.js";
const BASE = process.cwd();
const FIXTURES = path.join(BASE, "fixtures");
const OUT = path.join(BASE, "out");
const RequestIdSchema = z.object({ solicitud_id: z.string().min(1) });
const FieldArgsSchema = z.object({
    solicitud_id: z.string().min(1),
    campos: z.array(z.string()).optional(),
});
const GenerateArgsSchema = z.object({
    solicitud_id: z.string().min(1),
    formato: z.enum(["xlsx", "pdf", "portal"]),
});
const PackageArgsSchema = z.object({ solicitud_id: z.string().min(1) });
const SendArgsSchema = z.object({
    solicitud_id: z.string().min(1),
    confirmado: z.boolean(),
});
async function readJson(file) {
    return JSON.parse(await readFile(file, "utf8"));
}
function requestDir(id) {
    return path.join(FIXTURES, id);
}
async function getRequest(id) {
    return readJson(path.join(requestDir(id), "solicitud.json"));
}
async function getTemplate(id) {
    const dir = requestDir(id);
    // Formato con obligatoriedad explícita
    try {
        return await readJson(path.join(dir, "plantilla-campos.json"));
    }
    catch {
        // Continúa con el formato basado en celdas.
    }
    // Formato basado en celdas:
    // todos los campos incluidos en la plantilla son requeridos.
    try {
        const plantilla = await readJson(path.join(dir, "plantilla-celdas.json"));
        return plantilla.map((item) => ({
            ...item,
            obligatorio: true,
        }));
    }
    catch {
        return [];
    }
}
async function getSupportsRequired(id) {
    return readJson(path.join(requestDir(id), "soportes-exigidos.json"));
}
async function getMaster() {
    return readJson(path.join(FIXTURES, "maestro.json"));
}
async function getGlossary() {
    return readJson(path.join(BASE, "src/knowledge/glosario-campos.json"));
}
async function getSupportIndex() {
    const entries = await readJson(path.join(FIXTURES, "soportes", "index.json"));
    return entries.map((entry) => ({
        ...entry,
        vigente: entry.vigencia_hasta === null || entry.vigencia_hasta >= TODAY,
    }));
}
function canonicalIsForeignIdentifier(label, country) {
    return (country === "EC" && label.toLowerCase() === "ruc")
        || (country === "HN" && label.toLowerCase() === "rtn")
        || (country === "PA" && label.toLowerCase() === "ruc");
}
function mapOne(label, required, country, glossary, master) {
    const canonical = glossary[label] ?? null;
    if (!canonical) {
        return {
            etiqueta: label,
            canonical: null,
            valor: null,
            estado: required ? "faltante" : "faltante",
            obligatorio: required,
            observacion: "No existe una equivalencia en el glosario maestro.",
        };
    }
    const value = getByPath(master, canonical);
    if (value === undefined || value === null || value === "") {
        return {
            etiqueta: label,
            canonical,
            valor: null,
            estado: "faltante",
            obligatorio: required,
        };
    }
    if (canonicalIsForeignIdentifier(label, country)) {
        return {
            etiqueta: label,
            canonical,
            valor: typeof value === "object"
                ? stringifyValue(value)
                : value,
            estado: "requiere_confirmacion",
            obligatorio: required,
            observacion: `El maestro contiene un identificador colombiano (NIT), pero la solicitud utiliza ${label}. Se requiere confirmación antes de usarlo.`,
        };
    }
    return {
        etiqueta: label,
        canonical,
        valor: typeof value === "object" ? stringifyValue(value) : value,
        estado: "lleno",
        obligatorio: required,
    };
}
async function readRequestTool(args) {
    try {
        const { solicitud_id } = RequestIdSchema.parse(args);
        const solicitud = await getRequest(solicitud_id);
        const plantilla = await getTemplate(solicitud_id);
        const soportes = await getSupportsRequired(solicitud_id);
        return JSON.stringify({ ok: true, data: { solicitud, plantilla, soportes } });
    }
    catch (error) {
        return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
}
async function mapFieldsTool(args) {
    try {
        const parsed = FieldArgsSchema.parse(args);
        const solicitud = await getRequest(parsed.solicitud_id);
        const plantilla = await getTemplate(parsed.solicitud_id);
        const glossary = await getGlossary();
        const master = await getMaster();
        const selected = parsed.campos
            ? plantilla.filter((item) => parsed.campos?.includes(item.etiqueta))
            : plantilla;
        const campos = selected.map((item) => mapOne(item.etiqueta, item.obligatorio, solicitud.pais, glossary, master));
        return JSON.stringify({
            ok: true,
            data: {
                solicitud_id: parsed.solicitud_id,
                campos,
                resumen: {
                    llenos: campos.filter((x) => x.estado === "lleno").length,
                    faltantes: campos.filter((x) => x.estado === "faltante").length,
                    confirmaciones: campos.filter((x) => x.estado === "requiere_confirmacion").length,
                },
            },
        });
    }
    catch (error) {
        return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
}
async function generateXlsx(solicitudId, plantilla, campos) {
    const workbook = new ExcelJS.Workbook();
    const grouped = new Map();
    for (const item of plantilla) {
        const sheet = item.hoja ?? "Registro";
        const current = grouped.get(sheet) ?? [];
        current.push(item);
        grouped.set(sheet, current);
    }
    const byLabel = new Map(campos.map((field) => [field.etiqueta, field]));
    for (const [sheetName, items] of grouped) {
        const sheet = workbook.addWorksheet(sheetName);
        for (const item of items) {
            const labelCell = item.celda_etiqueta ?? "A1";
            const valueCell = item.celda_valor ?? "B1";
            sheet.getCell(labelCell).value = item.etiqueta;
            const mapped = byLabel.get(item.etiqueta);
            sheet.getCell(valueCell).value =
                mapped?.estado === "lleno" ? mapped.valor : "";
        }
    }
    const output = path.join(OUT, solicitudId, "formulario-proveedor.xlsx");
    await workbook.xlsx.writeFile(output);
    return output;
}
async function generatePdf(solicitudId, campos) {
    const output = path.join(OUT, solicitudId, "formulario-proveedor.pdf");
    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", async () => {
            try {
                await writeText(output, Buffer.concat(chunks).toString("latin1"));
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
        doc.on("error", reject);
        doc.fontSize(16).text("Registro / Calificación de Proveedor");
        doc.moveDown();
        for (const field of campos) {
            doc.fontSize(10).text(`${field.etiqueta}: ${field.estado === "lleno" ? stringifyValue(field.valor) : `[${field.estado}]`}`);
            doc.moveDown(0.3);
        }
        doc.end();
    });
    return output;
}
async function generatePortal(solicitudId, campos) {
    const lines = [
        "# Valores preparados para portal",
        "",
        `Solicitud: ${solicitudId}`,
        "",
        "| Campo | Estado | Valor |",
        "|---|---|---|",
    ];
    for (const field of campos) {
        const value = field.estado === "lleno" ? stringifyValue(field.valor) : "";
        lines.push(`| ${field.etiqueta} | ${field.estado} | ${value} |`);
    }
    lines.push("", "> Las credenciales del portal no se almacenan ni se registran. El ingreso y envío final requieren intervención humana.");
    const output = path.join(OUT, solicitudId, "valores-portal.md");
    await writeText(output, lines.join("\n"));
    return output;
}
async function generateFormTool(args) {
    try {
        const parsed = GenerateArgsSchema.parse(args);
        const solicitud = await getRequest(parsed.solicitud_id);
        const template = await getTemplate(parsed.solicitud_id);
        const glossary = await getGlossary();
        const master = await getMaster();
        const fields = template.map((item) => mapOne(item.etiqueta, item.obligatorio, solicitud.pais, glossary, master));
        const output = parsed.formato === "xlsx"
            ? await generateXlsx(parsed.solicitud_id, template, fields)
            : parsed.formato === "pdf"
                ? await generatePdf(parsed.solicitud_id, fields)
                : await generatePortal(parsed.solicitud_id, fields);
        return JSON.stringify({
            ok: true,
            data: {
                solicitud_id: parsed.solicitud_id,
                archivo: output,
                formato: parsed.formato,
                campos: fields,
            },
        });
    }
    catch (error) {
        return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
}
async function buildPackageTool(args) {
    try {
        const { solicitud_id } = PackageArgsSchema.parse(args);
        const solicitud = await getRequest(solicitud_id);
        const template = await getTemplate(solicitud_id);
        const requiredSupports = await getSupportsRequired(solicitud_id);
        const supportIndex = await getSupportIndex();
        const glossary = await getGlossary();
        const master = await getMaster();
        const fields = template.map((item) => mapOne(item.etiqueta, item.obligatorio, solicitud.pais, glossary, master));
        const supports = requiredSupports.map((type) => {
            const item = supportIndex.find((entry) => entry.tipo === type);
            return {
                tipo: type,
                archivo: item?.archivo ?? "",
                vigente: item?.vigente ?? false,
            };
        });
        const blockers = [];
        for (const field of fields) {
            if (field.obligatorio && field.estado !== "lleno") {
                blockers.push(`Campo obligatorio ${field.etiqueta}: ${field.estado}`);
            }
        }
        for (const support of supports) {
            if (!support.archivo)
                blockers.push(`Soporte obligatorio faltante: ${support.tipo}`);
            else if (!support.vigente)
                blockers.push(`Soporte obligatorio vencido: ${support.tipo}`);
        }
        const dir = path.join(OUT, solicitud_id);
        const checklist = [
            `# Checklist de ${solicitud.cliente}`,
            "",
            `- Listo para firma: **${blockers.length === 0 ? "SI" : "NO"}**`,
            "",
            "## Campos",
            ...fields.map((field) => `- ${field.etiqueta}: ${field.estado}`),
            "",
            "## Soportes",
            ...supports.map((support) => `- ${support.tipo}: ${support.archivo || "FALTANTE"} — ${support.vigente ? "vigente" : "no vigente"}`),
            "",
            "## Bloqueos",
            ...(blockers.length ? blockers.map((item) => `- ${item}`) : ["- Ninguno"]),
        ];
        await writeText(path.join(dir, "CHECKLIST.md"), checklist.join("\n"));
        await writeText(path.join(dir, "EMAIL-FIRMA.md"), `# Borrador de correo\n\nAsunto: Documentación para firma — ${solicitud.cliente}\n\nEstimado/a,\n\nSe encuentra preparado el paquete de registro como proveedor. Antes de firma, deben resolverse los bloqueos indicados en el checklist.\n\nSaludos.`);
        const result = {
            cliente: solicitud.cliente,
            solicitudId: solicitud_id,
            listo_para_firma: blockers.length === 0,
            motivo_bloqueo: blockers,
            archivos: [
                path.join(dir, "CHECKLIST.md"),
                path.join(dir, "EMAIL-FIRMA.md"),
            ],
            soportes: supports,
            campos: fields,
        };
        return JSON.stringify({ ok: true, data: result });
    }
    catch (error) {
        return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
}
async function simulateSendTool(args) {
    try {
        const parsed = SendArgsSchema.parse(args);
        if (!parsed.confirmado) {
            return JSON.stringify({
                ok: false,
                error: "Se requiere confirmación explícita del usuario antes del envío simulado.",
            });
        }
        const packageResult = JSON.parse(await buildPackageTool({ solicitud_id: parsed.solicitud_id }));
        if (!packageResult.ok || !packageResult.data) {
            return JSON.stringify({ ok: false, error: packageResult.error ?? "No se pudo validar el paquete." });
        }
        if (!packageResult.data.listo_para_firma) {
            return JSON.stringify({
                ok: false,
                error: "El paquete está bloqueado y no puede simularse el envío.",
                data: packageResult.data,
            });
        }
        const file = path.join(OUT, parsed.solicitud_id, "ENVIO-SIMULADO.md");
        await writeText(file, `# ENVÍO SIMULADO\n\nSolicitud: ${parsed.solicitud_id}\n\nNo se realizó ninguna comunicación externa. La operación fue simulada después de confirmación explícita.`);
        return JSON.stringify({ ok: true, data: { archivo: file, simulado: true } });
    }
    catch (error) {
        return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
}
export const providerTools = [
    {
        name: "proveedor_leer_solicitud",
        description: "Lee la solicitud, plantilla y soportes exigidos de un cliente.",
        inputSchema: RequestIdSchema,
        execute: readRequestTool,
    },
    {
        name: "proveedor_mapear_campos",
        description: "Mapea campos de la plantilla al maestro usando el glosario y reglas determinísticas.",
        inputSchema: FieldArgsSchema,
        execute: mapFieldsTool,
    },
    {
        name: "proveedor_generar_formulario",
        description: "Genera XLSX, PDF o valores de portal según la solicitud.",
        inputSchema: GenerateArgsSchema,
        execute: generateFormTool,
    },
    {
        name: "proveedor_armar_paquete",
        description: "Valida soportes, crea checklist y prepara borrador de correo.",
        inputSchema: PackageArgsSchema,
        execute: buildPackageTool,
    },
    {
        name: "proveedor_simular_envio",
        description: "Simula el envío únicamente con confirmación explícita y sin comunicación externa.",
        inputSchema: SendArgsSchema,
        execute: simulateSendTool,
    },
];
export async function executeTool(name, args) {
    const tool = providerTools.find((item) => item.name === name);
    if (!tool)
        return JSON.stringify({ ok: false, error: `Herramienta desconocida: ${name}` });
    try {
        return await tool.execute(args);
    }
    catch (error) {
        return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
}
