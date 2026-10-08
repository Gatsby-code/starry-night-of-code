@echo off
title Starry Night of Code - http://localhost:8099
cd /d "%~dp0"
echo ==============================================
echo   星夜 - 代码  local preview
echo   Open http://localhost:8099 in your browser
echo   Keep this window open. Ctrl+C to stop.
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $l=New-Object System.Net.HttpListener; $l.Prefixes.Add('http://127.0.0.1:8099/'); $l.Prefixes.Add('http://localhost:8099/'); $l.Start(); $t=@{'.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='application/javascript; charset=utf-8';'.jpg'='image/jpeg'}; while($l.IsListening){ $c=$l.GetContext(); try{ $p=$c.Request.Url.AbsolutePath; if($p -eq '/'){$p='/index.html'}; $f=Join-Path (Get-Location) ($p -replace '/','\'); if(Test-Path $f -PathType Leaf){ $e=[IO.Path]::GetExtension($f).ToLower(); $b=[IO.File]::ReadAllBytes($f); $c.Response.ContentType=if($t.ContainsKey($e)){$t[$e]}else{'application/octet-stream'}; $c.Response.ContentLength64=$b.Length; $c.Response.OutputStream.Write($b,0,$b.Length) } else { $c.Response.StatusCode=404 } } catch{} finally{ try{$c.Response.OutputStream.Close()}catch{} } }"
pause
