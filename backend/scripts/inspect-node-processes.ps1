Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "node.exe" } |
  Select-Object ProcessId, ParentProcessId, CommandLine |
  Format-List
