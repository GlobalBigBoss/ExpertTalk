$body = @{video_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ'; max_depth=1; max_videos_per_person=1} | ConvertTo-Json
$resp = Invoke-RestMethod -Uri 'http://localhost:8000/api/tasks' -Method Post -Body $body -ContentType 'application/json'
Write-Host "Task created: $($resp.task_id)"

for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/tasks/$($resp.task_id)" -Method Get
    $elapsed = ($i + 1) * 5
    Write-Host "[$($elapsed)s] Status: $($status.status) | Step: $($status.current_step) | Progress: $($status.progress_pct)%"
    if ($status.status -eq 'completed' -or $status.status -eq 'failed') {
        Write-Host "Final status: $($status.status)"
        Write-Host "Results count: $($status.results.Count)"
        if ($status.results.Count -gt 0) {
            Write-Host "Title CN: $($status.results[0].title_cn)"
            Write-Host "PPT: $($status.results[0].ppt_filename)"
        }
        if ($status.error) { Write-Host "Error: $($status.error)" }
        break
    }
}
