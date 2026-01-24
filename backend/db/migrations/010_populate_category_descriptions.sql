-- Populate category descriptions based on the laws in each category
-- Generated: 2026-01-23

BEGIN TRANSACTION;

-- Murphy's Alarm Clock Laws
UPDATE categories SET 
  description = 'Why your alarm never works when you need it most, and the snooze button is humanity''s greatest invention.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-alarm-clock-laws';

-- Murphy's Bus Laws
UPDATE categories SET 
  description = 'The cosmic conspiracy ensuring buses arrive early when you''re late and late when you''re early.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-bus-laws';

-- Murphy's 4X4 Car Laws Section
UPDATE categories SET 
  description = 'Off-road truths: mud is always deeper, winches are always shorter, and tires blow when you need them most.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cars-4x4-laws';

-- Murphy's Cars Laws
UPDATE categories SET 
  description = 'Automotive axioms proving cars break at the worst times and washing them summons rain.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cars-laws';

-- Murphy's Law of the Open Road
UPDATE categories SET 
  description = 'Traffic laws of the universe: red lights last forever, and two cars always meet at a one-way bridge.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cars-open-road-laws';

-- Murphy's College Student Laws
UPDATE categories SET 
  description = 'Academic survival truths: printers die before deadlines, and the exam covers what you didn''t study.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-college-student-laws';

-- Murphy's Commerce Laws
UPDATE categories SET 
  description = 'Business wisdom: the first 90% takes 90% of the time, the last 10% takes the other 90%.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-commerce-laws';

-- Murphy's Computer Laws
UPDATE categories SET 
  description = 'Digital doom: programs are obsolete when running, bugs appear after the author leaves, and backups fail when needed.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-computers-laws';

-- Murphy's Cops Laws
UPDATE categories SET 
  description = 'Law enforcement realities: bulletproof vests aren''t, and the better you do your job, the more trouble you get.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cops-laws';

-- Murphy's Cowboy Action Shooting (CAS) Laws
UPDATE categories SET 
  description = 'Western shooting sports wisdom: guns jam at the worst moment, and the whiter the hat, the deeper the mud.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cowboy-action-shooting-laws';

-- Murphy's Desert War Laws
UPDATE categories SET 
  description = 'Desert combat truths: roads are always mined, and soldier effectiveness drops with equipment weight.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-desert-war-laws';

-- Murphy's Elevator Laws
UPDATE categories SET 
  description = 'Vertical transport paradoxes: the last person in goes to the lowest floor, and elevators fail when you''re carrying heavy loads.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-elevator-laws';

-- Murphy's Employees Laws
UPDATE categories SET 
  description = 'Workplace wisdom: the ideal job was filled before you knew about it, and your current boss is the worst until the next one.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-employees-laws';

-- Murphy's EMT Laws
UPDATE categories SET 
  description = 'Emergency medical truths: air goes in and out, blood goes round and round, any variation is bad.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-emt-laws';

-- Murphy's Fighting Airplanes Laws
UPDATE categories SET 
  description = 'Aerial combat realities: the enemy has the advantage, and your cannon jams when you need it most.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-fighting-airplanes-laws';

-- Murphy's Game Mastering Laws
UPDATE categories SET 
  description = 'Tabletop RPG truths: players find every flaw in your plan, and the main villain dies in one lucky shot.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-game-mastering-laws';

-- Murphy's Golf Laws
UPDATE categories SET 
  description = 'Links wisdom: your aim is never right, and rain is God''s way of saying you''re playing too slowly.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-golf-laws';

-- Murphy's Graphic Design Laws
UPDATE categories SET 
  description = 'Creative industry truths: fonts default, clients don''t get it, and everyone thinks they''re a designer.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-graphic-design-laws';

-- Murphy's Gravity Laws
UPDATE categories SET 
  description = 'Physics of falling objects: dropped tools roll to the center underneath your car, and valuable items land face down.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-gravity-laws';

-- Murphy's Helicopters Warfare Laws
UPDATE categories SET 
  description = 'Rotorcraft combat wisdom: tail rotors seek trees, and running out of airspeed, altitude, and ideas is bad.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-helicopters-war-laws';

-- Murphy's Horse Laws
UPDATE categories SET 
  description = 'Equestrian truths: a horse''s misbehavior scales with the audience size, and hoof picks migrate.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-horse-laws';

-- Murphy's Jagged Alliance 2 Laws
UPDATE categories SET 
  description = 'Tactical video game wisdom: you run out of medical kits when mercs get hurt, and there''s no cover when the game wants you hit.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-jagged-alliance-2-laws';

-- Murphy's Laws
UPDATE categories SET 
  description = 'The foundational laws of everything going wrong: if it can go wrong, it will, at the worst possible moment.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-laws';

-- Murphy's Lotto Laws
UPDATE categories SET 
  description = 'Lottery truths: you''ll have all the numbers but forgot to buy the ticket, or win and discover 3000 others did too.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-lotto-laws';

-- Murphy's Love Laws
UPDATE categories SET 
  description = 'Romance realities: all the good ones are taken, and availability is inversely proportional to desirability.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-love-laws';

-- Murphy's Marine Corps Laws
UPDATE categories SET 
  description = 'Semper Fi wisdom: it never rains in the Marine Corps, it rains on the Marine Corps.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-marine-corp-laws';

-- Murphy's Martial Arts Laws
UPDATE categories SET 
  description = 'Dojo truths: the wimp becomes Bruce Lee when you face him, and you''ll pull a muscle before your black belt exam.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-martial-arts-laws';

-- Murphy's Laws of Mechanics
UPDATE categories SET 
  description = 'Workshop wisdom: if it doesn''t fit, force it; if it breaks, it needed replacing anyway.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-mechanics-laws';

-- Murphy's Microbiology Laws
UPDATE categories SET 
  description = 'Lab truths: contaminants always appear, required cultures never give isolated colonies, and viable cultures mutate.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-microbiology-laws';

-- Murphy's Military Police Laws
UPDATE categories SET 
  description = 'MP wisdom: empty guns aren''t, and the suspect will escape just before you set up the perimeter.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-military-police-laws';

-- Murphy's Miscellaneous Laws
UPDATE categories SET 
  description = 'Random universal truths that defy categorization but prove Murphy was onto something.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-miscellaneous-laws';

-- Murphy's Mother's Laws
UPDATE categories SET 
  description = 'Parenting truths: children ask for things only after you sit down, and you can''t fool Mom.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-mothers-laws';

-- Murphy's Music Laws
UPDATE categories SET 
  description = 'Band and orchestra wisdom: percussionists lose music, instruments break before concerts, and one more time never is.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-music-laws';

-- Murphy's Nurses Laws
UPDATE categories SET 
  description = 'Healthcare truths: patients pull tubes before rounds, and the doctor''s handwriting gets worse with importance.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-nurses-laws';

-- Murphy's Office Laws
UPDATE categories SET 
  description = 'Cubicle wisdom: printers jam when you need them, and you bump into the boss only when you''re late.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-office-laws';

-- Murphy's Photography Laws
UPDATE categories SET 
  description = 'Camera wisdom: auto focus won''t, the most critical roll is fogged, and strobes explode when people watch.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-photography-laws';

-- Murphy's Political Laws
UPDATE categories SET 
  description = 'Governance truths: no matter who gets elected, the government always gets in.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-political-laws';

-- Murphy's Printing Laws
UPDATE categories SET 
  description = 'Print queue wisdom: your job is always behind the largest one, and when fixed, it''s out of toner.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-printing-laws';

-- Murphy's Real Estate Laws
UPDATE categories SET 
  description = 'Landlord wisdom: tenants flush everything, relatives die monthly, and the hardware store closes before you arrive.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-real-estate-laws';

-- Murphy's Rental Laws
UPDATE categories SET 
  description = 'Borrowing truths: the movie you want is never available, and library books are always checked out.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-rental-laws';

-- Murphy's Repairman's Laws
UPDATE categories SET 
  description = 'Fix-it wisdom: breakdown rates are inversely proportional to finding a repairer, and anything can be a hammer.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-repairmen-laws';

-- Murphy's Role-Playing by Internet Message Board Laws
UPDATE categories SET 
  description = 'Online RPG truths: nobody knows whose fault it is that the story isn''t moving, and the GM is never online.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-role-playing-by-internet-message-board-laws';

-- Murphy's Scouting Laws
UPDATE categories SET 
  description = 'Outdoor youth wisdom: rain always happens on hikes, and when counting kids, one is always missing.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-scouting-laws';

-- Murphy's Sewing Laws
UPDATE categories SET 
  description = 'Crafting truths: bobbin thread runs out at crucial moments, and the magnitude of goofs matches fabric cost.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-sewing-laws';

-- Murphy's Sport Laws
UPDATE categories SET 
  description = 'Fan wisdom: if you watch your team in a crucial game, they lose; you''ll miss their greatest win.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-sport-laws';

-- Murphy's Tank Warfare Laws
UPDATE categories SET 
  description = 'Armored combat wisdom: tanks draw fire, and hiding behind one is not wise for infantry.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-tanks-war-laws';

-- Murphy's Teaching Laws
UPDATE categories SET 
  description = 'Education truths: the clock is wrong, disaster occurs with visitors, and 80% of the exam covers what you missed.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-teaching-laws';

-- Murphy's Technology Laws
UPDATE categories SET 
  description = 'Tech truths: to err is human, to really foul things up requires a computer.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-technology-laws';

-- Murphy's Toddlers Laws
UPDATE categories SET 
  description = 'Parenting small humans: they want to walk when you carry them and be carried when you want them to walk.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-toddlers-laws';

-- Murphy's Transformers Laws
UPDATE categories SET 
  description = 'Cybertronian wisdom: if Hasbro doesn''t want to sell your toy, they''ll find a way to kill you.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-transformers-laws';

-- Murphy's Travel Laws
UPDATE categories SET 
  description = 'Journey truths: gate distance increases with luggage weight and decreases with available time.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-travel-laws';

-- Murphy's TV Laws
UPDATE categories SET 
  description = 'Television wisdom: your favorite show gets cancelled, and the VCR runs out during the only new episode.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-tv-laws';

-- Murphy's Unformatted Character Sheets Laws
UPDATE categories SET 
  description = 'Campaign planning truths: organized, complete, readable - pick two; and work invested scales inversely with player interest.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-unformatted-character-sheets-laws';

-- Murphy's Volunteer Bushfire Brigade Laws
UPDATE categories SET 
  description = 'Firefighting wisdom: falling trees have right of way, and CHAOS means Chiefs Have Arrived On Scene.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-volunteer-bushfire-brigade-laws';

-- Murphy's War Laws
UPDATE categories SET 
  description = 'Combat truths: friendly fire isn''t, recoilless rifles aren''t, and if your attack is going well, it''s an ambush.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-war-laws';

COMMIT;
