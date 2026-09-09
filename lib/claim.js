const CLAIM_SQL = `UPDATE app.participants
  SET food_claimed = 1,
      claimed_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      claimed_by_user_id = ?,
      updated_at = to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE qr_token = ? AND food_claimed = 0 AND payment_status = 'verified'
  RETURNING *`;
module.exports = { CLAIM_SQL };
