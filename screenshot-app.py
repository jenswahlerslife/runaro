#!/usr/bin/env python3
"""
Claude Code Screenshot Tool
Simple desktop app for taking screenshots and saving them for Claude debugging

Features:
- System tray icon
- Global hotkey (Ctrl+Shift+S)
- Auto-saves screenshots with timestamp
- Notification when screenshot saved
- Easy to use and lightweight

Requirements: pip install pillow pystray keyboard plyer
"""

import os
import sys
import time
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox

try:
    from PIL import Image, ImageGrab
    import pystray
    from pystray import MenuItem as item
    import keyboard
    from plyer import notification
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Please install with: pip install pillow pystray keyboard plyer")
    sys.exit(1)

class ScreenshotApp:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.screenshots_dir = self.script_dir / "Rettelser"
        self.screenshots_dir.mkdir(exist_ok=True)
        
        # Create system tray icon
        self.setup_tray_icon()
        
        # Register global hotkey
        self.setup_hotkey()
        
        self.running = True
        
    def setup_tray_icon(self):
        """Create system tray icon with camera design"""
        # Create a camera icon (16x16)
        icon_image = Image.new('RGB', (16, 16), color='white')
        
        # Draw simple camera shape
        pixels = []
        for y in range(16):
            row = []
            for x in range(16):
                if (2 <= x <= 13 and 4 <= y <= 12):  # Camera body
                    if (6 <= x <= 9 and 7 <= y <= 9):  # Lens center
                        row.append((50, 50, 50))  # Dark lens
                    elif (5 <= x <= 10 and 6 <= y <= 10):  # Lens ring
                        row.append((100, 100, 100))  # Gray lens ring
                    else:
                        row.append((60, 60, 60))  # Camera body
                elif (6 <= x <= 9 and 2 <= y <= 3):  # Flash/viewfinder
                    row.append((200, 200, 200))  # Light gray
                else:
                    row.append((255, 255, 255))  # White background
            pixels.extend(row)
        
        icon_image.putdata(pixels)
        
        menu = pystray.Menu(
            item('Tag Screenshot (Ctrl+Shift+S)', self.take_screenshot),
            item('Åbn Screenshot Mappe', self.open_folder),
            pystray.Menu.SEPARATOR,
            item('Om Jens Rettelsesværktøj', self.show_about),
            item('Afslut', self.quit_app)
        )
        
        self.icon = pystray.Icon(
            name="Jens Rettelsesværktøj",
            icon=icon_image,
            title="Jens Rettelsesværktøj",
            menu=menu
        )
    
    def setup_hotkey(self):
        """Register global hotkey Ctrl+Shift+S"""
        try:
            keyboard.add_hotkey('ctrl+shift+s', self.take_screenshot)
        except Exception as e:
            print(f"Could not register hotkey: {e}")
    
    def take_screenshot(self):
        """Take screenshot and save to Rettelser folder"""
        try:
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"screenshot_{timestamp}.png"
            filepath = self.screenshots_dir / filename
            
            # Take screenshot
            screenshot = ImageGrab.grab()
            screenshot.save(filepath, 'PNG')
            
            # Get file size
            file_size_kb = round(filepath.stat().st_size / 1024, 1)
            
            # Update "latest screenshot" reference
            self.update_latest_screenshot(filename)
            
            # Show notification with Danish date
            danish_date = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
            notification.notify(
                title="Jens Rettelsesværktøj",
                message=f"📸 Screenshot gemt!\n📅 {danish_date}\n📁 {filename}",
                app_name="Jens Rettelsesværktøj",
                timeout=4
            )
            
            # Log the screenshot
            self.log_screenshot(filename, danish_date)
            
            print(f"✅ Screenshot saved: {filename} ({danish_date})")
            
        except Exception as e:
            error_msg = f"Error taking screenshot: {str(e)}"
            print(f"❌ {error_msg}")
            
            notification.notify(
                title="Jens Rettelsesværktøj - Fejl",
                message=error_msg,
                app_name="Jens Rettelsesværktøj",
                timeout=5
            )
    
    def update_latest_screenshot(self, filename):
        """Update reference to latest screenshot for Claude"""
        latest_file = self.screenshots_dir / "LATEST.txt"
        with open(latest_file, 'w', encoding='utf-8') as f:
            f.write(filename)
    
    def log_screenshot(self, filename, danish_date):
        """Log screenshot to file with Danish date"""
        log_file = self.screenshots_dir / "screenshot-log.txt"
        log_entry = f"{danish_date} - {filename}\n"
        
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    
    def log_screenshot(self, filename):
        """Log screenshot to file"""
        log_file = self.screenshots_dir / "screenshot-log.txt"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"{timestamp} - {filename}\n"
        
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    
    def open_folder(self, icon=None, item=None):
        """Open screenshots folder"""
        os.startfile(str(self.screenshots_dir))
    
    def show_about(self, icon=None, item=None):
        """Show about dialog"""
        def show_dialog():
            root = tk.Tk()
            root.withdraw()  # Hide main window
            
            messagebox.showinfo(
                "Om Jens Rettelsesværktøj",
                f"Jens Rettelsesværktøj v1.0\n\n"
                f"📸 Genvej: Ctrl+Shift+S\n"
                f"📁 Screenshots gemmes i:\n{self.screenshots_dir}\n\n"
                f"💡 Sådan bruger du det:\n"
                f"1. Tryk Ctrl+Shift+S for at tage screenshot\n"
                f"2. Skriv 'screenshot' til Claude\n"
                f"3. Claude analyserer automatisk det seneste billede!"
            )
            root.destroy()
        
        # Run in separate thread to avoid blocking
        threading.Thread(target=show_dialog, daemon=True).start()
    
    def quit_app(self, icon=None, item=None):
        """Quit the application"""
        self.running = False
        keyboard.unhook_all()
        if hasattr(self, 'icon'):
            self.icon.stop()
    
    def run(self):
        """Run the application"""
        print("🚀 Jens Rettelsesværktøj started!")
        print(f"📁 Screenshots will be saved to: {self.screenshots_dir}")
        print("⌨️  Press Ctrl+Shift+S to take screenshot")
        print("🔴 Right-click system tray icon to exit")
        
        # Show startup notification
        notification.notify(
            title="Jens Rettelsesværktøj",
            message="📸 Klar! Tryk Ctrl+Shift+S for screenshot",
            app_name="Jens Rettelsesværktøj",
            timeout=3
        )
        
        # Run system tray icon
        self.icon.run()

if __name__ == "__main__":
    try:
        app = ScreenshotApp()
        app.run()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)