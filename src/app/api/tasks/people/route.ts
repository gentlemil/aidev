import { Person, TaggedPerson } from '@/features/ai-devs/tasks/people/people.types'
import { PEOPLE_CONFIG as config } from '@/configs/people.config'
import { filterPeople } from '@/features/ai-devs/tasks/people/people.filter'
import { tagJobsBatch } from '@/features/ai-devs/tasks/people/people-tagger.agent'
import { submitAnswer } from '@/features/ai-devs/hub'
import { NextResponse } from 'next/server'
import { parseCSV } from '@/lib/csv'
import { getYear } from 'date-fns'

export async function POST() {
  try {
    // 1. fetch CSV file from url
    const csvResponse = await fetch(`${config.csvUrl}`)

    if (!csvResponse.ok) {
      return NextResponse.json(
        { error: `Failed to fetch CSV: ${csvResponse.status}` },
        { status: 500 }
      )
    }
    const csvText: string = await csvResponse.text()

    // 2. parse CSV into array of Person objects
    const allPeople: Person[] = parseCSV<Person>(csvText, (row: Record<string, string>) => ({
      name: row['name'],
      surname: row['surname'],
      gender: row['gender'],
      birthDate: row['birthDate'],
      birthPlace: row['birthPlace'],
      birthCountry: row['birthCountry'],
      job: row['job'],
    }))

    // 3. filter by gender, city, age (due to requirements)
    const filtered = filterPeople(allPeople)

    if (filtered.length === 0) {
      return NextResponse.json({
        message: 'No people match the criteria',
        allCount: allPeople.length,
      })
    }

    // console.log(filtered)
    // return

    // 4. batch tag jobs with LLM
    const jobs: string[] = filtered.map((person: Person) => person.job)
    const { results: taggingResults } = await tagJobsBatch(jobs)

    const tagged: TaggedPerson[] = filtered
      .map((person: Person, index: number) => {
        const result = taggingResults.find((res) => res.id === index)

        return {
          name: person.name,
          surname: person.surname,
          gender: person.gender,
          born: getYear(new Date(person.birthDate)),
          city: person.birthPlace,
          tags: result?.tags ?? [],
        }
      })
      .filter((person: TaggedPerson) => person.tags.includes('transport'))

    // 6. submit to hub
    const hubResponse = await submitAnswer('people', tagged)

    return NextResponse.json({
      success: true,
      matchedPeople: tagged,
      hubResponse,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
