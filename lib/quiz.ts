import { sql } from "./db";

export interface QuizSession {
  id: number;
  user_id: number;
  session_date: string;
  questions_asked: number;
  points_earned: number;
  current_question: string | null;
  current_answer: string | null;
}

export async function migrateQuizDB(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id               SERIAL  PRIMARY KEY,
      user_id          INTEGER NOT NULL,
      session_date     DATE    NOT NULL DEFAULT CURRENT_DATE,
      questions_asked  INTEGER NOT NULL DEFAULT 0,
      points_earned    INTEGER NOT NULL DEFAULT 0,
      current_question TEXT,
      current_answer   TEXT,
      UNIQUE(user_id, session_date)
    )
  `;
}

export async function getQuizSession(userId: number): Promise<QuizSession | null> {
  const rows = await sql`
    SELECT * FROM quiz_sessions
    WHERE user_id = ${userId} AND session_date = CURRENT_DATE
  `;
  return (rows[0] as QuizSession) ?? null;
}

export async function ensureSession(userId: number): Promise<QuizSession> {
  await sql`
    INSERT INTO quiz_sessions (user_id, session_date)
    VALUES (${userId}, CURRENT_DATE)
    ON CONFLICT (user_id, session_date) DO NOTHING
  `;
  return (await getQuizSession(userId))!;
}

export async function startQuestion(userId: number, question: string, answer: string): Promise<void> {
  await sql`
    UPDATE quiz_sessions
    SET current_question = ${question},
        current_answer   = ${answer},
        questions_asked  = questions_asked + 1
    WHERE user_id = ${userId} AND session_date = CURRENT_DATE
  `;
}

export async function clearQuestion(userId: number): Promise<void> {
  await sql`
    UPDATE quiz_sessions
    SET current_question = NULL, current_answer = NULL
    WHERE user_id = ${userId} AND session_date = CURRENT_DATE
  `;
}

export async function awardQuizPoint(userId: number): Promise<void> {
  await sql`UPDATE quiz_sessions SET points_earned = 1 WHERE user_id = ${userId} AND session_date = CURRENT_DATE`;
  await sql`UPDATE users SET points = points + 1 WHERE id = ${userId}`;
  await sql`
    INSERT INTO transactions (user_id, purchase_amount, points_earned, type, note)
    VALUES (${userId}, 0, 1, 'earn', 'รางวัลตอบคำถามประจำวัน')
  `;
}
