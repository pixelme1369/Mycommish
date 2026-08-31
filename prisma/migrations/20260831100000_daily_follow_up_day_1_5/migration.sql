-- Rename follow-up enum values: day3→day1, day10→day5
ALTER TYPE "DailyFollowUpDay" RENAME VALUE 'day3' TO 'day1';
ALTER TYPE "DailyFollowUpDay" RENAME VALUE 'day10' TO 'day5';
