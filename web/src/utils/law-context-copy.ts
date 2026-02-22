/**
 * Short editorial "In context" copy for law detail pages, keyed by primary category slug.
 * Used to add substantial unique content per law page for quality and AdSense requirements.
 */

const CATEGORY_CONTEXT: Record<string, string> = {
  'murphys-laws':
    "Murphy's Law and its corollaries capture a universal truth about risk and human error: when stakes are high, the unexpected becomes inevitable. Engineers and safety experts use these principles to design for failure and reduce harm.",
  'murphys-computers-laws':
    "Computer science has produced some of the most cited Murphy-style laws, from backup failures to the inevitability of bugs. These observations help teams plan for outages and avoid overconfidence in systems.",
  'murphys-technology-laws':
    "Technology amplifies both capability and the cost of failure. Laws in this category reflect decades of experience with projects that overrun, systems that break at scale, and tools that behave in unexpected ways.",
  'murphys-office-laws':
    "Office life has its own rhythm of deadlines, meetings, and equipment. These laws distill the collective experience of workers who have learned that printers jam before presentations and the right person is always at lunch.",
  'murphys-commerce-laws':
    "Business and commerce run on estimates, deadlines, and competition. The laws here reflect how projects stretch, customers behave unpredictably, and the best-laid plans still go wrong.",
  'murphys-cars-laws':
    "Drivers and mechanics know that cars have a perverse timing: they break when you need them most and run fine when the mechanic is watching. These laws capture that automotive irony.",
  'murphys-travel-laws':
    "Travel concentrates risk: missed connections, lost luggage, and wrong turns. The laws in this category reflect the wisdom of travelers who have learned to expect the unexpected.",
  'murphys-teaching-laws':
    "Classrooms and curricula have their own Murphy dynamics: the one lesson you skip is on the exam, and technology fails during the crucial demo. These laws resonate with educators everywhere.",
  'murphys-photography-laws':
    "Photographers learn that the decisive moment coincides with empty batteries, bad light, or a subject looking away. These laws capture the frustration and humor of capturing the uncapturable.",
  'murphys-sport-laws':
    "In sports, the ball bounces the wrong way, the wind shifts at the worst time, and injuries happen when the season matters most. These laws are familiar to athletes and fans alike.",
  'murphys-love-laws':
    "Relationships and romance have their own timing and miscommunication. The laws here reflect the universal experience of things going wrong at the worst moment in matters of the heart.",
  'murphys-mothers-laws':
    "Parents accumulate their own set of truths about lost socks, spilled drinks, and the one toy that goes missing. These laws capture the chaos and humor of family life.",
  'murphys-political-laws':
    "Politics and policy are full of unintended consequences and perverse incentives. The laws in this category reflect the observation that outcomes often defy the best intentions.",
  'murphys-miscellaneous-laws':
    "Some laws defy easy categorization but still capture the same spirit: when something can go wrong, it will. This collection spans everyday life and odd corners of experience.",
  'murphys-gravity-laws':
    "Gravity and physics have a way of making the worst outcome the most likely: toast lands butter-side down, and dropped tools find the only hard surface. These laws are both joke and genuine observation.",
  'murphys-mechanics-laws':
    "Mechanics and repair work follow their own logic: the part that fails is the one you do not have in stock, and the noise disappears when the expert arrives. These laws are earned in the shop.",
  'murphys-printing-laws':
    "Printers and paper have a long history of jamming, running out of ink at the wrong time, and producing errors that only appear in the final run. These laws are workplace classics.",
  'murphys-nurses-laws':
    "Healthcare runs on tight schedules and critical needs. The laws here reflect the reality that equipment fails, supplies run out, and the urgent case arrives when the shift is short-staffed.",
  'murphys-war-laws':
    "Military and conflict situations magnify the cost of failure. These laws distill hard-won experience about planning, logistics, and the fog of war.",
  'murphys-real-estate-laws':
    "Real estate has its own timing: the perfect place appears when you cannot buy, and the deal falls through at the last moment. These laws reflect the volatility of property and markets.",
};

const DEFAULT_CONTEXT =
  "Laws in this collection capture the same spirit as Murphy's original observation: when something can go wrong, it often will. They remind us to plan for failure, stay humble, and keep a sense of humor when the universe has other plans.";

/**
 * Returns 2-4 sentences of original editorial copy for a law's primary category.
 * Used on law detail pages to add substantial unique content and avoid thin-content signals.
 */
export function getContextForCategory(categorySlug: string | undefined | null): string {
  if (!categorySlug || typeof categorySlug !== 'string') {
    return DEFAULT_CONTEXT;
  }
  const slug = categorySlug.trim().toLowerCase();
  return CATEGORY_CONTEXT[slug] ?? DEFAULT_CONTEXT;
}
