import { PEOPLE_CONFIG as config } from '@/configs/people.config'
import { Person } from './people.types'
import { getYear } from 'date-fns'

export function filterPeople(people: Person[]): Person[] {
  return people.filter((person: Person) => {
    const age: number = config.currentYear - getYear(new Date(person.birthDate))

    const hasMinimumAge: boolean = age >= config.minAge
    const isUnderOrEqualMaximumAge: boolean = age <= config.maxAge
    const isFromRequiredBirthPlace: boolean = person.birthPlace === config.birthPlace
    const hasRequiredGender: boolean = person.gender === config.gender

    return (
      hasRequiredGender && isFromRequiredBirthPlace && hasMinimumAge && isUnderOrEqualMaximumAge
    )
  })
}
