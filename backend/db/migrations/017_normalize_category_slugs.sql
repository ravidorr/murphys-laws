-- Keep the seeded archive and production category URLs aligned. These slugs
-- were corrected in production but the historical seed migration retained
-- their old filenames, causing fresh SSG builds to publish stale routes.
UPDATE categories SET slug = 'murphys-4x4-car-laws' WHERE slug = 'murphys-cars-4x4-laws';
UPDATE categories SET slug = 'murphys-law-of-the-open-road' WHERE slug = 'murphys-cars-open-road-laws';
UPDATE categories SET slug = 'murphys-computer-laws' WHERE slug = 'murphys-computers-laws';
UPDATE categories SET slug = 'murphys-cowboy-action-shooting-cas-laws' WHERE slug = 'murphys-cowboy-action-shooting-laws';
UPDATE categories SET slug = 'murphys-helicopters-warfare-laws' WHERE slug = 'murphys-helicopters-war-laws';
UPDATE categories SET slug = 'murphys-marine-corps-laws' WHERE slug = 'murphys-marine-corp-laws';
UPDATE categories SET slug = 'murphys-laws-of-mechanics' WHERE slug = 'murphys-mechanics-laws';
UPDATE categories SET slug = 'murphys-repairmans-laws' WHERE slug = 'murphys-repairmen-laws';
UPDATE categories SET slug = 'murphys-tank-warfare-laws' WHERE slug = 'murphys-tanks-war-laws';
