-- Migration 001: add last_board_id to users
ALTER TABLE users ADD COLUMN last_board_id TEXT DEFAULT NULL;
