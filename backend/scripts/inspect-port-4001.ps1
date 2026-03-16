$targetPids = @(15864, 11848)

Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 4001 -or $targetPids -contains $_.OwningProcess } |
  Select-Object LocalAddress, LocalPort, State, OwningProcess |
  Format-List
