import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CreateFeedback, Feedback, HistoryRecord, Report } from "./schemas.js";

export interface HistorySummary {
  id: string;
  version: number;
  activity: string;
  created_at: string;
  updated_at: string;
  norm_codes: string[];
  counts: Record<"atendido" | "pendente" | "nao_informado" | "decisao_humana", number>;
  feedback_count: number;
  archived_at: string | null;
  revision_of: string | null;
  change_note: string;
}

export interface HistoryStore {
  create(report: Report): Promise<HistoryRecord>;
  list(archived?: boolean): Promise<HistorySummary[]>;
  get(id: string): Promise<HistoryRecord | undefined>;
  addFeedback(id: string, input: CreateFeedback): Promise<Feedback | undefined>;
  revise(id: string, report: Report, changeNote: string): Promise<HistoryRecord | undefined>;
  setArchived(id: string, archived: boolean): Promise<HistoryRecord | undefined>;
  deleteArchived(id: string): Promise<"deleted" | "not_found" | "not_archived">;
}

const activityKey = (activity: string) => activity.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

function summary(record: HistoryRecord): HistorySummary {
  const counts = { atendido: 0, pendente: 0, nao_informado: 0, decisao_humana: 0 };
  for (const finding of record.report.findings) counts[finding.status] += 1;
  return {
    id: record.id,
    version: record.version,
    activity: record.report.activity,
    created_at: record.created_at,
    updated_at: record.updated_at,
    norm_codes: [...new Set(record.report.norms.map((norm) => norm.norm))],
    counts,
    feedback_count: record.feedback.length,
    archived_at: record.archived_at,
    revision_of: record.revision_of,
    change_note: record.change_note,
  };
}

export class MemoryHistoryStore implements HistoryStore {
  protected records: HistoryRecord[] = [];

  async create(report: Report): Promise<HistoryRecord> {
    const key = activityKey(report.activity);
    const now = new Date().toISOString();
    const version = Math.max(0, ...this.records.filter((item) => item.activity_key === key).map((item) => item.version)) + 1;
    const record: HistoryRecord = {
      id: randomUUID(),
      version,
      activity_key: key,
      created_at: now,
      updated_at: now,
      archived_at: null,
      revision_of: null,
      change_note: "Relatório original",
      report: { ...report, history_id: undefined },
      feedback: [],
    };
    this.records.unshift(record);
    await this.persist();
    return record;
  }

  async list(archived = false): Promise<HistorySummary[]> {
    return [...this.records]
      .filter((record) => Boolean(record.archived_at) === archived)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(summary);
  }

  async get(id: string): Promise<HistoryRecord | undefined> {
    return this.records.find((record) => record.id === id);
  }

  async addFeedback(id: string, input: CreateFeedback): Promise<Feedback | undefined> {
    const record = this.records.find((item) => item.id === id);
    if (!record) return undefined;
    const feedback: Feedback = {
      id: randomUUID(),
      ...input,
      created_at: new Date().toISOString(),
      reviewed: false,
    };
    record.feedback.push(feedback);
    record.updated_at = feedback.created_at;
    await this.persist();
    return feedback;
  }

  async revise(id: string, report: Report, changeNote: string): Promise<HistoryRecord | undefined> {
    const source = this.records.find((record) => record.id === id);
    if (!source) return undefined;
    const now = new Date().toISOString();
    const version = Math.max(0, ...this.records.filter((item) => item.activity_key === source.activity_key).map((item) => item.version)) + 1;
    const revision: HistoryRecord = {
      id: randomUUID(),
      version,
      activity_key: source.activity_key,
      created_at: now,
      updated_at: now,
      archived_at: null,
      revision_of: source.id,
      change_note: changeNote,
      report: { ...report, history_id: undefined },
      feedback: [],
    };
    this.records.unshift(revision);
    await this.persist();
    return revision;
  }

  async setArchived(id: string, archived: boolean): Promise<HistoryRecord | undefined> {
    const record = this.records.find((item) => item.id === id);
    if (!record) return undefined;
    record.archived_at = archived ? new Date().toISOString() : null;
    record.updated_at = new Date().toISOString();
    await this.persist();
    return record;
  }

  async deleteArchived(id: string): Promise<"deleted" | "not_found" | "not_archived"> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) return "not_found";
    if (!this.records[index].archived_at) return "not_archived";
    this.records.splice(index, 1);
    await this.persist();
    return "deleted";
  }

  protected async persist(): Promise<void> {}
}

export class JsonHistoryStore extends MemoryHistoryStore {
  private constructor(private readonly file: string) {
    super();
  }

  static async open(file: string): Promise<JsonHistoryStore> {
    const store = new JsonHistoryStore(file);
    try {
      const stored = JSON.parse(await readFile(file, "utf8")) as Array<Partial<HistoryRecord> & Pick<HistoryRecord, "id" | "report">>;
      store.records = stored.map((record) => ({
        ...record,
        version: record.version ?? 1,
        activity_key: record.activity_key ?? activityKey(record.report.activity),
        created_at: record.created_at ?? record.report.generated_at,
        updated_at: record.updated_at ?? record.report.generated_at,
        archived_at: record.archived_at ?? null,
        revision_of: record.revision_of ?? null,
        change_note: record.change_note ?? "Relatório original",
        feedback: record.feedback ?? [],
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return store;
  }

  protected override async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(this.records, null, 2), "utf8");
  }
}
