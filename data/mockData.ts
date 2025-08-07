export interface Law {
  id: string;
  title: string;
  text: string;
  author?: string;
  submittedBy: string;
  submissionDate: string;
  publishDate: string;
  upvotes: number;
  downvotes: number;
  score: number;
  topics: string[];
  tags: string[];
  stories: Story[];
}

export interface Story {
  id: string;
  lawId: string;
  text: string;
  submittedBy: string;
  submissionDate: string;
  upvotes: number;
  downvotes: number;
  score: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  joinDate: string;
  submittedLaws: string[];
  submittedStories: string[];
}

export interface Vote {
  id: string;
  userId: string;
  contentId: string;
  contentType: 'law' | 'story';
  voteValue: 1 | -1;
  timestamp: string;
}

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'engineerMike',
    email: 'mike@example.com',
    joinDate: '2024-01-15',
    submittedLaws: ['1', '3'],
    submittedStories: ['1', '3']
  },
  {
    id: '2',
    username: 'projectSarah',
    email: 'sarah@example.com',
    joinDate: '2024-02-20',
    submittedLaws: ['2'],
    submittedStories: ['2']
  },
  {
    id: '3',
    username: 'codingCrisis',
    email: 'crisis@example.com',
    joinDate: '2024-03-10',
    submittedLaws: [],
    submittedStories: ['4']
  }
];

export const mockLaws: Law[] = [
  {
    id: '1',
    title: "Murphy's Original Law",
    text: "Anything that can go wrong will go wrong.",
    author: "Edward Murphy",
    submittedBy: 'engineerMike',
    submissionDate: '2024-01-15',
    publishDate: '2024-01-16',
    upvotes: 247,
    downvotes: 12,
    score: 235,
    topics: ['General', 'Philosophy'],
    tags: ['classic', 'original', 'pessimism'],
    stories: []
  },
  {
    id: '2',
    title: "O'Toole's Corollary",
    text: "Murphy was an optimist.",
    author: "O'Toole",
    submittedBy: 'projectSarah',
    submissionDate: '2024-02-20',
    publishDate: '2024-02-21',
    upvotes: 189,
    downvotes: 8,
    score: 181,
    topics: ['General', 'Humor'],
    tags: ['pessimism', 'corollary', 'optimism'],
    stories: []
  },
  {
    id: '3',
    title: "Finagle's Law",
    text: "Anything that can go wrong, will go wrong—at the worst possible moment.",
    author: "Finagle",
    submittedBy: 'engineerMike',
    submissionDate: '2024-01-20',
    publishDate: '2024-01-21',
    upvotes: 156,
    downvotes: 15,
    score: 141,
    topics: ['General', 'Timing'],
    tags: ['timing', 'pessimism', 'worst-case'],
    stories: []
  },
  {
    id: '4',
    title: "The Law of Least Resistance",
    text: "The path of least resistance is what makes rivers run crooked.",
    author: "Unknown",
    submittedBy: 'engineerMike',
    submissionDate: '2024-03-01',
    publishDate: '2024-03-02',
    upvotes: 98,
    downvotes: 7,
    score: 91,
    topics: ['Philosophy', 'Nature'],
    tags: ['resistance', 'philosophy', 'nature'],
    stories: []
  },
  {
    id: '5',
    title: "Parkinson's Law",
    text: "Work expands to fill the time available for its completion.",
    author: "Cyril Northcote Parkinson",
    submittedBy: 'projectSarah',
    submissionDate: '2024-02-25',
    publishDate: '2024-02-26',
    upvotes: 134,
    downvotes: 9,
    score: 125,
    topics: ['Workplace', 'Time Management'],
    tags: ['work', 'time', 'productivity', 'deadlines'],
    stories: []
  },
  {
    id: '6',
    title: "The Law of Unintended Consequences",
    text: "Every solution breeds new problems.",
    author: "Unknown",
    submittedBy: 'codingCrisis',
    submissionDate: '2024-03-10',
    publishDate: '2024-03-11',
    upvotes: 87,
    downvotes: 12,
    score: 75,
    topics: ['Problem Solving', 'Philosophy'],
    tags: ['consequences', 'solutions', 'problems'],
    stories: []
  }
];

export const mockStories: Story[] = [
  {
    id: '1',
    lawId: '1',
    text: "I was running a critical server update at 3 AM to avoid downtime. Everything was tested, documented, and planned perfectly. Naturally, the one thing I didn't account for was the cleaning crew unplugging the server to vacuum underneath it.",
    submittedBy: 'engineerMike',
    submissionDate: '2024-01-17',
    upvotes: 45,
    downvotes: 2,
    score: 43
  },
  {
    id: '2',
    lawId: '2',
    text: "After reading Murphy's Law, I thought 'at least someone understands that things go wrong.' Then I read O'Toole's Corollary and realized Murphy was still being too positive about the situation.",
    submittedBy: 'projectSarah',
    submissionDate: '2024-02-22',
    upvotes: 28,
    downvotes: 1,
    score: 27
  },
  {
    id: '3',
    lawId: '5',
    text: "Gave my team 2 weeks to complete a simple feature. They finished it in 13 days and 23 hours. The last hour was spent 'polishing' and somehow introduced three new bugs.",
    submittedBy: 'engineerMike',
    submissionDate: '2024-02-27',
    upvotes: 52,
    downvotes: 3,
    score: 49
  },
  {
    id: '4',
    lawId: '6',
    text: "Fixed a memory leak in our application. Great! Now the app runs faster and uses less memory. The unintended consequence? Users started using features they couldn't access before due to the slow performance, overloading our database.",
    submittedBy: 'codingCrisis',
    submissionDate: '2024-03-12',
    upvotes: 31,
    downvotes: 1,
    score: 30
  }
];

// Add stories to laws
mockLaws[0].stories = [mockStories[0]];
mockLaws[1].stories = [mockStories[1]];
mockLaws[4].stories = [mockStories[2]];
mockLaws[5].stories = [mockStories[3]];

export const mockVotes: Vote[] = [
  { id: '1', userId: '1', contentId: '1', contentType: 'law', voteValue: 1, timestamp: '2024-01-16' },
  { id: '2', userId: '2', contentId: '1', contentType: 'law', voteValue: 1, timestamp: '2024-01-17' },
  { id: '3', userId: '1', contentId: '2', contentType: 'law', voteValue: 1, timestamp: '2024-02-21' },
];

export const allTopics = [
  'General',
  'Philosophy', 
  'Workplace',
  'Technology',
  'Time Management',
  'Problem Solving',
  'Humor',
  'Timing',
  'Nature'
];

export const allTags = [
  'classic',
  'original', 
  'pessimism',
  'corollary',
  'optimism',
  'timing',
  'worst-case',
  'resistance',
  'nature',
  'work',
  'time',
  'productivity',
  'deadlines',
  'consequences',
  'solutions',
  'problems'
];