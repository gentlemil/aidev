import { runStage1 } from './stages/stage1.agent'
import { runStage2 } from './stages/stage2.agent'
import type { PipelineStreamEvent } from './pipeline.events'
import type { TaggedPerson } from '../people/people.types'
import type { Suspect } from '../find-him/find-him.types'

function mapToSuspects(tagged: TaggedPerson[]): Suspect[] {
  return tagged.map(({ name, surname, born }) => ({ name, surname, born }))
}

export async function runPipeline(onEvent: (event: PipelineStreamEvent) => void): Promise<void> {
  // Stage 1 — people: fetch CSV, tag jobs, submit to hub (with retry)
  const tagged = await runStage1((event) => onEvent({ stage: 'stage1', event }))

  // Handoff — map TaggedPerson[] → Suspect[] and pass to Stage 2
  const suspects = mapToSuspects(tagged)
  onEvent({ type: 'handoff', suspects })

  // Stage 2 — find-him: locate suspects, find closest to a power plant
  await runStage2(suspects, (event) => onEvent({ stage: 'stage2', event }))
}
