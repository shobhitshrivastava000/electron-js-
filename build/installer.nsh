!macro customInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_NAME}.exe"'
!macroend
