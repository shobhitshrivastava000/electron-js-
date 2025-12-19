!macro preInit
  ; MUST match productName from electron-builder config
   !define UNINSTALL_KEY "12345678-90ab-cdef-1234-567890abcdef"

  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_KEY}" "DisplayName"

  ; If value exists → already installed
  StrCmp $0 "" 0 alreadyInstalled

  ; Not installed → allow installation
  Goto done

  alreadyInstalled:
    MessageBox MB_OK|MB_ICONEXCLAMATION "${UNINSTALL_KEY} is already installed on this system."
    Abort

  done:
!macroend
