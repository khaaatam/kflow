UPDATE full_chat_logs
SET created_at = COALESCE(created_at, NOW())
WHERE created_at IS NULL;
