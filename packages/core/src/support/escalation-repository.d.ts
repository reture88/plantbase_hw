import type { Pool } from 'pg';
export type EscalationRecord = {
    id: number;
    question: string;
    contextSnapshot: string;
    reason: string;
    status: 'open' | 'resolved';
    reply: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
};
export type EscalationToCreate = {
    question: string;
    contextSnapshot: string;
    reason: string;
};
/**
 * Az ügyfélirányú chat egyetlen emberi jóváhagyási pontja: ha az agent nem
 * tud a tudásbázisból megválaszolni egy kérdést, ide kerül (web_search
 * helyett), és egy munkatárs oldja fel a belső nézeten.
 */
export declare function createEscalation(pool: Pool, input: EscalationToCreate): Promise<EscalationRecord>;
export declare function listOpenEscalations(pool: Pool): Promise<EscalationRecord[]>;
export declare function getEscalation(pool: Pool, id: number): Promise<EscalationRecord | null>;
export declare function resolveEscalation(pool: Pool, id: number, reply: string): Promise<EscalationRecord | null>;
//# sourceMappingURL=escalation-repository.d.ts.map