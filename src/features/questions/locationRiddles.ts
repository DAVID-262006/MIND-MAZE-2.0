// ==============================================================================
// MIND MAZE 2.0 — FRONTEND LOCATION-LEVEL RIDDLES (STATIONS 1 TO 9)
// Associated strictly with Location IDs. Completely independent of questions.
// Never sent to or stored in Supabase.
// ==============================================================================

import type { LocationRiddle } from './types';

export const BASELINE_LOCATION_RIDDLES: LocationRiddle[] = [
  {
    locationId: 1,
    locationNumber: 1,
    locationName: 'Main Library - Atrium',
    riddleClue: `Where silence reigns and knowledge towers high,
Seek where the digital catalog meets the watchful eye.
Beside the glass archways of the central reading hall,
Your first checkpoint token awaits upon the wall.`,
    hint: 'Ground floor atrium beside the catalog terminal pillars.',
  },
  {
    locationId: 2,
    locationNumber: 2,
    locationName: 'Computer Science Building - Hallway A',
    riddleClue: `Follow the hum of fans and silicon trace,
Where robotic arms articulate in cyber space.
Along Hallway A on the premier tier,
The machine minds whisper: your station is near.`,
    hint: 'First floor corridor outside the Robotics Laboratory window.',
  },
  {
    locationId: 3,
    locationNumber: 3,
    locationName: 'Engineering Block - West Entrance',
    riddleClue: `Where future energy catches the noon sky,
Photovoltaic arrays gleam high and dry.
Near the west glass portal where current starts to flow,
Look beside the solar inverter display below.`,
    hint: 'Beside the solar cell showcase display panel near the west entrance.',
  },
  {
    locationId: 4,
    locationNumber: 4,
    locationName: 'Student Center - Quad Steps',
    riddleClue: `Where student congress gathers between the classes,
And midday speeches echo to the masses.
On the stone tiered plaza where open breezes blow,
A weathered concrete pillar guards the code you must know.`,
    hint: 'Exterior pillar facing the outdoor amphitheater steps.',
  },
  {
    locationId: 5,
    locationNumber: 5,
    locationName: 'Innovation Hub - 3rd Floor Mezzanine',
    riddleClue: `Filament melts and rapid prototypes rise,
A glass-walled incubator before your eyes.
Climb to tier three where laser cutters hum,
Beside the additive printers your waypoint has come.`,
    hint: 'Beside the 3D printing workshop glass wall on the 3rd floor.',
  },
  {
    locationId: 6,
    locationNumber: 6,
    locationName: 'Science Complex - South Courtyard',
    riddleClue: `Shadows trace the hour across the courtyard ground,
An ancient bronze gnomon without a sound.
Beneath the celestial sundial where stone meets sky,
Look near the base where the solar markers lie.`,
    hint: 'Underneath the sundial monument in the south courtyard.',
  },
  {
    locationId: 7,
    locationNumber: 7,
    locationName: 'Auditorium - Foyer South',
    riddleClue: `Trophies of silver and past championship gold,
Gleam through display cases where legends are told.
In the south grand foyer by the velvet curtain side,
The penultimate station checkpoint does hide.`,
    hint: 'Right wing foyer adjacent to the historic trophy cabinet.',
  },
  {
    locationId: 8,
    locationNumber: 8,
    locationName: 'Sports Complex - Pavilion Deck',
    riddleClue: `Overlooking the running track and the green expanse,
Where swift feet race and athletes take their chance.
Ascend to the pavilion observation tier,
High above the stadium stands, your code is clear.`,
    hint: 'Upper gallery overlooking the athletic track.',
  },
  {
    locationId: 9,
    locationNumber: 9,
    locationName: 'Academic Tower - Central Arcade',
    riddleClue: `Twin stone towers stand tall into the cloud,
Joined by a central archway above the campus crowd.
Walk the covered colonnade from west to east gate,
Under the master arcade, the final seal of glory awaits.`,
    hint: 'Central covered arcade corridor connecting Tower 1 and Tower 2.',
  },
];

