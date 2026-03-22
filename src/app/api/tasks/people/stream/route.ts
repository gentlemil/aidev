import { filterPeople } from '@/features/ai-devs/tasks/people/people.filter'
import { tagJobsBatch } from '@/features/ai-devs/tasks/people/people.tagger'
import { PEOPLE_CONFIG as config } from '@/configs/people.config'
import type { Person, TaggedPerson } from '@/features/ai-devs/tasks/people/people.types'
import type { AgentStreamEvent } from '@/features/ai-devs/tasks/people/people.events'
import { submitAnswer } from '@/features/ai-devs/hub'
import { parseCSV } from '@/lib/csv'
import { getYear } from 'date-fns'

export async function POST() {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // ── Step 1: Fetch CSV ─────────────────────────────────────────────
        send({ type: 'step', id: 'fetch', status: 'running', message: 'Fetching CSV from source…' })

        const csvResponse = await fetch(`${config.csvUrl}`)
        if (!csvResponse.ok) {
          throw new Error(`Failed to fetch CSV: ${csvResponse.status}`)
        }

        const csvText = await csvResponse.text()
        const allPeople: Person[] = parseCSV<Person>(csvText, (row) => ({
          name: row['name'],
          surname: row['surname'],
          gender: row['gender'],
          birthDate: row['birthDate'],
          birthPlace: row['birthPlace'],
          birthCountry: row['birthCountry'],
          job: row['job'],
        }))

        send({
          type: 'step',
          id: 'fetch',
          status: 'done',
          message: 'CSV fetched',
          detail: `${allPeople.length} records`,
        })

        // ── Step 2: Filter ───────────────────────────────────────────────
        send({
          type: 'step',
          id: 'filter',
          status: 'running',
          message: 'Filtering people by criteria…',
        })

        const filtered = filterPeople(allPeople)

        if (filtered.length === 0) {
          send({
            type: 'step',
            id: 'filter',
            status: 'done',
            message: 'Filtered people',
            detail: '0 matched criteria',
          })
          send({
            type: 'result',
            matched: [],
            allCount: allPeople.length,
            filteredCount: 0,
            hubResponse: null,
          })
          send({ type: 'done' })
          controller.close()
          return
        }

        send({
          type: 'step',
          id: 'filter',
          status: 'done',
          message: 'People filtered',
          detail: `${filtered.length} matched`,
        })

        // ── Step 3: Tag jobs with LLM ────────────────────────────────────
        send({ type: 'step', id: 'tag', status: 'running', message: 'Tagging jobs with LLM…' })

        const jobs = filtered.map((p: Person) => p.job)
        const { results: taggingResults, model, usage } = await tagJobsBatch(jobs)

        if (usage) {
          send({
            type: 'llm',
            model,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          })
        }

        send({
          type: 'step',
          id: 'tag',
          status: 'done',
          message: 'Jobs tagged',
          detail: `${taggingResults.length} results`,
        })

        // ── Step 4: Build tagged people ──────────────────────────────────
        const tagged: TaggedPerson[] = filtered
          .map((person: Person, index: number) => {
            const result = taggingResults.find((r) => r.id === index)
            return {
              name: person.name,
              surname: person.surname,
              gender: person.gender,
              born: getYear(new Date(person.birthDate)),
              city: person.birthPlace,
              tags: result?.tags ?? [],
            }
          })
          .filter((p: TaggedPerson) => p.tags.includes('transport'))

        // ── Step 5: Submit to hub ────────────────────────────────────────
        send({
          type: 'step',
          id: 'submit',
          status: 'running',
          message: 'Submitting answer to hub…',
        })

        const hubResponse = await submitAnswer('people', tagged)

        send({
          type: 'step',
          id: 'submit',
          status: 'done',
          message: 'Answer submitted',
          detail: 'success',
        })

        send({
          type: 'result',
          matched: tagged,
          allCount: allPeople.length,
          filteredCount: filtered.length,
          hubResponse,
        })

        send({ type: 'done' })
        controller.close()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        send({ type: 'error', message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
