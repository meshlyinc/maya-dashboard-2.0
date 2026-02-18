-- Run this in Supabase SQL Editor to create the judge_results table
CREATE TABLE IF NOT EXISTS judge_results (
  gig_id uuid PRIMARY KEY,
  completion_judge jsonb DEFAULT '{}',
  loop_detection_judge jsonb DEFAULT '{}',
  conversation_id uuid,
  judged_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_judge_results_judged_at ON judge_results(judged_at DESC);
