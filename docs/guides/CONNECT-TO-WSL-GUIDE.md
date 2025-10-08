# How to Connect VS Code to WSL

## Step-by-Step Visual Guide

### 1. Look at the VERY BOTTOM-LEFT CORNER of VS Code

You should see one of these:

```
┌─────────────────────────────────────┐
│ ><  WSL: Ubuntu                     │  ✅ CONNECTED - You're in Linux!
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ ><  (empty or no text)              │  ❌ NOT CONNECTED - You're on Windows
└─────────────────────────────────────┘
```

The `><` icon is the **Remote Indicator**.

### 2. Click the `><` Icon (or bottom-left corner)

A menu will pop up with options:
- **"Connect to WSL"**
- **"Reopen Folder in WSL"**
- **"New WSL Window"**

### 3. Select "Reopen Folder in WSL"

VS Code will:
1. Close the current window
2. Restart in WSL mode
3. Show "WSL: Ubuntu" in bottom-left

### 4. Verify You're in WSL

Open a terminal in VS Code (`Ctrl + \``) and run:

```bash
uname -a
```

Should show: `Linux ... microsoft-standard-WSL2`

---

## Can't Find the `><` Icon?

### Try This:

1. Press `F1` or `Ctrl + Shift + P`
2. Type: `WSL: Reopen Folder in WSL`
3. Press Enter

---

## Still Not Working?

Close VS Code completely, then run:

```batch
RECONNECT-WSL.bat
```

This will restart everything cleanly.

---

## Manual Method (Always Works):

1. Open Command Prompt or PowerShell
2. Run:
   ```cmd
   wsl --shutdown
   code --remote wsl+Ubuntu C:\Runaro_website\Runaro
   ```

---

## How to Tell If You're in WSL:

✅ **In WSL (Linux):**
- Terminal prompt: `username@machine:/mnt/c/...`
- `uname -a` shows "Linux"
- Bottom-left shows "WSL: Ubuntu"

❌ **On Windows:**
- Terminal prompt: `C:\Runaro_website\...` or `PS C:\...`
- `uname -a` shows "MINGW" or "Windows"
- Bottom-left is empty or shows local folder name
