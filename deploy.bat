@echo off
REM Quick deploy: stage all, commit, push. Pass commit message as args.
REM Usage: deploy.bat your commit message here
setlocal
if "%~1"=="" (
  echo Usage: deploy.bat ^<commit message^>
  exit /b 1
)
git add -A
git commit -m "%*"
git push
endlocal
