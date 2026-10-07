export type CampoEstado = "lleno" | "faltante" | "requiere_confirmacion";

export interface Solicitud {
  id: string;
  de: string;
  para: string;
  asunto: string;
  fecha: string;
  pais: string;
  cliente: string;
  formato: "xlsx" | "pdf" | "portal";
  cuerpo: string;
  adjuntos: string[];
}

export interface PlantillaCampo {
  hoja?: string;
  celda_etiqueta?: string;
  etiqueta: string;
  celda_valor?: string;
  obligatorio: boolean;
}

export interface MapeoCampo {
  etiqueta: string;
  canonical: string | null;
  valor: string | number | boolean | null;
  estado: CampoEstado;
  obligatorio: boolean;
  observacion?: string;
}

export interface Soporte {
  tipo: string;
  archivo: string;
  vigencia_hasta: string | null;
  pais_emisor: string;
  descripcion: string;
  vigente: boolean;
}

export interface PackageResult {
  cliente: string;
  solicitudId: string;
  listo_para_firma: boolean;
  motivo_bloqueo: string[];
  archivos: string[];
  soportes: Array<{
    tipo: string;
    archivo: string;
    vigente: boolean;
  }>;
  campos: MapeoCampo[];
}

export interface ToolResult<T> {
  ok: true;
  data: T;
}

export interface ToolError {
  ok: false;
  error: string;
}

export type ToolResponse<T> = ToolResult<T> | ToolError;

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCall?: ToolCall;
  toolResult?: string;
}

export interface LLMResponse {
  message: LLMMessage;
  toolCall?: ToolCall;
  done: boolean;
}
