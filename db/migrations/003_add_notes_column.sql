-- Add admin_notes column to laws table for review notes and comments

ALTER TABLE laws ADD COLUMN admin_notes TEXT;
