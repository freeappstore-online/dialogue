import { validateScenario, type Phrase, type Repair, type Scenario } from './model';
import restaurantArrival from './scenarios/restaurant-arrival.json';
import restaurantOrdering from './scenarios/restaurant-ordering.json';
import restaurantBill from './scenarios/restaurant-bill.json';
import directionsStreet from './scenarios/directions-street.json';
import directionsSubway from './scenarios/directions-subway.json';
import appointmentBook from './scenarios/appointment-book.json';
import appointmentChange from './scenarios/appointment-change.json';
import repairData from './repairs.json';
import phraseData from './phrases.json';

export type Category = { id: string; title: string; scenarios: Scenario[] };

export const categories: Category[] = [
  { id: 'restaurant', title: 'Restaurant / Food', scenarios: [restaurantArrival, restaurantOrdering, restaurantBill] },
  { id: 'directions', title: 'Directions', scenarios: [directionsStreet, directionsSubway] },
  { id: 'appointments', title: 'Appointments', scenarios: [appointmentBook, appointmentChange] },
];
export const scenarios: Scenario[] = categories.flatMap(c => c.scenarios);
export const repairs = repairData as Repair[];
export const phrases: Phrase[] = phraseData;

export const scenarioById = (id?: string) => scenarios.find(s => s.id === id);
export const categoryOf = (s: Scenario) => categories.find(c => c.id === s.category)!;

for (const category of categories) {
  for (const s of category.scenarios) {
    validateScenario(s);
    if (s.category !== category.id) throw new Error(`${s.id} is filed under ${category.id} but declares ${s.category}`);
  }
}
if (new Set(scenarios.map(s => s.id)).size !== scenarios.length) throw new Error('Duplicate scenario id');
