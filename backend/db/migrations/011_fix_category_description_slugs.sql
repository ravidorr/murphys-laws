-- Fix category descriptions for production database slugs
-- The slugs in production differ slightly from the source markdown file names
-- Also fixes two malformed slugs (removes "section" suffix and trailing "1")
-- Generated: 2026-01-24

BEGIN TRANSACTION;

-- Murphy's 4X4 Car Laws - fix slug (remove "section") and add description
UPDATE categories SET 
  slug = 'murphys-4x4-car-laws',
  description = 'Off-road truths: mud is always deeper, winches are always shorter, and tires blow when you need them most.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-4x4-car-laws-section';

-- Murphy's Computer Laws (production uses singular)
UPDATE categories SET 
  description = 'Digital doom: programs are obsolete when running, bugs appear after the author leaves, and backups fail when needed.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-computer-laws';

-- Murphy's Cowboy Action Shooting (CAS) Laws - fix slug (remove trailing "1") and add description
UPDATE categories SET 
  slug = 'murphys-cowboy-action-shooting-cas-laws',
  description = 'Western shooting sports wisdom: guns jam at the worst moment, and the whiter the hat, the deeper the mud.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cowboy-action-shooting-cas-laws1';

-- Murphy's Helicopters Warfare Laws (production slug differs)
UPDATE categories SET 
  description = 'Rotorcraft combat wisdom: tail rotors seek trees, and running out of airspeed, altitude, and ideas is bad.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-helicopters-warfare-laws';

-- Murphy's Law of the Open Road (production slug differs)
UPDATE categories SET 
  description = 'Traffic laws of the universe: red lights last forever, and two cars always meet at a one-way bridge.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-law-of-the-open-road';

-- Murphy's Laws of Mechanics (production slug differs)
UPDATE categories SET 
  description = 'Workshop wisdom: if it doesn''t fit, force it; if it breaks, it needed replacing anyway.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-laws-of-mechanics';

-- Murphy's Marine Corps Laws (production uses 'corps' not 'corp')
UPDATE categories SET 
  description = 'Semper Fi wisdom: it never rains in the Marine Corps, it rains on the Marine Corps.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-marine-corps-laws';

-- Murphy's Repairman's Laws (production slug differs)
UPDATE categories SET 
  description = 'Fix-it wisdom: breakdown rates are inversely proportional to finding a repairer, and anything can be a hammer.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-repairmans-laws';

-- Murphy's Tank Warfare Laws (production slug differs)
UPDATE categories SET 
  description = 'Armored combat wisdom: tanks draw fire, and hiding behind one is not wise for infantry.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-tank-warfare-laws';

COMMIT;
