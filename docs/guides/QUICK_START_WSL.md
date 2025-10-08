# 🚀 Quick Start - WSL Development Setup

## One-Command Setup

### Windows Users (Easiest):

**Method 1: PowerShell (Fully Automated)**
```powershell
# Right-click on setup-wsl-auto.ps1 → Run with PowerShell
```

**Method 2: Batch File (Quick Open)**
```batch
# Double-click: open-in-wsl.bat
```

---

## What Happens Automatically:

✅ **setup-wsl-auto.ps1** does everything:
1. Checks if WSL is installed (installs if missing)
2. Installs Ubuntu distribution
3. Installs VS Code WSL extension
4. Runs full development environment setup
5. Opens VS Code in WSL mode

✅ **open-in-wsl.bat** does:
1. Opens VS Code in WSL mode immediately
2. You run `./scripts/wsl-setup.sh` inside VS Code terminal

---

## After Setup:

Look for **`WSL: Ubuntu`** in the bottom-left corner of VS Code.

### Available Commands:
```bash
npm run dev           # Start development server (localhost:8080)
npm run build         # Production build
npm test              # Run tests
npm run lint          # Check code quality
npm run db:push       # Deploy database migrations
```

---

## Troubleshooting:

### PowerShell Script Won't Run:
```powershell
# Run this first to allow scripts:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### VS Code Doesn't Open in WSL:
1. Install WSL extension manually:
   ```
   code --install-extension ms-vscode-remote.remote-wsl
   ```
2. Run the batch file again: `open-in-wsl.bat`

### WSL Not Installed:
```powershell
# In PowerShell (Admin):
wsl --install -d Ubuntu
# Restart computer, then run setup-wsl-auto.ps1 again
```

---

## What's Different in WSL?

| Feature | Windows | WSL Ubuntu |
|---------|---------|------------|
| Terminal | PowerShell/CMD | Bash |
| File System | `C:\Users\...` | `/home/user/...` |
| Package Manager | npm on Windows | npm on Linux |
| Scripts | `.bat`, `.ps1` | `.sh` |
| Performance | Slower for Node | Faster native Linux |

---

## Manual Setup (Fallback):

If automation fails, follow these steps:

1. **Install WSL:**
   ```powershell
   wsl --install -d Ubuntu
   ```

2. **Open VS Code:**
   - Press `Ctrl + Shift + P`
   - Type: `WSL: Open Folder in WSL`
   - Select `Ubuntu`
   - Browse to project folder

3. **Run Setup:**
   ```bash
   ./scripts/wsl-setup.sh
   ```

---

## Next Steps:

1. ✅ Verify WSL: `uname -a` (should show `microsoft-standard-WSL2`)
2. ✅ Start dev server: `npm run dev`
3. ✅ Open browser: http://localhost:8080
4. ✅ Start coding! 🏃‍♂️

---

**Need Help?**
- Check CLAUDE.md for full documentation
- Run `npm run dev` to verify setup
- Look for `WSL: Ubuntu` in VS Code bottom-left corner
