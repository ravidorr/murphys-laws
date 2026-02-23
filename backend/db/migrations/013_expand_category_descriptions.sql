-- Expand category descriptions to 2-4 sentences for stronger editorial value (AdSense).
-- Replaces one-liners from 010 with unique, substantive copy per category.

BEGIN TRANSACTION;

-- Murphy's Alarm Clock Laws
UPDATE categories SET
  description = 'Why your alarm never works when you need it most, and the snooze button is humanity''s greatest invention. Morning people and night owls alike find that the one day they set the alarm early, they wake before it. These laws capture the universal truth that time and consciousness are never in sync.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-alarm-clock-laws';

-- Murphy's Bus Laws
UPDATE categories SET
  description = 'The cosmic conspiracy ensuring buses arrive early when you''re late and late when you''re early. Public transit follows its own logic: the bus you need just left, and three others arrive at once when you don''t need them. This collection documents the unwritten rules of waiting.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-bus-laws';

-- Murphy's 4X4 Car Laws Section
UPDATE categories SET
  description = 'Off-road truths: mud is always deeper, winches are always shorter, and tires blow when you need them most. Every trail has a section that looked fine from the cab. These laws remind 4x4 enthusiasts that the terrain has a vote.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cars-4x4-laws';

-- Murphy's Cars Laws
UPDATE categories SET
  description = 'Automotive axioms proving cars break at the worst times and washing them summons rain. The check-engine light appears the day after the warranty expires. Browse laws that every driver and mechanic knows to be true.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cars-laws';

-- Murphy's Law of the Open Road
UPDATE categories SET
  description = 'Traffic laws of the universe: red lights last forever, and two cars always meet at a one-way bridge. Lane changes trigger slowdowns; the fast lane is never fast when you need it. These laws govern the road beyond the rulebook.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cars-open-road-laws';

-- Murphy's College Student Laws
UPDATE categories SET
  description = 'Academic survival truths: printers die before deadlines, and the exam covers what you didn''t study. The library is full except when you have a presentation; group projects divide work inversely to effort. Students and faculty alike contribute to this canon.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-college-student-laws';

-- Murphy's Commerce Laws
UPDATE categories SET
  description = 'Business wisdom: the first 90% takes 90% of the time, the last 10% takes the other 90%. Deadlines slip, budgets overrun, and the client changes the brief after sign-off. These laws distill decades of project and organizational reality.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-commerce-laws';

-- Murphy's Computer Laws
UPDATE categories SET
  description = 'Digital doom: programs are obsolete when running, bugs appear after the author leaves, and backups fail when needed. Hardware fails in warranty''s final week; the fix that worked in dev never works in prod. A foundational category for anyone in tech.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-computers-laws';

-- Murphy's Cops Laws
UPDATE categories SET
  description = 'Law enforcement realities: bulletproof vests aren''t, and the better you do your job, the more trouble you get. Paperwork expands to fill the shift; the suspect you need is always in the next jurisdiction. These laws reflect the street-level view.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cops-laws';

-- Murphy's Cowboy Action Shooting (CAS) Laws
UPDATE categories SET
  description = 'Western shooting sports wisdom: guns jam at the worst moment, and the whiter the hat, the deeper the mud. Stage design and timing conspire against clean runs. CAS competitors have codified what goes wrong when the timer starts.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-cowboy-action-shooting-laws';

-- Murphy's Desert War Laws
UPDATE categories SET
  description = 'Desert combat truths: roads are always mined, and soldier effectiveness drops with equipment weight. Sand gets into everything; the enemy has the high ground and the shade. This category captures military experience in arid theater.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-desert-war-laws';

-- Murphy's Elevator Laws
UPDATE categories SET
  description = 'Vertical transport paradoxes: the last person in goes to the lowest floor, and elevators fail when you''re carrying heavy loads. The car you need is always the one that just left. These laws govern the physics and psychology of going up and down.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-elevator-laws';

-- Murphy's Employees Laws
UPDATE categories SET
  description = 'Workplace wisdom: the ideal job was filled before you knew about it, and your current boss is the worst until the next one. Meetings expand to fill the calendar; the raise you deserve arrives after you quit. A category for everyone who has ever had a job.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-employees-laws';

-- Murphy's EMT Laws
UPDATE categories SET
  description = 'Emergency medical truths: air goes in and out, blood goes round and round, any variation is bad. The worst calls happen at shift change; equipment fails when the patient needs it most. EMS crews have turned experience into law.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-emt-laws';

-- Murphy's Fighting Airplanes Laws
UPDATE categories SET
  description = 'Aerial combat realities: the enemy has the advantage, and your cannon jams when you need it most. Altitude and speed are never quite where you want them in a merge. Pilots and historians have contributed these sky-high axioms.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-fighting-airplanes-laws';

-- Murphy's Game Mastering Laws
UPDATE categories SET
  description = 'Tabletop RPG truths: players find every flaw in your plan, and the main villain dies in one lucky shot. The plot you prepared is ignored; the throwaway NPC becomes the star. GMs and players alike have added to this collection.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-game-mastering-laws';

-- Murphy's Golf Laws
UPDATE categories SET
  description = 'Links wisdom: your aim is never right, and rain is God''s way of saying you''re playing too slowly. The ball finds water and sand; the putt that mattered always lips out. Golfers have long known that the course has a sense of humor.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-golf-laws';

-- Murphy's Graphic Design Laws
UPDATE categories SET
  description = 'Creative industry truths: fonts default, clients don''t get it, and everyone thinks they''re a designer. Revisions multiply until the original is "perfect"; the file that crashed was the one without a backup. Designers have codified the chaos.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-graphic-design-laws';

-- Murphy's Gravity Laws
UPDATE categories SET
  description = 'Physics of falling objects: dropped tools roll to the center underneath your car, and valuable items land face down. Buttered toast prefers the carpet; the one screw you need vanishes into the grass. Gravity is unbiased but rarely helpful.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-gravity-laws';

-- Murphy's Helicopters Warfare Laws
UPDATE categories SET
  description = 'Rotorcraft combat wisdom: tail rotors seek trees, and running out of airspeed, altitude, and ideas is bad. The LZ is always hot; the part that fails has no spare. Helicopter crews have turned hard lessons into lasting laws.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-helicopters-war-laws';

-- Murphy's Horse Laws
UPDATE categories SET
  description = 'Equestrian truths: a horse''s misbehavior scales with the audience size, and hoof picks migrate. The horse you want to sell goes perfectly; the one you keep finds new ways to worry the vet. Riders and stable hands have added to this list.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-horse-laws';

-- Murphy's Jagged Alliance 2 Laws
UPDATE categories SET
  description = 'Tactical video game wisdom: you run out of medical kits when mercs get hurt, and there''s no cover when the game wants you hit. Critical shots miss; the enemy always has one more soldier. JA2 players have documented the game''s cruel logic.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-jagged-alliance-2-laws';

-- Murphy's Laws
UPDATE categories SET
  description = 'The foundational laws of everything going wrong: if it can go wrong, it will, at the worst possible moment. This category holds the originals and the classics that started it all. Here you find the core principles that other categories expand into domain-specific truth.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-laws';

-- Murphy's Lotto Laws
UPDATE categories SET
  description = 'Lottery truths: you''ll have all the numbers but forgot to buy the ticket, or win and discover 3000 others did too. The jackpot grows when you skip a week; your numbers come up the day you forget to play. Hope and probability collide in these laws.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-lotto-laws';

-- Murphy's Love Laws
UPDATE categories SET
  description = 'Romance realities: all the good ones are taken, and availability is inversely proportional to desirability. The one you want is never single when you are; timing is always wrong. These laws map the uncharted territory of the heart.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-love-laws';

-- Murphy's Marine Corps Laws
UPDATE categories SET
  description = 'Semper Fi wisdom: it never rains in the Marine Corps, it rains on the Marine Corps. Gear fails in the field; the op order changes at the last minute. Marines have turned shared experience into a durable set of laws.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-marine-corp-laws';

-- Murphy's Martial Arts Laws
UPDATE categories SET
  description = 'Dojo truths: the wimp becomes Bruce Lee when you face him, and you''ll pull a muscle before your black belt exam. The technique you practiced fails in sparring; the master is always watching when you slack. Students and instructors contribute to this category.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-martial-arts-laws';

-- Murphy's Laws of Mechanics
UPDATE categories SET
  description = 'Workshop wisdom: if it doesn''t fit, force it; if it breaks, it needed replacing anyway. The right tool is in the other bay; the bolt you need is the one that rolled away. Mechanics and DIYers have codified the garage''s unwritten rules.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-mechanics-laws';

-- Murphy's Microbiology Laws
UPDATE categories SET
  description = 'Lab truths: contaminants always appear, required cultures never give isolated colonies, and viable cultures mutate. The sample you need is contaminated; the protocol works until you need to publish. Bench scientists have turned frustration into law.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-microbiology-laws';

-- Murphy's Military Police Laws
UPDATE categories SET
  description = 'MP wisdom: empty guns aren''t, and the suspect will escape just before you set up the perimeter. Paperwork multiplies with the seriousness of the incident; the one witness leaves before you get a statement. This category reflects the unique pressures of military law enforcement.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-military-police-laws';

-- Murphy's Miscellaneous Laws
UPDATE categories SET
  description = 'Random universal truths that defy categorization but prove Murphy was onto something. When in doubt, it goes here: the laws that apply everywhere and nowhere in particular. This collection grows with the odd, the general, and the uncategorizable.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-miscellaneous-laws';

-- Murphy's Mother's Laws
UPDATE categories SET
  description = 'Parenting truths: children ask for things only after you sit down, and you can''t fool Mom. The mess appears in the room you just cleaned; the urgent need arises at bedtime. Mothers (and fathers) have contributed laws that span generations.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-mothers-laws';

-- Murphy's Music Laws
UPDATE categories SET
  description = 'Band and orchestra wisdom: percussionists lose music, instruments break before concerts, and one more time never is. The soloist gets sick on performance day; the tuning is never quite right. Musicians have documented what goes wrong when the downbeat comes.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-music-laws';

-- Murphy's Nurses Laws
UPDATE categories SET
  description = 'Healthcare truths: patients pull tubes before rounds, and the doctor''s handwriting gets worse with importance. The crash happens at shift change; the family has questions when you have no time. Nurses have turned the floor''s reality into lasting laws.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-nurses-laws';

-- Murphy's Office Laws
UPDATE categories SET
  description = 'Cubicle wisdom: printers jam when you need them, and you bump into the boss only when you''re late. The meeting could have been an email; the coffee runs out before your turn. Office workers have codified the daily grind.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-office-laws';

-- Murphy's Photography Laws
UPDATE categories SET
  description = 'Camera wisdom: auto focus won''t, the most critical roll is fogged, and strobes explode when people watch. The shot of a lifetime happens when the battery dies; the card fills at the decisive moment. Photographers have documented the medium''s cruel timing.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-photography-laws';

-- Murphy's Political Laws
UPDATE categories SET
  description = 'Governance truths: no matter who gets elected, the government always gets in. Promises and outcomes diverge; the scandal breaks when the polls close. This category collects the laws that transcend party and country.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-political-laws';

-- Murphy's Printing Laws
UPDATE categories SET
  description = 'Print queue wisdom: your job is always behind the largest one, and when fixed, it''s out of toner. The jam is in the place you can''t reach; the deadline is when the machine goes down. Print shops and office veterans have added to this list.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-printing-laws';

-- Murphy's Real Estate Laws
UPDATE categories SET
  description = 'Landlord wisdom: tenants flush everything, relatives die monthly, and the hardware store closes before you arrive. The repair you deferred becomes urgent at 2 a.m.; the market turns the day after you sign. Property owners and managers know these laws well.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-real-estate-laws';

-- Murphy's Rental Laws
UPDATE categories SET
  description = 'Borrowing truths: the movie you want is never available, and library books are always checked out. Due dates and need align only by accident; the item you return late is the one with the highest fine. Renters have documented the asymmetry of temporary access.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-rental-laws';

-- Murphy's Repairman's Laws
UPDATE categories SET
  description = 'Fix-it wisdom: breakdown rates are inversely proportional to finding a repairer, and anything can be a hammer. The part you need is discontinued; the manual is in the wrong language. Repairmen and tinkerers have turned experience into law.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-repairmen-laws';

-- Murphy's Role-Playing by Internet Message Board Laws
UPDATE categories SET
  description = 'Online RPG truths: nobody knows whose fault it is that the story isn''t moving, and the GM is never online. The critical post gets lost in the thread; the campaign dies when real life intervenes. Play-by-post veterans have codified the format''s pitfalls.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-role-playing-by-internet-message-board-laws';

-- Murphy's Scouting Laws
UPDATE categories SET
  description = 'Outdoor youth wisdom: rain always happens on hikes, and when counting kids, one is always missing. The knot you need is the one you didn''t practice; the first-aid kit is back at camp. Scouts and leaders have added to this outdoor canon.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-scouting-laws';

-- Murphy's Sewing Laws
UPDATE categories SET
  description = 'Crafting truths: bobbin thread runs out at crucial moments, and the magnitude of goofs matches fabric cost. The seam ripper is in the other room; the pattern piece is missing when you need it. Sewers and quilters have documented the craft''s stubborn logic.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-sewing-laws';

-- Murphy's Sport Laws
UPDATE categories SET
  description = 'Fan wisdom: if you watch your team in a crucial game, they lose; you''ll miss their greatest win. The star gets injured before the playoffs; the ref sees everything except the foul on your side. Sports fans have turned heartbreak into law.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-sport-laws';

-- Murphy's Tank Warfare Laws
UPDATE categories SET
  description = 'Armored combat wisdom: tanks draw fire, and hiding behind one is not wise for infantry. The tread breaks when you need mobility; resupply arrives after you need it. Armor crews and historians have contributed these battlefield truths.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-tanks-war-laws';

-- Murphy's Teaching Laws
UPDATE categories SET
  description = 'Education truths: the clock is wrong, disaster occurs with visitors, and 80% of the exam covers what you missed. The projector fails on observation day; the best lesson plan is the one you never get to. Teachers have codified the classroom''s unwritten rules.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-teaching-laws';

-- Murphy's Technology Laws
UPDATE categories SET
  description = 'Tech truths: to err is human, to really foul things up requires a computer. Systems fail at peak load; the update that was supposed to fix things breaks something else. This category spans hardware, software, and the human factor.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-technology-laws';

-- Murphy's Toddlers Laws
UPDATE categories SET
  description = 'Parenting small humans: they want to walk when you carry them and be carried when you want them to walk. The food they loved yesterday is poison today; silence means trouble. Parents of toddlers have documented the chaos with love.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-toddlers-laws';

-- Murphy's Transformers Laws
UPDATE categories SET
  description = 'Cybertronian wisdom: if Hasbro doesn''t want to sell your toy, they''ll find a way to kill you. The figure you want is wave one and long gone; the transformation step you need is in the diagram you lost. Collectors and fans have expanded this niche with humor.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-transformers-laws';

-- Murphy's Travel Laws
UPDATE categories SET
  description = 'Journey truths: gate distance increases with luggage weight and decreases with available time. Flights delay when you have a connection; the hotel loses your reservation when you arrive at midnight. Travelers have codified what goes wrong between here and there.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-travel-laws';

-- Murphy's TV Laws
UPDATE categories SET
  description = 'Television wisdom: your favorite show gets cancelled, and the VCR runs out during the only new episode. Spoilers find you before you catch up; the remote is always in the other room. Viewers have documented the small screen''s cruel logic.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-tv-laws';

-- Murphy's Unformatted Character Sheets Laws
UPDATE categories SET
  description = 'Campaign planning truths: organized, complete, readable - pick two; and work invested scales inversely with player interest. The backstory you wrote never comes up; the NPC you winged becomes the party''s favorite. GMs have turned prep and improvisation into law.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-unformatted-character-sheets-laws';

-- Murphy's Volunteer Bushfire Brigade Laws
UPDATE categories SET
  description = 'Firefighting wisdom: falling trees have right of way, and CHAOS means Chiefs Have Arrived On Scene. The wind changes when you need it steady; the tank runs dry at the wrong moment. Volunteer firefighters have documented the field''s harsh realities.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-volunteer-bushfire-brigade-laws';

-- Murphy's War Laws
UPDATE categories SET
  description = 'Combat truths: friendly fire isn''t, recoilless rifles aren''t, and if your attack is going well, it''s an ambush. Supply and demand are never in balance when it matters; the map is wrong. Soldiers and historians have contributed these enduring laws.',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE slug = 'murphys-war-laws';

COMMIT;
