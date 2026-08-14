import { useEffect, useState, type FormEvent } from 'react'
import { fetchOpenEscalations, resolveEscalationApi, type OpenEscalation } from '../api/client'

/**
 * Belső nézet, NEM az ügyfélnek szánt — a HF5 kötelező emberi jóváhagyási
 * pontja: itt lát egy munkatárs egy nyitott (a customer-chat által
 * eszkalált) esetet, és itt hagyja jóvá/küldi el a választ, mielőtt az
 * visszajut az ügyfélhez (lásd `docs/final_hw/`).
 */
export function InternalEscalationsPage() {
  // A gépelés közbeni mezőérték (`tokenInput`) SZÁNDÉKOSAN külön állapot a
  // ténylegesen "beküldött" tokentől (`token`) — ha a lekérdezés az input
  // minden billentyűleütésére újrafutna, pár másodperc alatt kimerítené a
  // rate limitet (ez ténylegesen megtörtént az első verzióban).
  const [tokenInput, setTokenInput] = useState('')
  const [token, setToken] = useState('')
  const [escalations, setEscalations] = useState<OpenEscalation[] | null>(null)
  const [replies, setReplies] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load(activeToken: string) {
    if (!activeToken) return
    setError(null)
    try {
      setEscalations(await fetchOpenEscalations(activeToken))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt.')
    }
  }

  useEffect(() => {
    if (!token) return
    load(token)
    const interval = setInterval(() => load(token), 10_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function handleTokenSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = tokenInput.trim()
    setToken(trimmed)
    // Explicit hívás is kell — ha a token nem változott (csak "Frissítés"-t
    // nyomtak újra), a useEffect nem futna újra pusztán az azonos értékre.
    load(trimmed)
  }

  async function handleResolve(id: number) {
    const reply = (replies[id] ?? '').trim()
    if (!reply) return
    setBusyId(id)
    setError(null)
    try {
      await resolveEscalationApi(token, id, reply)
      setEscalations((prev) => prev?.filter((e) => e.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba történt.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🧑‍💼 Eszkalációs sor (belső)</h1>
      </header>

      <main className="app-main internal-escalations">
        <form className="internal-token-row" onSubmit={handleTokenSubmit}>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Belső token (INTERNAL_TOKEN)"
          />
          <button type="submit" disabled={!tokenInput.trim()}>
            Betöltés / frissítés
          </button>
        </form>

        {error && <div className="chat-error">Hiba: {error}</div>}

        {escalations === null && <p className="chat-empty">Add meg a belső tokent a nyitott esetek betöltéséhez.</p>}
        {escalations?.length === 0 && <p className="chat-empty">Nincs nyitott eszkaláció.</p>}

        {escalations?.map((escalation) => (
          <div key={escalation.id} className="escalation-card">
            <p className="escalation-question">
              <strong>#{escalation.id}</strong> — {escalation.question}
            </p>
            <p className="escalation-context">{escalation.contextSnapshot}</p>
            <p className="escalation-meta">
              ok: {escalation.reason} · beérkezett: {new Date(escalation.createdAt).toLocaleString('hu-HU')}
            </p>
            <textarea
              value={replies[escalation.id] ?? ''}
              onChange={(e) => setReplies((prev) => ({ ...prev, [escalation.id]: e.target.value }))}
              placeholder="Írd meg az ügyfélnek küldendő választ…"
            />
            <button type="button" onClick={() => handleResolve(escalation.id)} disabled={busyId === escalation.id || !(replies[escalation.id] ?? '').trim()}>
              Jóváhagyás és küldés
            </button>
          </div>
        ))}
      </main>
    </div>
  )
}
