// Derived from data/mockData.ts, converted to plain JS
export const mockLaws = [
  { id: '1', title: "Murphy's Original Law", text: "Anything that can go wrong will go wrong.", author: "Edward Murphy", submittedBy: 'engineerMike', submissionDate: '2024-01-15', publishDate: '2024-01-16', upvotes: 247, downvotes: 12, score: 235, topics: ['General','Philosophy'], tags: ['classic','original','pessimism'], stories: [] },
  { id: '2', title: "O'Toole's Corollary", text: "Murphy was an optimist.", author: "O'Toole", submittedBy: 'projectSarah', submissionDate: '2024-02-20', publishDate: '2024-02-21', upvotes: 189, downvotes: 8, score: 181, topics: ['General','Humor'], tags: ['pessimism','corollary','optimism'], stories: [] },
  { id: '3', title: "Finagle's Law", text: "Anything that can go wrong, will go wrong—at the worst possible moment.", author: "Finagle", submittedBy: 'engineerMike', submissionDate: '2024-01-20', publishDate: '2024-01-21', upvotes: 156, downvotes: 15, score: 141, topics: ['General','Timing'], tags: ['timing','pessimism','worst-case'], stories: [] },
  { id: '4', title: "The Law of Least Resistance", text: "The path of least resistance is what makes rivers run crooked.", author: "Unknown", submittedBy: 'engineerMike', submissionDate: '2024-03-01', publishDate: '2024-03-02', upvotes: 98, downvotes: 7, score: 91, topics: ['Philosophy','Nature'], tags: ['resistance','philosophy','nature'], stories: [] },
  { id: '5', title: "Parkinson's Law", text: "Work expands to fill the time available for its completion.", author: "Cyril Northcote Parkinson", submittedBy: 'projectSarah', submissionDate: '2024-02-25', publishDate: '2024-02-26', upvotes: 134, downvotes: 9, score: 125, topics: ['Workplace','Time Management'], tags: ['work','time','productivity','deadlines'], stories: [] },
  { id: '6', title: "The Law of Unintended Consequences", text: "Every solution breeds new problems.", author: "Unknown", submittedBy: 'codingCrisis', submissionDate: '2024-03-10', publishDate: '2024-03-11', upvotes: 87, downvotes: 12, score: 75, topics: ['Problem Solving','Philosophy'], tags: ['consequences','solutions','problems'], stories: [] },
];

export const mockStories = [
  { id: '1', lawId: '1', text: "I was running a critical server update at 3 AM to avoid downtime. Everything was tested, documented, and planned perfectly. Naturally, the one thing I didn't account for was the cleaning crew unplugging the server to vacuum underneath it.", submittedBy: 'engineerMike', submissionDate: '2024-01-17', upvotes: 45, downvotes: 2, score: 43 },
  { id: '2', lawId: '2', text: "After reading Murphy's Law, I thought 'at least someone understands that things go wrong.' Then I read O'Toole's Corollary and realized Murphy was still being too positive about the situation.", submittedBy: 'projectSarah', submissionDate: '2024-02-22', upvotes: 28, downvotes: 1, score: 27 },
  { id: '3', lawId: '5', text: "Gave my team 2 weeks to complete a simple feature. They finished it in 13 days and 23 hours. The last hour was spent 'polishing' and somehow introduced three new bugs.", submittedBy: 'engineerMike', submissionDate: '2024-02-27', upvotes: 52, downvotes: 3, score: 49 },
  { id: '4', lawId: '6', text: "Fixed a memory leak in our application. Great! Now the app runs faster and uses less memory. The unintended consequence? Users started using features they couldn't access before due to the slow performance, overloading our database.", submittedBy: 'codingCrisis', submissionDate: '2024-03-12', upvotes: 31, downvotes: 1, score: 30 },
];

// attach stories to laws
mockLaws[0].stories = [mockStories[0]];
mockLaws[1].stories = [mockStories[1]];
mockLaws[4].stories = [mockStories[2]];
mockLaws[5].stories = [mockStories[3]];

