#!/usr/bin/env python3
"""
Jens Rettelsesvaerktoj - Simple Screenshot Tool
- Press Ctrl+Shift+S for area selection screenshot  
- Automatically saves to Rettelser folder with timestamp
- Updates LATEST.txt for Claude reference
"""

import os
import sys
import time
import threading
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import messagebox
import subprocess

try:
    from PIL import Image, ImageGrab
    import pystray
    from pystray import MenuItem as item
    import keyboard
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Please install with: pip install pillow pystray keyboard")
    sys.exit(1)

class ScreenshotOverlay:
    def __init__(self, callback):
        self.callback = callback
        self.start_x = None
        self.start_y = None
        self.rect_id = None
        self.root = None
        
    def show_selection_overlay(self):
        """Show fullscreen overlay for area selection"""
        self.root = tk.Tk()
        self.root.attributes('-fullscreen', True)
        self.root.attributes('-alpha', 0.3)
        self.root.attributes('-topmost', True)
        self.root.configure(bg='black')
        self.root.configure(cursor='crosshair')
        
        # Create canvas for selection rectangle
        self.canvas = tk.Canvas(self.root, highlightthickness=0, bg='black')
        self.canvas.pack(fill='both', expand=True)
        
        # Bind mouse events
        self.canvas.bind('<Button-1>', self.on_click)
        self.canvas.bind('<B1-Motion>', self.on_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_release)
        
        # Bind keyboard events
        self.root.bind('<Escape>', self.cancel_selection)
        self.root.bind('<Return>', self.take_fullscreen)
        
        self.root.focus_set()
        self.root.mainloop()
    
    def on_click(self, event):
        """Start selection"""
        self.start_x = event.x
        self.start_y = event.y
        if self.rect_id:
            self.canvas.delete(self.rect_id)
    
    def on_drag(self, event):
        """Update selection rectangle"""
        if self.start_x is not None and self.start_y is not None:
            if self.rect_id:
                self.canvas.delete(self.rect_id)
            self.rect_id = self.canvas.create_rectangle(
                self.start_x, self.start_y, event.x, event.y,
                outline='red', width=2, fill=''
            )
    
    def on_release(self, event):
        """Finish selection and take screenshot"""
        if self.start_x is not None and self.start_y is not None:
            # Calculate selection area
            x1 = min(self.start_x, event.x)
            y1 = min(self.start_y, event.y)
            x2 = max(self.start_x, event.x)
            y2 = max(self.start_y, event.y)
            
            # Close overlay
            self.root.quit()
            self.root.destroy()
            
            # Take screenshot of selected area
            if abs(x2 - x1) > 5 and abs(y2 - y1) > 5:  # Minimum selection size
                self.callback((x1, y1, x2, y2))
    
    def cancel_selection(self, event=None):
        """Cancel selection"""
        self.root.quit()
        self.root.destroy()
    
    def take_fullscreen(self, event=None):
        """Take fullscreen screenshot"""
        self.root.quit()
        self.root.destroy()
        self.callback(None)  # None means fullscreen

class SimpleScreenshotTool:
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
            item('Tag Screenshot (Ctrl+Shift+S)', self.start_screenshot),
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
            keyboard.add_hotkey('ctrl+shift+s', self.start_screenshot)
            print("Hotkey Ctrl+Shift+S registered successfully")
        except Exception as e:
            print(f"Could not register hotkey: {e}")
    
    def start_screenshot(self):
        """Start screenshot process with area selection"""
        try:
            print("Starting screenshot...")
            threading.Thread(target=self._take_screenshot_with_selection, daemon=True).start()
        except Exception as e:
            print(f"Error starting screenshot: {str(e)}")
    
    def _take_screenshot_with_selection(self):
        """Take screenshot with area selection overlay"""
        try:
            overlay = ScreenshotOverlay(self._capture_area)
            overlay.show_selection_overlay()
        except Exception as e:
            print(f"Error with selection overlay: {str(e)}")
    
    def _capture_area(self, area):
        """Capture screenshot of specified area or fullscreen"""
        try:
            if area is None:
                # Fullscreen screenshot
                screenshot = ImageGrab.grab()
            else:
                # Area screenshot
                x1, y1, x2, y2 = area
                screenshot = ImageGrab.grab(bbox=(x1, y1, x2, y2))
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"screenshot_{timestamp}.png"
            filepath = self.screenshots_dir / filename
            
            # Save screenshot
            screenshot.save(filepath, 'PNG')
            
            # Update latest reference
            self.update_latest_screenshot(filename)
            
            # Show success notification using Windows native toast
            danish_date = datetime.now().strftime("%d-%m-%Y %H:%M:%S")
            file_size_kb = round(filepath.stat().st_size / 1024, 1)
            
            self.show_notification(
                f"Screenshot gemt!\n{danish_date}\n{filename}\n{file_size_kb}KB"
            )
            
            # Log the screenshot
            self.log_screenshot(filename, danish_date)
            
            print(f"Screenshot saved: {filename} ({danish_date})")
            
        except Exception as e:
            print(f"Error capturing screenshot: {str(e)}")
            self.show_notification(f"Fejl: {str(e)}")
    
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
    
    def show_notification(self, message):
        """Show notification using Windows toast"""
        try:
            # Use PowerShell to show Windows toast notification
            ps_script = f'''
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
$Template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
$RawXml = [xml] $Template.GetXml()
($RawXml.toast.visual.binding.text|where {{$_.id -eq "1"}}).AppendChild($RawXml.CreateTextNode("Jens Rettelsesværktøj")) > $null
($RawXml.toast.visual.binding.text|where {{$_.id -eq "2"}}).AppendChild($RawXml.CreateTextNode("{message}")) > $null
$SerializedXml = New-Object Windows.Data.Xml.Dom.XmlDocument
$SerializedXml.LoadXml($RawXml.OuterXml)
$Toast = [Windows.UI.Notifications.ToastNotification]::new($SerializedXml)
$Toast.Tag = "PowerShell"
$Toast.Group = "PowerShell"
$Toast.ExpirationTime = [DateTimeOffset]::Now.AddMinutes(1)
$Notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("PowerShell")
$Notifier.Show($Toast);
'''
            subprocess.run(['powershell', '-Command', ps_script], 
                         capture_output=True, text=True, timeout=5)
        except Exception as e:
            print(f"Notification error: {e}")
    
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
                f"Jens Rettelsesværktøj v3.0\n\n"
                f"Genvej: Ctrl+Shift+S\n"
                f"Screenshots gemmes i:\n{self.screenshots_dir}\n\n"
                f"Sådan bruger du det:\n"
                f"1. Tryk Ctrl+Shift+S\n"
                f"2. Træk for at vælge område (eller tryk Enter for hele skærmen)\n"
                f"3. Screenshot gemmes automatisk\n"
                f"4. Skriv 'screenshot' til Claude for analyse!"
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
        print("Jens Rettelsesværktøj v3.0 started!")
        print(f"Screenshots will be saved to: {self.screenshots_dir}")
        print("Press Ctrl+Shift+S to take area screenshot")
        print("Right-click camera icon in system tray to exit")
        
        # Show startup notification
        self.show_notification("Klar! Tryk Ctrl+Shift+S for screenshot")
        
        # Run system tray icon
        self.icon.run()

if __name__ == "__main__":
    try:
        app = SimpleScreenshotTool()
        app.run()
    except KeyboardInterrupt:
        print("Shutting down...")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)