# Screenshots til Claude Code Debug

Denne mappe bruges til at dele screenshots med Claude til debugging.

## 🎯 Anbefalede workflow:

### Screenshot Desktop App (anbefalet)
1. **Start app**: Dobbelt-klik `setup-screenshot-app.bat` eller `ClaudeScreenshot.exe`
2. **Tag screenshot**: Tryk **Ctrl+Shift+S** hvor som helst
3. **Se notification**: "📸 Screenshot gemt! 📅 15-01-2025 14:30:22"
4. **Skriv til Claude**: Bare skriv **"screenshot"** - jeg finder automatisk det seneste!

### Manuel metoder (backup)
1. Tag screenshot (Win+Shift+S)
2. Gem med et af scripts
3. Fortæl Claude hvilken fil der skal læses

## 🔧 Automatik funktioner:

- **LATEST.txt**: Holder styr på seneste screenshot
- **screenshot-log.txt**: Alle screenshots med dansk dato/tid
- **Auto-timestamp**: Alle filer får timestamp i navn
- **Smart reference**: Siger du "screenshot" finder Claude automatisk det seneste

## 💬 Eksempel samtale:

**Du**: *Tager screenshot med Ctrl+Shift+S*  
**Notification**: "📸 Screenshot gemt! 📅 15-01-2025 14:30:22"  
**Du**: "screenshot"  
**Claude**: *Læser automatisk seneste screenshot og analyserer problemet*

## 📁 Filer i denne mappe:
- `screenshot_YYYY-MM-DD_HH-MM-SS.png` - Dine screenshots
- `LATEST.txt` - Reference til seneste screenshot
- `screenshot-log.txt` - Log med danske datoer
- `README.md` - Denne fil