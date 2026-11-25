import type Database from 'better-sqlite3';

type Db = InstanceType<typeof Database>;

export class VoteService {
  private db: Db;

  private onChange: () => void;

  /** `onChange` runs after every vote that is cast, changed or removed (the API uses it to drop the cached Law of the Day). */
  constructor(db: Db, onChange: () => void = () => {}) {
    this.db = db;
    this.onChange = onChange;
  }

  async vote(lawId: number, voteType: string, voterIdentifier: string): Promise<void> {
    const insertVoteSql = `
      INSERT INTO votes (law_id, vote_type, voter_identifier)
      VALUES (?, ?, ?)
      ON CONFLICT(law_id, voter_identifier)
      DO UPDATE SET vote_type = excluded.vote_type, created_at = CURRENT_TIMESTAMP;
    `;
    
    const insertVoteStmt = this.db.prepare(insertVoteSql);
    insertVoteStmt.run(lawId, voteType, voterIdentifier);
    this.onChange();
  }

  async removeVote(lawId: number, voterIdentifier: string): Promise<void> {
    const deleteVoteSql = `
      DELETE FROM votes WHERE law_id = ? AND voter_identifier = ?;
    `;
    
    const deleteVoteStmt = this.db.prepare(deleteVoteSql);
    deleteVoteStmt.run(lawId, voterIdentifier);
    this.onChange();
  }
}
