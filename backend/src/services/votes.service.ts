// @ts-nocheck
export class VoteService {
  constructor(db) {
    this.db = db;
  }

  async vote(lawId, voteType, voterIdentifier) {
    const insertVoteSql = `
      INSERT INTO votes (law_id, vote_type, voter_identifier)
      VALUES (?, ?, ?)
      ON CONFLICT(law_id, voter_identifier)
      DO UPDATE SET vote_type = excluded.vote_type, created_at = CURRENT_TIMESTAMP;
    `;
    
    const insertVoteStmt = this.db.prepare(insertVoteSql);
    insertVoteStmt.run(lawId, voteType, voterIdentifier);
  }

  async removeVote(lawId, voterIdentifier) {
    const deleteVoteSql = `
      DELETE FROM votes WHERE law_id = ? AND voter_identifier = ?;
    `;
    
    const deleteVoteStmt = this.db.prepare(deleteVoteSql);
    deleteVoteStmt.run(lawId, voterIdentifier);
  }
}
