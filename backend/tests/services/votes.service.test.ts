// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { VoteService } from '../../src/services/votes.service.ts';

describe('VoteService', () => {
    let db;
    let voteService;

    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(`
      CREATE TABLE votes (
        law_id INTEGER,
        vote_type TEXT,
        voter_identifier TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (law_id, voter_identifier)
      );
    `);
        voteService = new VoteService(db);
    });

    it('should cast a vote', async () => {
        await voteService.vote(1, 'up', 'user1');
        const vote = db.prepare('SELECT * FROM votes WHERE law_id = 1 AND voter_identifier = ?').get('user1');
        expect(vote.vote_type).toBe('up');
    });

    it('should update an existing vote', async () => {
        await voteService.vote(1, 'up', 'user1');
        await voteService.vote(1, 'down', 'user1');

        const vote = db.prepare('SELECT * FROM votes WHERE law_id = 1 AND voter_identifier = ?').get('user1');
        expect(vote.vote_type).toBe('down');
    });

    it('should remove a vote', async () => {
        await voteService.vote(1, 'up', 'user1');
        await voteService.removeVote(1, 'user1');

        const vote = db.prepare('SELECT * FROM votes WHERE law_id = 1 AND voter_identifier = ?').get('user1');
        expect(vote).toBeUndefined();
    });
});
