get_monthly_stats() {
  MONTH="$1"
  START_DATE="$2"
  END_DATE="$3"
  feat=$(git log --pretty=oneline --grep='feat' --since="$START_DATE" --until="$END_DATE" | wc -l)
  fix=$(git log --pretty=oneline --grep='fix' --since="$START_DATE" --until="$END_DATE" | wc -l)
  chore=$(git log --pretty=oneline --grep='chore:' --since="$START_DATE" --until="$END_DATE" | wc -l)
  printf "| %-10s | %-5d | %-5d | %-5d |\n" "$MONTH" "$feat" "$fix" "$chore"
}

printf "| Month       | Feat | Fix | Chore |\n"
printf "|--------------|------|------|-------|\n"

get_monthly_stats "January" "2025-01-01" "2025-01-31"
get_monthly_stats "February" "2025-02-01" "2025-02-28"
get_monthly_stats "March" "2025-03-01" "2025-03-31"
get_monthly_stats "April" "2025-04-01" "2025-04-30"
get_monthly_stats "May" "2025-05-01" "2025-05-31"
get_monthly_stats "June" "2025-06-01" "2025-06-30"
get_monthly_stats "July" "2025-07-01" "2025-07-31"
get_monthly_stats "August" "2025-08-01" "2025-08-31"
get_monthly_stats "September" "2025-09-01" "2025-09-30"
get_monthly_stats "October" "2025-10-01" "2025-10-31"
get_monthly_stats "November" "2025-11-01" "2025-11-30"
get_monthly_stats "December" "2025-12-01" "2025-12-31"
get_monthly_stats "Q1" "2025-01-01" "2025-03-31"
get_monthly_stats "Q2" "2025-04-01" "2025-06-30"
get_monthly_stats "Q3" "2025-07-01" "2025-09-30"
get_monthly_stats "Q4" "2025-10-01" "2025-12-31"
get_monthly_stats "Total" "2025-01-01" "2025-12-31"
