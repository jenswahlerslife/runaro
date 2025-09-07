# 📸 Claude Code Screenshot Tool

En simpel desktop app der kan tage screenshots med genvejstast og gemme dem til Claude debugging.

## 🚀 Quick Start

### Option 1: Dobbelt-klik setup
1. **Dobbelt-klik** på `setup-screenshot-app.bat`
2. Venter på installation af dependencies
3. App starter automatisk med system tray icon

### Option 2: Byg executable 
1. **Dobbelt-klik** på `build-exe.bat` 
2. Venter på build process
3. **Dobbelt-klik** på `ClaudeScreenshot.exe`

## 🎯 Sådan bruger du det

1. **Start app** - Se blå ikon i system tray (nederst til højre)
2. **Tag screenshot** - Tryk **Ctrl+Shift+S** hvor som helst på skærmen  
3. **Se notification** - "Screenshot saved!"
4. **Fortæl Claude** - "Læs Rettelser/screenshot_2025-01-15_14-30-22.png"

## ✨ Features

- 🌍 **Global hotkey**: Ctrl+Shift+S virker overalt
- 🔔 **Notifikationer**: Ser når screenshot er gemt
- 📁 **Auto-organisering**: Timestamps i filnavne  
- 📋 **System tray**: Lille blå ikon, ikke påtrængende
- 📝 **Logging**: Holder styr på alle screenshots
- 🖱️ **Højreklik menu**: Åbn mappe, om, exit

## 📂 File struktur
```
Runaro/
├── screenshot-app.py          # Python source
├── ClaudeScreenshot.exe       # Executable (efter build)
├── setup-screenshot-app.bat   # Easy installer
├── build-exe.bat             # Build executable  
└── Rettelser/                # Screenshots gemmes her
    ├── screenshot_2025-01-15_14-30-22.png
    ├── screenshot_2025-01-15_14-31-05.png
    └── screenshot-log.txt     # Log over screenshots
```

## 🔧 Troubleshooting

**Problem**: "Python not found"
- **Løsning**: Installer Python fra https://python.org

**Problem**: Hotkey virker ikke  
- **Løsning**: Kør som administrator

**Problem**: Ingen notification
- **Løsning**: Tjek Windows notification settings

**Problem**: Can't build exe
- **Løsning**: Kør `pip install pyinstaller` først

## 💡 Pro Tips

- **Pin til taskbar**: Højreklik ClaudeScreenshot.exe → Pin to taskbar
- **Autostart**: Put ClaudeScreenshot.exe i Windows startup folder
- **Hurtig debugging**: Ctrl+Shift+S → fortæl Claude filnavn
- **Batch screenshots**: Tag flere screenshots af problem workflow

---

Nu kan du hurtigt screenshot fejl og få hjælp fra Claude! 🎉