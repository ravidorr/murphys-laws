-- Populate categories table from markdown files
-- Generated: 2025-11-08T22:30:13.034Z
-- Categories to add: 55

BEGIN TRANSACTION;

-- Add category: Murphy's Alarm Clock Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-alarm-clock-laws', 'Murphy''s Alarm Clock Laws', '../shared/data/murphys-laws/murphys-alarm-clock-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Bus Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-bus-laws', 'Murphy''s Bus Laws', '../shared/data/murphys-laws/murphys-bus-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's 4X4 Car Laws Section
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-cars-4x4-laws', 'Murphy''s 4X4 Car Laws Section', '../shared/data/murphys-laws/murphys-cars-4x4-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Cars Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-cars-laws', 'Murphy''s Cars Laws', '../shared/data/murphys-laws/murphys-cars-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Law of the Open Road
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-cars-open-road-laws', 'Murphy''s Law of the Open Road', '../shared/data/murphys-laws/murphys-cars-open-road-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's College Student Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-college-student-laws', 'Murphy''s College Student Laws', '../shared/data/murphys-laws/murphys-college-student-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Commerce Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-commerce-laws', 'Murphy''s Commerce Laws', '../shared/data/murphys-laws/murphys-commerce-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Computer Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-computers-laws', 'Murphy''s Computer Laws', '../shared/data/murphys-laws/murphys-computers-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Cops Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-cops-laws', 'Murphy''s Cops Laws', '../shared/data/murphys-laws/murphys-cops-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Cowboy Action Shooting (CAS) Laws[^1]
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-cowboy-action-shooting-laws', 'Murphy''s Cowboy Action Shooting (CAS) Laws[^1]', '../shared/data/murphys-laws/murphys-cowboy-action-shooting-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Desert War Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-desert-war-laws', 'Murphy''s Desert War Laws', '../shared/data/murphys-laws/murphys-desert-war-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Elevator Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-elevator-laws', 'Murphy''s Elevator Laws', '../shared/data/murphys-laws/murphys-elevator-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Employees Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-employees-laws', 'Murphy''s Employees Laws', '../shared/data/murphys-laws/murphys-employees-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's EMT Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-emt-laws', 'Murphy''s EMT Laws', '../shared/data/murphys-laws/murphys-emt-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Fighting Airplanes Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-fighting-airplanes-laws', 'Murphy''s Fighting Airplanes Laws', '../shared/data/murphys-laws/murphys-fighting-airplanes-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Game Mastering Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-game-mastering-laws', 'Murphy''s Game Mastering Laws', '../shared/data/murphys-laws/murphys-game-mastering-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Golf Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-golf-laws', 'Murphy''s Golf Laws', '../shared/data/murphys-laws/murphys-golf-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Graphic Design Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-graphic-design-laws', 'Murphy''s Graphic Design Laws', '../shared/data/murphys-laws/murphys-graphic-design-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Gravity Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-gravity-laws', 'Murphy''s Gravity Laws', '../shared/data/murphys-laws/murphys-gravity-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Helicopters Warfare Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-helicopters-war-laws', 'Murphy''s Helicopters Warfare Laws', '../shared/data/murphys-laws/murphys-helicopters-war-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Horse Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-horse-laws', 'Murphy''s Horse Laws', '../shared/data/murphys-laws/murphys-horse-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Jagged Alliance 2 Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-jagged-alliance-2-laws', 'Murphy''s Jagged Alliance 2 Laws', '../shared/data/murphys-laws/murphys-jagged-alliance-2-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-laws', 'Murphy''s Laws', '../shared/data/murphys-laws/murphys-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Lotto Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-lotto-laws', 'Murphy''s Lotto Laws', '../shared/data/murphys-laws/murphys-lotto-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Love Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-love-laws', 'Murphy''s Love Laws', '../shared/data/murphys-laws/murphys-love-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Marine Corps Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-marine-corp-laws', 'Murphy''s Marine Corps Laws', '../shared/data/murphys-laws/murphys-marine-corp-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Martial Arts Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-martial-arts-laws', 'Murphy''s Martial Arts Laws', '../shared/data/murphys-laws/murphys-martial-arts-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Laws of Mechanics
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-mechanics-laws', 'Murphy''s Laws of Mechanics', '../shared/data/murphys-laws/murphys-mechanics-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Microbiology Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-microbiology-laws', 'Murphy''s Microbiology Laws', '../shared/data/murphys-laws/murphys-microbiology-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Military Police Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-military-police-laws', 'Murphy''s Military Police Laws', '../shared/data/murphys-laws/murphys-military-police-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Miscellaneous Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-miscellaneous-laws', 'Murphy''s Miscellaneous Laws', '../shared/data/murphys-laws/murphys-miscellaneous-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Mother's Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-mothers-laws', 'Murphy''s Mother''s Laws', '../shared/data/murphys-laws/murphys-mothers-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Music Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-music-laws', 'Murphy''s Music Laws', '../shared/data/murphys-laws/murphys-music-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Nurses Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-nurses-laws', 'Murphy''s Nurses Laws', '../shared/data/murphys-laws/murphys-nurses-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Office Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-office-laws', 'Murphy''s Office Laws', '../shared/data/murphys-laws/murphys-office-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Photography Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-photography-laws', 'Murphy''s Photography Laws', '../shared/data/murphys-laws/murphys-photography-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Political Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-political-laws', 'Murphy''s Political Laws', '../shared/data/murphys-laws/murphys-political-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Printing Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-printing-laws', 'Murphy''s Printing Laws', '../shared/data/murphys-laws/murphys-printing-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Real Estate Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-real-estate-laws', 'Murphy''s Real Estate Laws', '../shared/data/murphys-laws/murphys-real-estate-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Rental Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-rental-laws', 'Murphy''s Rental Laws', '../shared/data/murphys-laws/murphys-rental-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Repairman's Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-repairmen-laws', 'Murphy''s Repairman''s Laws', '../shared/data/murphys-laws/murphys-repairmen-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Role-Playing by Internet Message Board Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-role-playing-by-internet-message-board-laws', 'Murphy''s Role-Playing by Internet Message Board Laws', '../shared/data/murphys-laws/murphys-role-playing-by-internet-message-board-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Scouting Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-scouting-laws', 'Murphy''s Scouting Laws', '../shared/data/murphys-laws/murphys-scouting-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Sewing Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-sewing-laws', 'Murphy''s Sewing Laws', '../shared/data/murphys-laws/murphys-sewing-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Sport Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-sport-laws', 'Murphy''s Sport Laws', '../shared/data/murphys-laws/murphys-sport-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Tank Warfare Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-tanks-war-laws', 'Murphy''s Tank Warfare Laws', '../shared/data/murphys-laws/murphys-tanks-war-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Teaching Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-teaching-laws', 'Murphy''s Teaching Laws', '../shared/data/murphys-laws/murphys-teaching-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Technology Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-technology-laws', 'Murphy''s Technology Laws', '../shared/data/murphys-laws/murphys-technology-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Toddlers Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-toddlers-laws', 'Murphy''s Toddlers Laws', '../shared/data/murphys-laws/murphys-toddlers-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Transformers Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-transformers-laws', 'Murphy''s Transformers Laws', '../shared/data/murphys-laws/murphys-transformers-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Travel Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-travel-laws', 'Murphy''s Travel Laws', '../shared/data/murphys-laws/murphys-travel-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's TV Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-tv-laws', 'Murphy''s TV Laws', '../shared/data/murphys-laws/murphys-tv-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Unformatted Character Sheets Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-unformatted-character-sheets-laws', 'Murphy''s Unformatted Character Sheets Laws', '../shared/data/murphys-laws/murphys-unformatted-character-sheets-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's Volunteer Bushfire Brigade Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-volunteer-bushfire-brigade-laws', 'Murphy''s Volunteer Bushfire Brigade Laws', '../shared/data/murphys-laws/murphys-volunteer-bushfire-brigade-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Add category: Murphy's War Laws
INSERT INTO categories (slug, title, source_file_path, created_at, updated_at)
VALUES ('murphys-war-laws', 'Murphy''s War Laws', '../shared/data/murphys-laws/murphys-war-laws.md', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  source_file_path = excluded.source_file_path,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

COMMIT;