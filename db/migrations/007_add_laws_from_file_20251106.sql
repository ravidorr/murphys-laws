-- Data migration: Add new laws from laws_to_add.md
-- Generated: 2025-11-06T09:09:37.104Z
-- Laws to add: 98

BEGIN TRANSACTION;

-- Add law: Alder's razor (Newton's flaming laser sword)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'alders-razor-newtons-flaming-laser-sword') THEN NULL ELSE 'alders-razor-newtons-flaming-laser-sword' END, 'Alder''s razor (Newton''s flaming laser sword)', 'What cannot be settled by experiment is not worth debating.', 'published', 'laws_to_add.md', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 1);

-- Add law: Betteridge's law of headlines
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'betteridges-law-of-headlines') THEN NULL ELSE 'betteridges-law-of-headlines' END, 'Betteridge''s law of headlines', 'Any headline posed as a question can be answered with "no."', 'published', 'laws_to_add.md', 4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 4);

-- Add law: Brandolini's law (Bullshit Asymmetry Principle)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'brandolinis-law-bullshit-asymmetry-principle') THEN NULL ELSE 'brandolinis-law-bullshit-asymmetry-principle' END, 'Brandolini''s law (Bullshit Asymmetry Principle)', 'Refuting misinformation requires an order of magnitude more effort than producing it.', 'published', 'laws_to_add.md', 7, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 7);

-- Add law: Brooks's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'brookss-law') THEN NULL ELSE 'brookss-law' END, 'Brooks''s law', 'Adding manpower to a late software project makes it later.', 'published', 'laws_to_add.md', 10, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 10);

-- Add law: Celine's First Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'celines-first-law') THEN NULL ELSE 'celines-first-law' END, 'Celine''s First Law', 'National Security is the chief cause of national insecurity.', 'published', 'laws_to_add.md', 13, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 13);

-- Add law: Celine's Second Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'celines-second-law') THEN NULL ELSE 'celines-second-law' END, 'Celine''s Second Law', 'Accurate communication is possible only in a non-punishing situation.', 'published', 'laws_to_add.md', 16, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 16);

-- Add law: Celine's Third Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'celines-third-law') THEN NULL ELSE 'celines-third-law' END, 'Celine''s Third Law', 'An honest politician is a national calamity.', 'published', 'laws_to_add.md', 19, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 19);

-- Add law: Chekhov's gun
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'chekhovs-gun') THEN NULL ELSE 'chekhovs-gun' END, 'Chekhov''s gun', 'Narrative elements should be essential; anything extraneous must be removed.', 'published', 'laws_to_add.md', 22, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 22);

-- Add law: Cheops law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'cheops-law') THEN NULL ELSE 'cheops-law' END, 'Cheops law', 'Nothing is built on schedule or within budget', 'published', 'laws_to_add.md', 25, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 25);

-- Add law: Chesterton's fence
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'chestertons-fence') THEN NULL ELSE 'chestertons-fence' END, 'Chesterton''s fence', 'Don''t change an established practice until its purpose is understood', 'published', 'laws_to_add.md', 28, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 28);

-- Add law: Claasen's logarithmic law of usefulness
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'claasens-logarithmic-law-of-usefulness') THEN NULL ELSE 'claasens-logarithmic-law-of-usefulness' END, 'Claasen''s logarithmic law of usefulness', 'Usefulness is proportional to the logarithm of technology', 'published', 'laws_to_add.md', 31, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 31);

-- Add law: Sir Arthur Charles Clarke First Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'sir-arthur-charles-clarke-first-law') THEN NULL ELSE 'sir-arthur-charles-clarke-first-law' END, 'Sir Arthur Charles Clarke First Law', 'When a distinguished but elderly scientist states that something is possible, he is almost certainly right. When he states that something is impossible, he is very probably wrong.', 'published', 'laws_to_add.md', 34, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 34);

-- Add law: Sir Arthur Charles Clarke Second Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'sir-arthur-charles-clarke-second-law') THEN NULL ELSE 'sir-arthur-charles-clarke-second-law' END, 'Sir Arthur Charles Clarke Second Law', 'The only way of discovering the limits of the possible is to venture a little way past them into the impossible.', 'published', 'laws_to_add.md', 37, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 37);

-- Add law: Sir Arthur Charles Clarke Third Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'sir-arthur-charles-clarke-third-law') THEN NULL ELSE 'sir-arthur-charles-clarke-third-law' END, 'Sir Arthur Charles Clarke Third Law', 'Any sufficiently advanced technology is indistinguishable from magic.', 'published', 'laws_to_add.md', 40, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 40);

-- Add law: Shermer's last law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'shermers-last-law') THEN NULL ELSE 'shermers-last-law' END, 'Shermer''s last law', 'Any sufficiently advanced extraterrestrial intelligence is indistinguishable from God.', 'published', 'laws_to_add.md', 43, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 43);

-- Add law: Charles Rubin Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'charles-rubin-law') THEN NULL ELSE 'charles-rubin-law' END, 'Charles Rubin Law', 'Any sufficiently advanced act of benevolence is indistinguishable from malevolence.', 'published', 'laws_to_add.md', 46, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 46);

-- Add law: Grey's law.
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'greys-law') THEN NULL ELSE 'greys-law' END, 'Grey''s law.', 'Any sufficiently advanced incompetence is indistinguishable from malice.', 'published', 'laws_to_add.md', 49, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 49);

-- Add law: Sterling's corollary to Clarke's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'sterlings-corollary-to-clarkes-law') THEN NULL ELSE 'sterlings-corollary-to-clarkes-law' END, 'Sterling''s corollary to Clarke''s law', 'Any sufficiently advanced garbage is indistinguishable from magic.', 'published', 'laws_to_add.md', 52, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 52);

-- Add law: Gehm's corollary to Sir Arthur Charles Clarke Third Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'gehms-corollary-to-sir-arthur-charles-clarke-third-law') THEN NULL ELSE 'gehms-corollary-to-sir-arthur-charles-clarke-third-law' END, 'Gehm''s corollary to Sir Arthur Charles Clarke Third Law', 'Any technology distinguishable from magic is insufficiently advanced.', 'published', 'laws_to_add.md', 55, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 55);

-- Add law: Collingridge's dilemma
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'collingridges-dilemma') THEN NULL ELSE 'collingridges-dilemma' END, 'Collingridge''s dilemma', 'Technology is easiest to regulate before its impacts are understood, but by then it may be entrenched.', 'published', 'laws_to_add.md', 58, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 58);

-- Add law: Conquest's First Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'conquests-first-law') THEN NULL ELSE 'conquests-first-law' END, 'Conquest''s First Law', 'Everyone is conservative about what he knows best.', 'published', 'laws_to_add.md', 61, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 61);

-- Add law: Conquest's Second Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'conquests-second-law') THEN NULL ELSE 'conquests-second-law' END, 'Conquest''s Second Law', 'Any organization not explicitly right-wing sooner or later becomes left-wing.', 'published', 'laws_to_add.md', 64, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 64);

-- Add law: Conquest's Third Law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'conquests-third-law') THEN NULL ELSE 'conquests-third-law' END, 'Conquest''s Third Law', 'The simplest way to explain the behavior of any bureaucratic organization is to assume that it is controlled by a cabal of its enemies.', 'published', 'laws_to_add.md', 67, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 67);

-- Add law: Conway's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'conways-law') THEN NULL ELSE 'conways-law' END, 'Conway''s law', 'The structure of software reflects the organizational structure that produced it.', 'published', 'laws_to_add.md', 70, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 70);

-- Add law: Cooper's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'coopers-law') THEN NULL ELSE 'coopers-law' END, 'Cooper''s law', 'The number of simultaneous wireless conversations doubles every 30 months.', 'published', 'laws_to_add.md', 73, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 73);

-- Add law: Cope's rule
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'copes-rule') THEN NULL ELSE 'copes-rule' END, 'Cope''s rule', 'Evolutionary lineages tend to increase in body size over time', 'published', 'laws_to_add.md', 76, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 76);

-- Add law: Crane's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'cranes-law') THEN NULL ELSE 'cranes-law' END, 'Crane''s law', 'There is no such thing as a free lunch.', 'published', 'laws_to_add.md', 79, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 79);

-- Add law: Cunningham's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'cunninghams-law') THEN NULL ELSE 'cunninghams-law' END, 'Cunningham''s law', 'The best way to get a correct answer on the Internet is to post a wrong one', 'published', 'laws_to_add.md', 82, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 82);

-- Add law: Dilbert principle
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'dilbert-principle') THEN NULL ELSE 'dilbert-principle' END, 'Dilbert principle', 'Ineffective employees are promoted to management to minimize harm.', 'published', 'laws_to_add.md', 85, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 85);

-- Add law: Doctorow's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'doctorows-law') THEN NULL ELSE 'doctorows-law' END, 'Doctorow''s law', 'Anytime someone puts a lock on something you own, against your wishes, and doesn''t give you the key, they''re not doing it for your benefit.', 'published', 'laws_to_add.md', 88, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 88);

-- Add law: Dollo's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'dollos-law') THEN NULL ELSE 'dollos-law' END, 'Dollo''s law', 'Evolution is irreversible; organisms don''t revert to ancestral states.', 'published', 'laws_to_add.md', 91, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 91);

-- Add law: Metcalfe's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'metcalfes-law') THEN NULL ELSE 'metcalfes-law' END, 'Metcalfe''s law', 'network value grows with the square of the number of users.', 'published', 'laws_to_add.md', 94, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 94);

-- Add law: Gall's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'galls-law') THEN NULL ELSE 'galls-law' END, 'Gall''s law', 'Complex systems that work evolved from simpler systems that worked.', 'published', 'laws_to_add.md', 97, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 97);

-- Add law: Gause's law (competitive exclusion)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'gauses-law-competitive-exclusion') THEN NULL ELSE 'gauses-law-competitive-exclusion' END, 'Gause''s law (competitive exclusion)', 'Complete competitors cannot coexist.', 'published', 'laws_to_add.md', 100, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 100);

-- Add law: Gell‑Mann amnesia effect
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'gellmann-amnesia-effect') THEN NULL ELSE 'gellmann-amnesia-effect' END, 'Gell‑Mann amnesia effect', 'People trust news outside their expertise even after seeing errors in familiar topics.', 'published', 'laws_to_add.md', 103, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 103);

-- Add law: Gerson's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'gersons-law') THEN NULL ELSE 'gersons-law' END, 'Gerson''s law', 'Take advantage in every situation regardless of ethics.', 'published', 'laws_to_add.md', 106, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 106);

-- Add law: Gibrat's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'gibrats-law') THEN NULL ELSE 'gibrats-law' END, 'Gibrat''s law', 'Firm size and growth are independent.', 'published', 'laws_to_add.md', 109, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 109);

-- Add law: Gibson's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'gibsons-law') THEN NULL ELSE 'gibsons-law' END, 'Gibson''s law', 'For every PhD there is an equal and opposite PhD.', 'published', 'laws_to_add.md', 112, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 112);

-- Add law: Ginsberg's Theorem Part 1 (consequence of zeroth law of thermodynamics)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'ginsbergs-theorem-part-1-consequence-of-zeroth-law-of-thermodynamics') THEN NULL ELSE 'ginsbergs-theorem-part-1-consequence-of-zeroth-law-of-thermodynamics' END, 'Ginsberg''s Theorem Part 1 (consequence of zeroth law of thermodynamics)', 'There is a game, which you are already playing.', 'published', 'laws_to_add.md', 115, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 115);

-- Add law: Ginsberg's Theorem Part 2 (consequence of first law of thermodynamics)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'ginsbergs-theorem-part-2-consequence-of-first-law-of-thermodynamics') THEN NULL ELSE 'ginsbergs-theorem-part-2-consequence-of-first-law-of-thermodynamics' END, 'Ginsberg''s Theorem Part 2 (consequence of first law of thermodynamics)', 'You cannot win in the game.', 'published', 'laws_to_add.md', 118, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 118);

-- Add law: Ginsberg's Theorem Part 3 (consequence of second law of thermodynamics)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'ginsbergs-theorem-part-3-consequence-of-second-law-of-thermodynamics') THEN NULL ELSE 'ginsbergs-theorem-part-3-consequence-of-second-law-of-thermodynamics' END, 'Ginsberg''s Theorem Part 3 (consequence of second law of thermodynamics)', 'You cannot break even in the game.', 'published', 'laws_to_add.md', 121, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 121);

-- Add law: Ginsberg's Theorem Part 4 (consequence of third law of thermodynamics)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'ginsbergs-theorem-part-4-consequence-of-third-law-of-thermodynamics') THEN NULL ELSE 'ginsbergs-theorem-part-4-consequence-of-third-law-of-thermodynamics' END, 'Ginsberg''s Theorem Part 4 (consequence of third law of thermodynamics)', 'You cannot even quit the game.', 'published', 'laws_to_add.md', 124, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 124);

-- Add law: Godwin's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'godwins-law') THEN NULL ELSE 'godwins-law' END, 'Godwin''s law', 'As an online discussion grows longer, the probability of a Nazi analogy approaches one.', 'published', 'laws_to_add.md', 127, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 127);

-- Add law: Goodhart's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'goodharts-law') THEN NULL ELSE 'goodharts-law' END, 'Goodhart''s law', 'When a measure becomes a target, it stops being a good measure.', 'published', 'laws_to_add.md', 130, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 130);

-- Add law: Greenspun's tenth rule
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'greenspuns-tenth-rule') THEN NULL ELSE 'greenspuns-tenth-rule' END, 'Greenspun''s tenth rule', 'Any sufficiently complicated C program contains a half‑implemented Common Lisp', 'published', 'laws_to_add.md', 133, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 133);

-- Add law: Hartley's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'hartleys-law') THEN NULL ELSE 'hartleys-law' END, 'Hartley''s law', 'Quantity of information is proportional to log of signal variety.', 'published', 'laws_to_add.md', 136, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 136);

-- Add law: Zawinski's Law of Software Envelopment
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'zawinskis-law-of-software-envelopment') THEN NULL ELSE 'zawinskis-law-of-software-envelopment' END, 'Zawinski''s Law of Software Envelopment', 'Every program attempts to expand until it can read mail. Those programs which cannot so expand are replaced by ones which can.', 'published', 'laws_to_add.md', 139, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 139);

-- Add law: Hick's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'hicks-law') THEN NULL ELSE 'hicks-law' END, 'Hick''s law', 'Decision time increases with the number of choices.', 'published', 'laws_to_add.md', 142, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 142);

-- Add law: Hickam's dictum
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'hickams-dictum') THEN NULL ELSE 'hickams-dictum' END, 'Hickam''s dictum', 'Patients may have multiple diseases at once', 'published', 'laws_to_add.md', 145, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 145);

-- Add law: Hofstadter's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'hofstadters-law') THEN NULL ELSE 'hofstadters-law' END, 'Hofstadter''s law', 'Tasks always take longer than expected, even when this law is considered.', 'published', 'laws_to_add.md', 148, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 148);

-- Add law: Hotelling's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'hotellings-law') THEN NULL ELSE 'hotellings-law' END, 'Hotelling''s law', 'Competing producers will make products as similar as possible.', 'published', 'laws_to_add.md', 151, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 151);

-- Add law: Hutber's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'hutbers-law') THEN NULL ELSE 'hutbers-law' END, 'Hutber''s law', 'Improvement means deterioration.', 'published', 'laws_to_add.md', 154, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 154);

-- Add law: Joy's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'joys-law') THEN NULL ELSE 'joys-law' END, 'Joy''s law', 'Most of the smartest people work for someone else.', 'published', 'laws_to_add.md', 157, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 157);

-- Add law: Kranzberg's First Law of Technology
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'kranzbergs-first-law-of-technology') THEN NULL ELSE 'kranzbergs-first-law-of-technology' END, 'Kranzberg''s First Law of Technology', 'Technology is neither good nor bad; nor is it neutral.', 'published', 'laws_to_add.md', 160, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 160);

-- Add law: Kranzberg's Second Law of Technology
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'kranzbergs-second-law-of-technology') THEN NULL ELSE 'kranzbergs-second-law-of-technology' END, 'Kranzberg''s Second Law of Technology', 'Invention is the mother of necessity.', 'published', 'laws_to_add.md', 163, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 163);

-- Add law: Kranzberg's Third Law of Technology
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'kranzbergs-third-law-of-technology') THEN NULL ELSE 'kranzbergs-third-law-of-technology' END, 'Kranzberg''s Third Law of Technology', 'Technology comes in packages, big and small.', 'published', 'laws_to_add.md', 166, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 166);

-- Add law: Kranzberg's Fourth Law of Technology
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'kranzbergs-fourth-law-of-technology') THEN NULL ELSE 'kranzbergs-fourth-law-of-technology' END, 'Kranzberg''s Fourth Law of Technology', 'Although technology might be a prime element in many public issues, nontechnical factors take precedence in technology-policy decisions.', 'published', 'laws_to_add.md', 169, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 169);

-- Add law: Kranzberg's Fifth Law of Technology
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'kranzbergs-fifth-law-of-technology') THEN NULL ELSE 'kranzbergs-fifth-law-of-technology' END, 'Kranzberg''s Fifth Law of Technology', 'All history is relevant, but the history of technology is the most relevant.', 'published', 'laws_to_add.md', 172, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 172);

-- Add law: Kranzberg's Sixth Law of Technology
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'kranzbergs-sixth-law-of-technology') THEN NULL ELSE 'kranzbergs-sixth-law-of-technology' END, 'Kranzberg''s Sixth Law of Technology', 'Technology is a very human activity-and so is the history of technology.', 'published', 'laws_to_add.md', 175, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 175);

-- Add law: Lem's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'lems-law') THEN NULL ELSE 'lems-law' END, 'Lem''s law', 'Nobody reads; if they read they don''t understand; if they understand they forget.', 'published', 'laws_to_add.md', 178, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 178);

-- Add law: Lindy's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'lindys-law') THEN NULL ELSE 'lindys-law' END, 'Lindy''s law', 'The life expectancy of something is proportional to its age.', 'published', 'laws_to_add.md', 181, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 181);

-- Add law: Linus's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'linuss-law') THEN NULL ELSE 'linuss-law' END, 'Linus''s law', 'Given enough eyeballs, all bugs are shallow.', 'published', 'laws_to_add.md', 184, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 184);

-- Add law: Littlewood's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'littlewoods-law') THEN NULL ELSE 'littlewoods-law' END, 'Littlewood''s law', 'Miracles happen about once per month to every person.', 'published', 'laws_to_add.md', 187, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 187);

-- Add law: Miller's law (communication)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'millers-law-communication') THEN NULL ELSE 'millers-law-communication' END, 'Miller''s law (communication)', 'To understand another''s statement, assume it is true and consider what it could be true of', 'published', 'laws_to_add.md', 190, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 190);

-- Add law: Mooers's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'mooerss-law') THEN NULL ELSE 'mooerss-law' END, 'Mooers''s law', 'Information will be avoided if obtaining it is more troublesome than not having it', 'published', 'laws_to_add.md', 193, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 193);

-- Add law: Neuhaus's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'neuhauss-law') THEN NULL ELSE 'neuhauss-law' END, 'Neuhaus''s law', 'wWhen orthodoxy is optional, it eventually becomes prohibited.', 'published', 'laws_to_add.md', 196, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 196);

-- Add law: Niven's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'nivens-law') THEN NULL ELSE 'nivens-law' END, 'Niven''s law', 'If time travel is possible, no time machine will be invented.', 'published', 'laws_to_add.md', 199, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 199);

-- Add law: Occam's razor
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'occams-razor') THEN NULL ELSE 'occams-razor' END, 'Occam''s razor', 'The simplest sufficient explanation is preferred.', 'published', 'laws_to_add.md', 202, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 202);

-- Add law: Overton window
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'overton-window') THEN NULL ELSE 'overton-window' END, 'Overton window', 'Politically acceptable ideas lie within a shifting range of public opinion', 'published', 'laws_to_add.md', 205, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 205);

-- Add law: Papert's principle
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'paperts-principle') THEN NULL ELSE 'paperts-principle' END, 'Papert''s principle', 'Cognitive growth depends on developing new ways to use existing knowledge.', 'published', 'laws_to_add.md', 208, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 208);

-- Add law: Pareto principle
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'pareto-principle') THEN NULL ELSE 'pareto-principle' END, 'Pareto principle', '80% of outcomes come from 20% of causes.', 'published', 'laws_to_add.md', 211, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 211);

-- Add law: Parkinson's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'parkinsons-law') THEN NULL ELSE 'parkinsons-law' END, 'Parkinson''s law', 'Work expands to fill the available time.', 'published', 'laws_to_add.md', 214, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 214);

-- Add law: Parkinson's law of triviality
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'parkinsons-law-of-triviality') THEN NULL ELSE 'parkinsons-law-of-triviality' END, 'Parkinson''s law of triviality', 'Disproportionate time is spent on trivial issues.', 'published', 'laws_to_add.md', 217, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 217);

-- Add law: Peltzman effect
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'peltzman-effect') THEN NULL ELSE 'peltzman-effect' END, 'Peltzman effect', 'Safety measures are offset by compensatory risk‑taking.', 'published', 'laws_to_add.md', 220, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 220);

-- Add law: Peter principle
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'peter-principle') THEN NULL ELSE 'peter-principle' END, 'Peter principle', 'Employees rise to their level of incompetence.', 'published', 'laws_to_add.md', 223, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 223);

-- Add law: Poe's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'poes-law') THEN NULL ELSE 'poes-law' END, 'Poe''s law', 'Without obvious humor, parody of extremism is indistinguishable from sincere extremism.', 'published', 'laws_to_add.md', 226, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 226);

-- Add law: Postel's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'postels-law') THEN NULL ELSE 'postels-law' END, 'Postel''s law', 'Be conservative in what you send and liberal in what you accept.', 'published', 'laws_to_add.md', 229, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 229);

-- Add law: Pournelle's iron law of bureaucracy
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'pournelles-iron-law-of-bureaucracy') THEN NULL ELSE 'pournelles-iron-law-of-bureaucracy' END, 'Pournelle''s iron law of bureaucracy', 'Bureaucracies end up run by people serving the bureaucracy rather than its goals.', 'published', 'laws_to_add.md', 232, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 232);

-- Add law: Price's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'prices-law') THEN NULL ELSE 'prices-law' END, 'Price''s law', 'In a given field, the square root of the number of participants produces half the output.', 'published', 'laws_to_add.md', 235, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 235);

-- Add law: Putt's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'putts-law') THEN NULL ELSE 'putts-law' END, 'Putt''s law', 'Technology is dominated by those who do not understand it; corollary: hierarchies invert competence', 'published', 'laws_to_add.md', 238, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 238);

-- Add law: Reilly's law of retail gravitation
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'reillys-law-of-retail-gravitation') THEN NULL ELSE 'reillys-law-of-retail-gravitation' END, 'Reilly''s law of retail gravitation', 'Consumers gravitate toward larger shopping centers.', 'published', 'laws_to_add.md', 241, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 241);

-- Add law: Roemer's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'roemers-law') THEN NULL ELSE 'roemers-law' END, 'Roemer''s law', 'A built hospital bed will be filled.', 'published', 'laws_to_add.md', 244, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 244);

-- Add law: Rosenthal effect (Pygmalion effect)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'rosenthal-effect-pygmalion-effect') THEN NULL ELSE 'rosenthal-effect-pygmalion-effect' END, 'Rosenthal effect (Pygmalion effect)', 'Higher expectations lead to increased performance.', 'published', 'laws_to_add.md', 247, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 247);

-- Add law: Rothbard's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'rothbards-law') THEN NULL ELSE 'rothbards-law' END, 'Rothbard''s law', 'Everyone specializes in their weakest area.', 'published', 'laws_to_add.md', 250, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 250);

-- Add law: Say's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'says-law') THEN NULL ELSE 'says-law' END, 'Say''s law', 'Supply creates its own demand in free markets', 'published', 'laws_to_add.md', 253, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 253);

-- Add law: Sayre's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'sayres-law') THEN NULL ELSE 'sayres-law' END, 'Sayre''s law', 'Disputes become more bitter as the stakes decrease', 'published', 'laws_to_add.md', 256, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 256);

-- Add law: Segal's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'segals-law') THEN NULL ELSE 'segals-law' END, 'Segal''s law', 'A person with two watches is never sure of the time', 'published', 'laws_to_add.md', 259, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 259);

-- Add law: Shirky principle
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'shirky-principle') THEN NULL ELSE 'shirky-principle' END, 'Shirky principle', 'Institutions will try to preserve the problem they claim to solve.', 'published', 'laws_to_add.md', 262, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 262);

-- Add law: Spearman's law of diminishing returns
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'spearmans-law-of-diminishing-returns') THEN NULL ELSE 'spearmans-law-of-diminishing-returns' END, 'Spearman''s law of diminishing returns', 'Predictive power of general intelligence decreases at high IQ levels.', 'published', 'laws_to_add.md', 265, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 265);

-- Add law: Stigler's law of eponymy
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'stiglers-law-of-eponymy') THEN NULL ELSE 'stiglers-law-of-eponymy' END, 'Stigler''s law of eponymy', 'No discovery is named after its original discoverer.', 'published', 'laws_to_add.md', 268, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 268);

-- Add law: Streisand effect
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'streisand-effect') THEN NULL ELSE 'streisand-effect' END, 'Streisand effect', 'Attempts to suppress information often lead to greater publicity', 'published', 'laws_to_add.md', 271, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 271);

-- Add law: Sturgeon's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'sturgeons-law') THEN NULL ELSE 'sturgeons-law' END, 'Sturgeon''s law', '90% of everything is crud.', 'published', 'laws_to_add.md', 274, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 274);

-- Add law: Tesler's law (law of conservation of complexity)
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'teslers-law-law-of-conservation-of-complexity') THEN NULL ELSE 'teslers-law-law-of-conservation-of-complexity' END, 'Tesler''s law (law of conservation of complexity)', 'Every application has an irreducible amount of complexity.', 'published', 'laws_to_add.md', 277, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 277);

-- Add law: Twyman's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'twymans-law') THEN NULL ELSE 'twymans-law' END, 'Twyman''s law', 'Interesting data are usually erroneous', 'published', 'laws_to_add.md', 280, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 280);

-- Add law: Van Loon's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'van-loons-law') THEN NULL ELSE 'van-loons-law' END, 'Van Loon''s law', 'Mechanical development is inversely related to the availability of slave labor.', 'published', 'laws_to_add.md', 283, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 283);

-- Add law: Vierordt's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'vierordts-law') THEN NULL ELSE 'vierordts-law' END, 'Vierordt''s law', 'Short durations are overestimated and long durations underestimated.', 'published', 'laws_to_add.md', 286, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 286);

-- Add law: Wiio's laws
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'wiios-laws') THEN NULL ELSE 'wiios-laws' END, 'Wiio''s laws', 'Communication usually fails, except by accident.', 'published', 'laws_to_add.md', 289, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 289);

-- Add law: Wirth's law
INSERT INTO laws (slug, title, text, status, first_seen_file_path, first_seen_line_number, created_at, updated_at) SELECT CASE WHEN EXISTS(SELECT 1 FROM laws WHERE slug = 'wirths-law') THEN NULL ELSE 'wirths-law' END, 'Wirth''s law', 'Software is getting slower more quickly than hardware is getting faster', 'published', 'laws_to_add.md', 292, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE NOT EXISTS (  SELECT 1 FROM laws   WHERE first_seen_file_path = 'laws_to_add.md'     AND first_seen_line_number = 292);

COMMIT;