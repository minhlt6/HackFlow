import sqlite3

conn = sqlite3.connect("backend/hackflow_dev.db")
c = conn.cursor()


def add_col_if_missing(table, col_name, col_type):
    cols = [r[1] for r in c.execute(f"PRAGMA table_info({table})").fetchall()]
    if col_name not in cols:
        print(f"Adding {col_name} to {table}...")
        c.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
        conn.commit()


add_col_if_missing("checkpoints", "points", "REAL DEFAULT 10.0")
add_col_if_missing("checkpoints", "late_penalty", "REAL DEFAULT 2.0")
add_col_if_missing("checkpoints", "block_enabled", "BOOLEAN DEFAULT 0")
add_col_if_missing("checkpoints", "block_threshold", "INTEGER DEFAULT 2")
add_col_if_missing("checkpoints", "required_fields", "TEXT DEFAULT '[\"repo_url\"]'")

add_col_if_missing("checkpoint_submissions", "custom_fields", "TEXT DEFAULT '{}'")
add_col_if_missing("checkpoint_submissions", "score_awarded", "REAL DEFAULT NULL")
add_col_if_missing("checkpoint_submissions", "is_late", "BOOLEAN DEFAULT 0")

print("Migration check complete!")
conn.close()
