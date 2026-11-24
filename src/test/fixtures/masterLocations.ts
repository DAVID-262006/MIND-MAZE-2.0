import type { LocationCheckpoint } from '../../types';

/**
 * Server/Test Authoritative Master Location Bank
 * Used strictly for test suites and verification.
 * NEVER imported by production client components.
 */
export const MASTER_LOCATIONS: LocationCheckpoint[] = [
  {
    id: 1,
    locationNumber: 1,
    name: 'Main Library - Atrium',
    description: 'Ground floor entrance near digital catalog kiosk',
    capacity: 2,
    active: true,
    qrToken: '8492019481',
  },
  {
    id: 2,
    locationNumber: 2,
    name: 'Computer Science Building - Hallway A',
    description: 'First floor beside Robotics Laboratory',
    capacity: 2,
    active: true,
    qrToken: '7201948293',
  },
  {
    id: 3,
    locationNumber: 3,
    name: 'Engineering Block - West Entrance',
    description: 'Beside the solar cell showcase display',
    capacity: 2,
    active: true,
    qrToken: '9182736452',
  },
  {
    id: 4,
    locationNumber: 4,
    name: 'Student Center - Quad Steps',
    description: 'Exterior pillar facing the amphitheater',
    capacity: 2,
    active: true,
    qrToken: '6392018475',
  },
  {
    id: 5,
    locationNumber: 5,
    name: 'Innovation Hub - 3rd Floor Mezzanine',
    description: 'Beside the 3D printing workshop glass wall',
    capacity: 2,
    active: true,
    qrToken: '4820193847',
  },
  {
    id: 6,
    locationNumber: 6,
    name: 'Science Complex - South Courtyard',
    description: 'Underneath the sundial monument',
    capacity: 2,
    active: true,
    qrToken: '3910284756',
  },
  {
    id: 7,
    locationNumber: 7,
    name: 'Mathematics Wing - 2nd Floor Gallery',
    description: 'Beside the Fibonacci spiral wall mosaic',
    capacity: 2,
    active: true,
    qrToken: '5829104729',
  },
  {
    id: 8,
    locationNumber: 8,
    name: 'Auditorium - North Foyer',
    description: 'Between acoustic panels opposite the ticket booth',
    capacity: 2,
    active: true,
    qrToken: '1029384756',
  },
  {
    id: 9,
    locationNumber: 9,
    name: 'Sports Pavilion - East Arcade',
    description: 'Beside the championship trophy showcase',
    capacity: 2,
    active: true,
    qrToken: '2938475610',
  },
  {
    id: 10,
    locationNumber: 10,
    name: 'Administration Tower - Lawn Viewpoint',
    description: 'Mounted on stone pedestal facing the clock tower lawn',
    capacity: 2,
    active: true,
    qrToken: '9847291038',
  },
];
